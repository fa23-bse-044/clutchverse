import { prisma } from "@clutchverse/db";

export const MATCH_LOBBY_FLAG = "match-lobby";

export async function isMatchLobbyEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: MATCH_LOBBY_FLAG },
    select: { enabled: true },
  });
  return flag?.enabled ?? process.env.NODE_ENV !== "production";
}

export async function getMatchLobbyAccess(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: {
        select: { organizerId: true, title: true, format: true, state: true },
      },
      entrantA: {
        select: {
          id: true,
          teamName: true,
          userId: true,
          user: { select: { name: true } },
          team: {
            select: {
              name: true,
              memberships: { select: { userId: true } },
            },
          },
        },
      },
      entrantB: {
        select: {
          id: true,
          teamName: true,
          userId: true,
          user: { select: { name: true } },
          team: {
            select: {
              name: true,
              memberships: { select: { userId: true } },
            },
          },
        },
      },
    },
  });
  if (!match) return null;
  const isParticipant = [match.entrantA, match.entrantB].some(
    (registration) =>
      registration?.userId === userId ||
      registration?.team?.memberships.some(
        (membership) => membership.userId === userId,
      ),
  );
  return {
    match,
    isParticipant,
    isOrganizer: match.tournament.organizerId === userId,
  };
}

export async function getMatchLobbyActor(matchId: string, userId: string) {
  const [access, user] = await Promise.all([
    getMatchLobbyAccess(matchId, userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);
  if (!access || !user) return null;
  const isStaff = user.role === "ADMIN" || user.role === "MODERATOR";
  return {
    ...access,
    role: user.role,
    isStaff,
    isAdmin: user.role === "ADMIN",
    canView: access.isParticipant || access.isOrganizer || isStaff,
    canManage: access.isOrganizer || isStaff,
    canImportScores:
      user.role === "ADMIN" ||
      (access.isOrganizer && user.role === "ORGANIZER"),
  };
}

export async function publishMatchLobbyEvent(
  matchId: string,
  event: "match:lobby:update" | "match:lobby:message",
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  try {
    const { getRedisClient } = await import("@/lib/redis");
    const redis = await getRedisClient();
    if (!redis) return false;
    await redis.publish(
      "match-lobby-events",
      JSON.stringify({
        matchId,
        event,
        payload,
        updatedAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch (error) {
    console.error("Could not publish match lobby update.", {
      reason: error instanceof Error ? error.name : "redis-error",
    });
    return false;
  }
}
