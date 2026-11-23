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
  body: z.string().trim().min(1).max(300),
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
    `match-lobby-chat:${session.user.id}:${getRequestAddress(request)}`,
    12,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Please wait before sending another message." }, { status: 429 });
  const { id } = await params;
  const actor = await getMatchLobbyActor(id, session.user.id);
  if (!actor) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!actor.canView)
    return NextResponse.json({ error: "Match participant permission required." }, { status: 403 });
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Message must contain 1-300 characters." }, { status: 400 });
  if (/\b(?:kill yourself|doxx?)\b/i.test(parsed.data.body))
    return NextResponse.json({ error: "Message blocked by the safety filter." }, { status: 400 });
  try {
    const message = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.matchLobbyMessage.create({
        data: {
          matchId: id,
          authorId: session.user.id,
          body: parsed.data.body,
        },
        include: { author: { select: { id: true, name: true } } },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "match.lobby.message",
          targetType: "match",
          targetId: id,
          metadata: { messageId: saved.id },
        },
      });
      return saved;
    });
    const payload = {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    };
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:message", payload);
    return NextResponse.json({ message: payload, realtime }, { status: 201 });
  } catch (error) {
    console.error("Match lobby message save failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to send the lobby message." }, { status: 503 });
  }
}
