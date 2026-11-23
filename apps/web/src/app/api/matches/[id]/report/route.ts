import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import {
  isMatchLobbyEnabled,
  publishMatchLobbyEvent,
} from "@/lib/match-lobby";
import { finalizeMatchResult } from "@/lib/match-result-engine";

export const runtime = "nodejs";

const scoreSchema = z.object({
  scoreA: z.number().int().min(0).max(999),
  scoreB: z.number().int().min(0).max(999),
  evidenceUrl: z.string().url().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const enhanced = await isMatchLobbyEnabled();
  if (enhanced) {
    const limit = await checkRateLimit(
      `match-report:${session.user.id}:${getRequestAddress(request)}`,
      8,
      60_000,
    );
    if (!limit.allowed)
      return NextResponse.json({ error: "Too many result submissions." }, { status: 429 });
  }
  const input = await request.json().catch(() => null);
  const parsed = scoreSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Match result is invalid." }, { status: 400 });
  if (enhanced && parsed.data.scoreA === parsed.data.scoreB) {
    return NextResponse.json(
      { error: "A completed match must have a winner." },
      { status: 400 },
    );
  }
  const { id } = await params;
  try {
    const match = await prisma.match.findUnique({ where: { id }, include: { tournament: true } });
    if (!match || match.tournament.state !== "LIVE") {
      return NextResponse.json({ error: "This match is not accepting results." }, { status: 409 });
    }
    const registration = await prisma.registration.findFirst({
      where: {
        tournamentId: match.tournamentId,
        OR: [
          { userId: session.user.id },
          { team: { memberships: { some: { userId: session.user.id } } } },
        ],
      },
    });
    if (!registration) return NextResponse.json({ error: "Only a registered competitor can report this match." }, { status: 403 });
    if (registration.id !== match.entrantAId && registration.id !== match.entrantBId) {
      return NextResponse.json({ error: "This account is not a participant in the selected match." }, { status: 403 });
    }

    const result = await prisma.$transaction(async (transaction) => {
      if (enhanced) {
        await transaction.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${id} FOR UPDATE`;
        const currentMatch = await transaction.match.findUnique({
          where: { id },
          select: { state: true },
        });
        if (!currentMatch || currentMatch.state === "completed" || currentMatch.state === "disputed")
          throw new Error("MATCH_NOT_ACCEPTING_RESULTS");
      }
      const previous = await transaction.matchReport.findFirst({
        where: { matchId: id },
        orderBy: { createdAt: "desc" },
      });
      if (previous?.reporterId === session.user.id) throw new Error("RESULT_ALREADY_SUBMITTED");
      if (enhanced && previous) {
        const previousRegistration = await transaction.registration.findFirst({
          where: {
            tournamentId: match.tournamentId,
            OR: [
              { userId: previous.reporterId },
              { team: { memberships: { some: { userId: previous.reporterId } } } },
            ],
          },
          select: { id: true },
        });
        if (previousRegistration?.id === registration.id)
          throw new Error("RESULT_ALREADY_SUBMITTED");
      }
      const hasConflict = Boolean(previous && (previous.scoreA !== parsed.data.scoreA || previous.scoreB !== parsed.data.scoreB));
      const confirmed = Boolean(previous && !hasConflict);
      const report = await transaction.matchReport.create({
        data: {
          matchId: id,
          reporterId: session.user.id,
          scoreA: parsed.data.scoreA,
          scoreB: parsed.data.scoreB,
          evidenceUrl: parsed.data.evidenceUrl,
          status: hasConflict ? "disputed" : confirmed ? "confirmed" : "pending",
        },
      });
      if (enhanced) {
        await transaction.matchResultSubmission.create({
          data: {
            matchId: id,
            registrationId: registration.id,
            reporterId: session.user.id,
            scoreA: parsed.data.scoreA,
            scoreB: parsed.data.scoreB,
          },
        });
      }
      if (hasConflict) {
        await transaction.match.update({ where: { id }, data: { state: "disputed" } });
        if (enhanced) {
          const activeDispute = await transaction.matchDispute.findFirst({
            where: { matchId: id, status: "open" },
            select: { id: true },
          });
          if (!activeDispute) {
            const dueAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
            const dispute = await transaction.matchDispute.create({
              data: {
                matchId: id,
                openerId: session.user.id,
                reason: "The two team result submissions do not match.",
                dueAt,
                messages: {
                  create: {
                    authorId: session.user.id,
                    body: "A result mismatch was detected. Add evidence and notes for the organizer.",
                  },
                },
              },
            });
            await transaction.auditLog.create({
              data: {
                actorId: session.user.id,
                action: "match.dispute.auto-open",
                targetType: "match-dispute",
                targetId: dispute.id,
                metadata: { matchId: id, dueAt: dueAt.toISOString() },
              },
            });
          }
        }
      }
      if (confirmed) {
        if (enhanced) {
          await finalizeMatchResult(transaction, {
            matchId: id,
            scoreA: parsed.data.scoreA,
            scoreB: parsed.data.scoreB,
          });
        } else {
          await transaction.match.update({
            where: { id },
            data: { scoreA: parsed.data.scoreA, scoreB: parsed.data.scoreB, state: "reported" },
          });
        }
        await transaction.matchReport.update({
          where: { id: previous!.id },
          data: { status: "confirmed" },
        });
      }
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "match.report", targetType: "match", targetId: id, metadata: { disputed: hasConflict } },
      });
      if (enhanced && confirmed) {
        await transaction.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "match.result.confirm",
            targetType: "match",
            targetId: id,
            metadata: {
              scoreA: parsed.data.scoreA,
              scoreB: parsed.data.scoreB,
              confirmedBy: "both-sides",
            },
          },
        });
      }
      return { report, disputed: hasConflict };
    });
    if (enhanced) await publishMatchLobbyEvent(id, "match:lobby:update");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "MATCH_NOT_ACCEPTING_RESULTS") {
      return NextResponse.json({ error: "This match is not accepting results." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "RESULT_ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "You already reported this match." }, { status: 409 });
    }
    if (
      error instanceof Error &&
      error.name === "PrismaClientKnownRequestError" &&
      error.message.includes("matchId") &&
      error.message.includes("registrationId")
    ) {
      return NextResponse.json({ error: "Your team already submitted a result." }, { status: 409 });
    }
    console.error("Match result submission failed.", error);
    return NextResponse.json({ error: "Unable to submit match result." }, { status: 503 });
  }
}
