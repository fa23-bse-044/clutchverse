import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { finalizeMatchResult } from "@/lib/match-result-engine";
import { matchResultsAgree } from "@/lib/match-result-reconciliation";
import {
  getMatchLobbyActor,
  isMatchLobbyEnabled,
  publishMatchLobbyEvent,
} from "@/lib/match-lobby";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resultSchema = z.object({
  scoreA: z.number().int().min(0).max(999),
  scoreB: z.number().int().min(0).max(999),
  placementA: z.number().int().positive().max(1000).optional(),
  placementB: z.number().int().positive().max(1000).optional(),
  killsA: z.number().int().min(0).max(1000).optional(),
  killsB: z.number().int().min(0).max(1000).optional(),
  evidenceId: z.string().min(1).max(64).optional(),
}).refine((value) => value.scoreA !== value.scoreB, {
  message: "A completed match must have a winner.",
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isMatchLobbyEnabled()))
    return NextResponse.json({ error: "Match lobby is unavailable." }, { status: 404 });
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const limit = await checkRateLimit(
    `match-result:${session.user.id}:${getRequestAddress(request)}`,
    8,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many result submissions." }, { status: 429 });
  const { id } = await params;
  const actor = await getMatchLobbyActor(id, session.user.id);
  if (!actor) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!actor.isParticipant)
    return NextResponse.json({ error: "Only match participants can submit results." }, { status: 403 });
  if (actor.match.tournament.state !== "LIVE")
    return NextResponse.json({ error: "This tournament is not accepting results." }, { status: 409 });
  if (actor.match.state === "completed" || actor.match.state === "disputed")
    return NextResponse.json({ error: "This match is not accepting results." }, { status: 409 });
  const parsed = resultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Result is invalid." }, { status: 400 });
  const registration = [actor.match.entrantA, actor.match.entrantB].find(
    (entrant) =>
      entrant?.userId === session.user.id ||
      entrant?.team?.memberships.some(
        (membership) => membership.userId === session.user.id,
      ),
  );
  if (!registration)
    return NextResponse.json({ error: "Match participant registration not found." }, { status: 403 });
  if (parsed.data.evidenceId) {
    const evidence = await prisma.matchEvidence.findFirst({
      where: { id: parsed.data.evidenceId, matchId: id },
      select: { id: true },
    });
    if (!evidence)
      return NextResponse.json({ error: "Evidence does not belong to this match." }, { status: 400 });
  }

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${id} FOR UPDATE`;
      const currentMatch = await transaction.match.findUnique({
        where: { id },
        select: { state: true },
      });
      if (!currentMatch || currentMatch.state === "completed" || currentMatch.state === "disputed")
        throw new Error("MATCH_NOT_ACCEPTING_RESULTS");
      const prior = await transaction.matchResultSubmission.findFirst({
        where: { matchId: id, registrationId: { not: registration.id } },
        orderBy: { createdAt: "asc" },
      });
      const priorReport = prior
        ? null
        : await transaction.matchReport.findFirst({
            where: { matchId: id, reporterId: { not: session.user.id } },
            orderBy: { createdAt: "asc" },
          });
      const priorReportRegistration = priorReport
        ? await transaction.registration.findFirst({
            where: {
              tournamentId: actor.match.tournamentId,
              OR: [
                { userId: priorReport.reporterId },
                {
                  team: {
                    memberships: { some: { userId: priorReport.reporterId } },
                  },
                },
              ],
            },
            select: { id: true },
          })
        : null;
      const opponentReport =
        priorReportRegistration &&
        priorReportRegistration.id !== registration.id
          ? priorReport
          : null;
      await transaction.matchResultSubmission.create({
        data: {
          matchId: id,
          registrationId: registration.id,
          reporterId: session.user.id,
          ...parsed.data,
        },
      });
      await transaction.matchReport.create({
        data: {
          matchId: id,
          reporterId: session.user.id,
          scoreA: parsed.data.scoreA,
          scoreB: parsed.data.scoreB,
          evidenceUrl: parsed.data.evidenceId
            ? `/api/matches/${encodeURIComponent(id)}/evidence/${encodeURIComponent(parsed.data.evidenceId)}`
            : null,
          status: "pending",
        },
      });
      if (!prior && !opponentReport) {
        await transaction.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "match.result.submit",
            targetType: "match",
            targetId: id,
            metadata: { registrationId: registration.id, evidenceId: parsed.data.evidenceId ?? null },
          },
        });
        return { status: "awaiting-opponent" as const };
      }
      const submitted = parsed.data;
      const matches = prior
        ? matchResultsAgree(prior, submitted)
        : opponentReport?.scoreA === submitted.scoreA &&
          opponentReport.scoreB === submitted.scoreB;
      if (!matches) {
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
        await transaction.match.update({
          where: { id },
          data: { state: "disputed" },
        });
        await transaction.matchReport.updateMany({
          where: { matchId: id, status: { in: ["pending", "confirmed"] } },
          data: { status: "disputed" },
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
        return { status: "disputed" as const, disputeId: dispute.id };
      }

      const saved = await finalizeMatchResult(transaction, {
        matchId: id,
        scoreA: submitted.scoreA,
        scoreB: submitted.scoreB,
      });
      await transaction.matchReport.updateMany({
        where: { matchId: id, status: { in: ["pending", "confirmed"] } },
        data: { status: "confirmed" },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "match.result.confirm",
          targetType: "match",
          targetId: id,
          metadata: {
            scoreA: saved.scoreA,
            scoreB: saved.scoreB,
            confirmedBy: "both-sides",
          },
        },
      });
      return { status: "confirmed" as const, match: saved };
    });
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:update");
    const status = outcome.status === "awaiting-opponent" || outcome.status === "disputed" ? 201 : 200;
    return NextResponse.json({ ...outcome, realtime }, { status });
  } catch (error) {
    if (error instanceof Error && error.message === "MATCH_NOT_ACCEPTING_RESULTS") {
      return NextResponse.json({ error: "This match is not accepting results." }, { status: 409 });
    }
    if (
      error instanceof Error &&
      error.name === "PrismaClientKnownRequestError" &&
      error.message.includes("matchId") &&
      error.message.includes("registrationId")
    ) {
      return NextResponse.json({ error: "Your team already submitted a result." }, { status: 409 });
    }
    console.error("Match result submission failed.", {
      reason: error instanceof Error ? error.message : "database-error",
    });
    return NextResponse.json({ error: "Unable to submit match result." }, { status: 503 });
  }
}
