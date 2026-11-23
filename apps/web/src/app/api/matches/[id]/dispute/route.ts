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
export const dynamic = "force-dynamic";

const disputeSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

async function getActor(request: Request, matchId: string, operation: string) {
  if (!(await isMatchLobbyEnabled()))
    return { error: "Match lobby is unavailable.", status: 404 as const };
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  const limit = await checkRateLimit(
    `match-dispute:${operation}:${session.user.id}:${getRequestAddress(request)}`,
    operation === "read" ? 30 : 8,
    60_000,
  );
  if (!limit.allowed)
    return { error: "Too many dispute requests.", status: 429 as const };
  const actor = await getMatchLobbyActor(matchId, session.user.id);
  if (!actor) return { error: "Match not found.", status: 404 as const };
  if (!actor.canView)
    return { error: "Match participant permission required.", status: 403 as const };
  return { actor, userId: session.user.id };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getActor(request, id, "read");
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  const dispute = await prisma.matchDispute.findFirst({
    where: { matchId: id, status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  const evidence = await prisma.matchEvidence.findMany({
    where: { matchId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      mimeType: true,
      sizeBytes: true,
      aiSuggestion: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    dispute: dispute
      ? {
          id: dispute.id,
          status: dispute.status,
          reason: dispute.reason,
          resolution: dispute.resolution,
          dueAt: dispute.dueAt.toISOString(),
          createdAt: dispute.createdAt.toISOString(),
          resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
          messages: dispute.messages.map((message) => ({
            ...message,
            createdAt: message.createdAt.toISOString(),
          })),
        }
      : null,
    evidence: evidence.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      url: `/api/matches/${encodeURIComponent(id)}/evidence/${encodeURIComponent(item.id)}`,
    })),
    canManage: result.actor.canManage,
    currentUserId: result.userId,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getActor(request, id, "open");
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  if (!result.actor.isParticipant)
    return NextResponse.json({ error: "Only match participants can open a dispute." }, { status: 403 });
  if (result.actor.match.tournament.state !== "LIVE")
    return NextResponse.json({ error: "This tournament is not accepting disputes." }, { status: 409 });
  const parsed = disputeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Dispute reason must contain 10-1000 characters." }, { status: 400 });
  if (result.actor.match.state === "completed")
    return NextResponse.json({ error: "A completed match cannot be disputed here." }, { status: 409 });
  try {
    const dispute = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${id} FOR UPDATE`;
      const active = await transaction.matchDispute.findFirst({
        where: { matchId: id, status: "open" },
        select: { id: true },
      });
      if (active) throw new Error("MATCH_DISPUTE_ALREADY_OPEN");
      const currentMatch = await transaction.match.findUnique({
        where: { id },
        select: { state: true },
      });
      if (!currentMatch || currentMatch.state === "completed")
        throw new Error("MATCH_ALREADY_COMPLETED");
      const dueAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const opened = await transaction.matchDispute.create({
        data: {
          matchId: id,
          openerId: result.userId,
          reason: parsed.data.reason,
          dueAt,
          messages: {
            create: { authorId: result.userId, body: parsed.data.reason },
          },
        },
      });
      await transaction.match.update({
        where: { id },
        data: { state: "disputed" },
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.userId,
          action: "match.dispute.open",
          targetType: "match-dispute",
          targetId: opened.id,
          metadata: { matchId: id, dueAt: dueAt.toISOString() },
        },
      });
      return opened;
    });
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:update");
    return NextResponse.json({
      dispute: { id: dispute.id, status: dispute.status, dueAt: dispute.dueAt },
      realtime,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "MATCH_DISPUTE_ALREADY_OPEN")
      return NextResponse.json({ error: "A dispute is already open for this match." }, { status: 409 });
    if (error instanceof Error && error.message === "MATCH_ALREADY_COMPLETED")
      return NextResponse.json({ error: "A completed match cannot be disputed here." }, { status: 409 });
    console.error("Match dispute creation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to open a match dispute." }, { status: 503 });
  }
}
