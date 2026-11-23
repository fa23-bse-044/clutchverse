import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { finalizeMatchResult } from "@/lib/match-result-engine";
import {
  getMatchLobbyActor,
  isMatchLobbyEnabled,
  publishMatchLobbyEvent,
} from "@/lib/match-lobby";

export const runtime = "nodejs";

const resolutionSchema = z.object({
  disputeId: z.string().min(1).max(64),
  scoreA: z.number().int().min(0).max(999),
  scoreB: z.number().int().min(0).max(999),
  winnerRegistrationId: z.string().min(1).max(64).optional(),
  resolution: z.string().trim().min(10).max(1000),
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
    `match-dispute-resolve:${session.user.id}:${getRequestAddress(request)}`,
    8,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many resolution attempts." }, { status: 429 });
  const { id } = await params;
  const actor = await getMatchLobbyActor(id, session.user.id);
  if (!actor) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!actor.canManage)
    return NextResponse.json({ error: "Organizer or moderator permission required." }, { status: 403 });
  const parsed = resolutionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Resolution is invalid." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const dispute = await transaction.matchDispute.findFirst({
        where: { id: parsed.data.disputeId, matchId: id, status: "open" },
        select: { id: true },
      });
      if (!dispute) throw new Error("OPEN_DISPUTE_NOT_FOUND");
      const match = await finalizeMatchResult(transaction, {
        matchId: id,
        scoreA: parsed.data.scoreA,
        scoreB: parsed.data.scoreB,
        winnerRegistrationId: parsed.data.winnerRegistrationId,
      });
      await transaction.matchDispute.update({
        where: { id: dispute.id },
        data: {
          status: "resolved",
          resolverId: session.user.id,
          resolution: parsed.data.resolution,
          resolvedAt: new Date(),
        },
      });
      await transaction.matchReport.updateMany({
        where: { matchId: id, status: { in: ["pending", "disputed"] } },
        data: { status: "resolved", resolution: parsed.data.resolution },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "match.dispute.resolve",
          targetType: "match-dispute",
          targetId: dispute.id,
          metadata: {
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            winnerRegistrationId: match.winnerRegistrationId,
            resolution: parsed.data.resolution,
          },
        },
      });
      return match;
    });
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:update");
    return NextResponse.json({ match: result, realtime });
  } catch (error) {
    if (error instanceof Error && error.message === "OPEN_DISPUTE_NOT_FOUND")
      return NextResponse.json({ error: "Open dispute not found." }, { status: 404 });
    if (error instanceof Error && error.message === "WINNER_NOT_IN_MATCH")
      return NextResponse.json({ error: "Winner must be one of this match's entrants." }, { status: 400 });
    console.error("Match dispute resolution failed.", {
      reason: error instanceof Error ? error.message : "database-error",
    });
    return NextResponse.json({ error: "Unable to resolve this match dispute." }, { status: 503 });
  }
}
