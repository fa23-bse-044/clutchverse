import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";

const resolutionSchema = z.object({
  scoreA: z.number().int().min(0).max(999),
  scoreB: z.number().int().min(0).max(999),
  winnerRegistrationId: z.string().min(1).max(64),
  resolution: z.string().trim().min(10).max(1000),
}).refine((value) => value.scoreA !== value.scoreB, { message: "A completed match must have a winner." });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [user, { id }] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
    params,
  ]);
  const input = await request.json().catch(() => null);
  const parsed = resolutionSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Resolution details are invalid." }, { status: 400 });
  try {
    const match = await prisma.match.findUnique({ where: { id }, include: { tournament: true } });
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const isOrganizer = match.tournament.organizerId === session.user.id;
    const canReview = user?.role === "ADMIN" || user?.role === "MODERATOR" || isOrganizer;
    if (!canReview) return NextResponse.json({ error: "Organizer or moderator permission required." }, { status: 403 });
    if (![match.entrantAId, match.entrantBId].includes(parsed.data.winnerRegistrationId)) {
      return NextResponse.json({ error: "Winner must be one of the registered match participants." }, { status: 400 });
    }
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.match.update({
        where: { id },
        data: {
          scoreA: parsed.data.scoreA,
          scoreB: parsed.data.scoreB,
          winnerRegistrationId: parsed.data.winnerRegistrationId,
          state: "completed",
        },
      });
      await transaction.matchReport.updateMany({
        where: { matchId: id, status: { in: ["pending", "disputed"] } },
        data: { status: "resolved", resolution: parsed.data.resolution },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "match.resolve",
          targetType: "match",
          targetId: id,
          metadata: { scoreA: saved.scoreA, scoreB: saved.scoreB, resolution: parsed.data.resolution },
        },
      });
      return saved;
    });
    return NextResponse.json({ match: updated });
  } catch (error) {
    console.error("Match dispute resolution failed.", error);
    return NextResponse.json({ error: "Unable to resolve this match." }, { status: 503 });
  }
}
