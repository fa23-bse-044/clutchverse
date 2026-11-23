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

const dateInput = z.union([z.string().datetime(), z.literal("")]);
const settingsSchema = z
  .object({
    roomId: z.string().trim().max(80),
    roomPassword: z.string().max(120),
    roomRevealAt: dateInput,
    checkInStartsAt: dateInput,
    checkInEndsAt: dateInput,
  })
  .refine(
    (value) => {
      if (!value.checkInStartsAt || !value.checkInEndsAt) return true;
      if (value.checkInStartsAt === "" || value.checkInEndsAt === "") return true;
      return new Date(value.checkInStartsAt) < new Date(value.checkInEndsAt);
    },
    { message: "Check-in end must be later than its start." },
  );
const readySchema = z.object({ ready: z.boolean() });

async function getRequestActor(
  request: Request,
  matchId: string,
  operation: string,
) {
  if (!(await isMatchLobbyEnabled()))
    return { error: "Match lobby is unavailable.", status: 404 as const };
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  const limit = await checkRateLimit(
    `match-lobby:${operation}:${session.user.id}:${getRequestAddress(request)}`,
    operation === "read" ? 60 : 20,
    60_000,
  );
  if (!limit.allowed)
    return { error: "Too many requests.", status: 429 as const };
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
  const result = await getRequestActor(request, id, "read");
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  const { match } = result.actor;
  const [readyStatuses, messages, submissions, dispute] = await Promise.all([
    prisma.matchReadyStatus.findMany({
      where: { matchId: id },
      select: { userId: true, ready: true, updatedAt: true },
    }),
    prisma.matchLobbyMessage.findMany({
      where: { matchId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.matchResultSubmission.findMany({
      where: { matchId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        registrationId: true,
        scoreA: true,
        scoreB: true,
        placementA: true,
        placementB: true,
        killsA: true,
        killsB: true,
        evidenceId: true,
        createdAt: true,
      },
    }),
    prisma.matchDispute.findFirst({
      where: { matchId: id, status: "open" },
      orderBy: { createdAt: "desc" },
      select: { id: true, reason: true, dueAt: true, createdAt: true },
    }),
  ]);
  const revealRoom =
    match.roomRevealAt !== null && match.roomRevealAt.getTime() <= Date.now();
  const isReady = (
    registration: NonNullable<typeof match.entrantA>,
  ) => {
    const memberIds =
      registration.team?.memberships.map((membership) => membership.userId) ??
      (registration.userId ? [registration.userId] : []);
    return (
      memberIds.length > 0 &&
      memberIds.every((userId) =>
        readyStatuses.some((status) => status.userId === userId && status.ready),
      )
    );
  };
  return NextResponse.json({
    match: {
      id: match.id,
      state: match.state,
      round: match.round,
      position: match.position,
      startsAt: match.startsAt?.toISOString() ?? null,
      tournamentId: match.tournamentId,
      tournamentTitle: match.tournament.title,
      format: match.tournament.format,
      organizerId: match.tournament.organizerId,
      roomId:
        revealRoom || result.actor.isOrganizer || result.actor.isAdmin
          ? match.roomId
          : null,
      roomPassword:
        revealRoom || result.actor.isOrganizer || result.actor.isAdmin
          ? match.roomPassword
          : null,
      roomRevealAt: match.roomRevealAt?.toISOString() ?? null,
      checkInStartsAt: match.checkInStartsAt?.toISOString() ?? null,
      checkInEndsAt: match.checkInEndsAt?.toISOString() ?? null,
      entrantA: match.entrantA
        ? {
            id: match.entrantA.id,
            name:
              match.entrantA.teamName ??
              match.entrantA.user?.name ??
              match.entrantA.team?.name ??
              "Entrant A",
              ready: isReady(match.entrantA),
          }
        : null,
      entrantB: match.entrantB
        ? {
            id: match.entrantB.id,
            name:
              match.entrantB.teamName ??
              match.entrantB.user?.name ??
              match.entrantB.team?.name ??
              "Entrant B",
              ready: isReady(match.entrantB),
          }
        : null,
    },
    currentUserId: result.userId,
    canManage: result.actor.canManage,
    canImportScores: result.actor.canImportScores,
    readyStatuses,
    messages: messages.reverse().map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    })),
    submissions: submissions.map((submission) => ({
      ...submission,
      createdAt: submission.createdAt.toISOString(),
    })),
    dispute: dispute
      ? {
          ...dispute,
          dueAt: dispute.dueAt.toISOString(),
          createdAt: dispute.createdAt.toISOString(),
        }
      : null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getRequestActor(request, id, "settings");
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  if (!result.actor.canManage)
    return NextResponse.json({ error: "Organizer permission required." }, { status: 403 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Lobby settings are invalid." }, { status: 400 });
  const asDate = (value: string) => (value ? new Date(value) : null);
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.match.update({
        where: { id },
        data: {
          roomId: parsed.data.roomId || null,
          roomPassword: parsed.data.roomPassword || null,
          roomRevealAt: asDate(parsed.data.roomRevealAt),
          checkInStartsAt: asDate(parsed.data.checkInStartsAt),
          checkInEndsAt: asDate(parsed.data.checkInEndsAt),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.userId,
          action: "match.lobby.settings",
          targetType: "match",
          targetId: id,
          metadata: {
            roomConfigured: Boolean(saved.roomId),
            roomRevealAt: saved.roomRevealAt?.toISOString() ?? null,
            checkInStartsAt: saved.checkInStartsAt?.toISOString() ?? null,
            checkInEndsAt: saved.checkInEndsAt?.toISOString() ?? null,
          },
        },
      });
      return saved;
    });
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:update");
    return NextResponse.json({
      ok: true,
      realtime,
      roomRevealAt: updated.roomRevealAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Match lobby settings update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to update lobby settings." }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getRequestActor(request, id, "ready");
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  if (!result.actor.isParticipant)
    return NextResponse.json({ error: "Only match participants can ready up." }, { status: 403 });
  const parsed = readySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Ready status is invalid." }, { status: 400 });
  const now = new Date();
  const { match } = result.actor;
  if (match.state === "completed" || match.state === "disputed")
    return NextResponse.json({ error: "This match is not accepting ready status." }, { status: 409 });
  if (
    (match.checkInStartsAt && now < match.checkInStartsAt) ||
    (match.checkInEndsAt && now > match.checkInEndsAt)
  ) {
    return NextResponse.json({ error: "Check-in is not currently open." }, { status: 409 });
  }
  try {
    const ready = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.matchReadyStatus.upsert({
        where: { matchId_userId: { matchId: id, userId: result.userId } },
        create: { matchId: id, userId: result.userId, ready: parsed.data.ready },
        update: { ready: parsed.data.ready },
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.userId,
          action: "match.lobby.ready",
          targetType: "match",
          targetId: id,
          metadata: { ready: saved.ready },
        },
      });
      return saved;
    });
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:update");
    return NextResponse.json({ ready: ready.ready, updatedAt: ready.updatedAt, realtime });
  } catch (error) {
    console.error("Match ready status update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save ready status." }, { status: 503 });
  }
}
