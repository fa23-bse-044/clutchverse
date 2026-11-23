import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import {
  getMatchLobbyActor,
  isMatchLobbyEnabled,
  publishMatchLobbyEvent,
} from "@/lib/match-lobby";

export const runtime = "nodejs";

const messageSchema = z.object({
  disputeId: z.string().min(1).max(64),
  body: z.string().trim().min(1).max(2000),
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
    `match-dispute-message:${session.user.id}:${getRequestAddress(request)}`,
    10,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many dispute messages." }, { status: 429 });
  const { id } = await params;
  const actor = await getMatchLobbyActor(id, session.user.id);
  if (!actor) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!actor.canView)
    return NextResponse.json({ error: "Match participant permission required." }, { status: 403 });
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Dispute message is invalid." }, { status: 400 });
  try {
    const dispute = await prisma.matchDispute.findFirst({
      where: { id: parsed.data.disputeId, matchId: id, status: "open" },
      select: { id: true },
    });
    if (!dispute)
      return NextResponse.json({ error: "Open dispute not found." }, { status: 404 });
    const message = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.matchDisputeMessage.create({
        data: {
          disputeId: dispute.id,
          authorId: session.user.id,
          body: parsed.data.body,
        },
        include: { author: { select: { id: true, name: true } } },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "match.dispute.message",
          targetType: "match-dispute",
          targetId: dispute.id,
          metadata: { messageId: saved.id },
        },
      });
      return saved;
    });
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:update");
    return NextResponse.json({
      message: { ...message, createdAt: message.createdAt.toISOString() },
      realtime,
    }, { status: 201 });
  } catch (error) {
    console.error("Match dispute message save failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save dispute message." }, { status: 503 });
  }
}
