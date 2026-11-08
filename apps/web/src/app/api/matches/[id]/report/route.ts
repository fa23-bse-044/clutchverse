import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";

const scoreSchema = z.object({
  scoreA: z.number().int().min(0).max(999),
  scoreB: z.number().int().min(0).max(999),
  evidenceUrl: z.string().url().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = scoreSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Match result is invalid." }, { status: 400 });
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
      const previous = await transaction.matchReport.findFirst({
        where: { matchId: id },
        orderBy: { createdAt: "desc" },
      });
      if (previous?.reporterId === session.user.id) throw new Error("RESULT_ALREADY_SUBMITTED");
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
      if (hasConflict) await transaction.match.update({ where: { id }, data: { state: "disputed" } });
      if (confirmed) {
        await transaction.match.update({
          where: { id },
          data: { scoreA: parsed.data.scoreA, scoreB: parsed.data.scoreB, state: "reported" },
        });
        await transaction.matchReport.update({
          where: { id: previous!.id },
          data: { status: "confirmed" },
        });
      }
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "match.report", targetType: "match", targetId: id, metadata: { disputed: hasConflict } },
      });
      return { report, disputed: hasConflict };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "RESULT_ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "You already reported this match." }, { status: 409 });
    }
    console.error("Match result submission failed.", error);
    return NextResponse.json({ error: "Unable to submit match result." }, { status: 503 });
  }
}
