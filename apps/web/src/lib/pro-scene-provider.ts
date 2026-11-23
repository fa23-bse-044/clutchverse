import { prisma } from "@clutchverse/db";
import type { GameSlug } from "@clutchverse/core";
import { getRedisClient } from "@/lib/redis";

export type ProSceneSource = {
  sourceName: string;
  sourceUrl: string;
  fetchedAt: Date;
  license: string;
};

export type ProEvent = ProSceneSource & {
  id: string;
  gameSlug: string;
  name: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  prizePool: string | null;
  region: string | null;
  stage: string | null;
  format: string | null;
};

export type ProSceneProvider = {
  events(gameSlug?: GameSlug): Promise<ProEvent[]>;
  eventDetail(eventId: string): Promise<ProEvent | null>;
  standings(eventId: string): Promise<unknown[]>;
  results(eventId: string): Promise<unknown[]>;
  teams(gameSlug: GameSlug): Promise<unknown[]>;
  teamHistory(teamId: string): Promise<unknown[]>;
  players(gameSlug: GameSlug): Promise<unknown[]>;
};

const cachePrefix = "clutchverse:proscene:";
const normalCacheSeconds = 12 * 60;
const liveCacheSeconds = 45;
const dateFields = new Set([
  "startsAt",
  "endsAt",
  "fetchedAt",
  "createdAt",
  "updatedAt",
  "resultDate",
]);

function restoreDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restoreDates);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      dateFields.has(key) && typeof item === "string"
        ? new Date(item)
        : restoreDates(item),
    ]),
  );
}

async function cachedRead<T>(
  key: string,
  ttl: (value: T) => number,
  load: () => Promise<T>,
): Promise<T> {
  let redis = null;
  try {
    redis = await getRedisClient();
    const cached = await redis?.get(`${cachePrefix}${key}`);
    if (cached) return restoreDates(JSON.parse(cached)) as T;
  } catch (error) {
    console.warn("Pro Scene Redis cache read failed.", {
      reason: error instanceof Error ? error.name : "redis-error",
    });
  }
  const value = await load();
  try {
    redis ??= await getRedisClient();
    if (redis) {
      await redis.setEx(
        `${cachePrefix}${key}`,
        ttl(value),
        JSON.stringify(value),
      );
    }
  } catch (error) {
    console.warn("Pro Scene Redis cache write failed.", {
      reason: error instanceof Error ? error.name : "redis-error",
    });
  }
  return value;
}

export const databaseProSceneProvider: ProSceneProvider = {
  async events(gameSlug) {
    return cachedRead(
      `events:${gameSlug ?? "all"}`,
      (events) =>
        events.some((event) => event.status === "live")
          ? liveCacheSeconds
          : normalCacheSeconds,
      () =>
        prisma.proSceneEvent.findMany({
          where: gameSlug ? { gameSlug } : undefined,
          orderBy: [{ startsAt: "desc" }, { name: "asc" }],
        }),
    );
  },
  async eventDetail(eventId) {
    return cachedRead(
      `event:${eventId}`,
      (event) => (event?.status === "live" ? liveCacheSeconds : normalCacheSeconds),
      () =>
        prisma.proSceneEvent.findUnique({
          where: { id: eventId },
          include: {
            teams: { include: { team: true } },
            standings: {
              include: { team: true, player: true },
              orderBy: { rank: "asc" },
            },
            results: {
              include: { team: true, player: true },
              orderBy: [{ resultDate: "desc" }, { placement: "asc" }],
            },
          },
        }),
    );
  },
  async standings(eventId) {
    return cachedRead(
      `standings:${eventId}`,
      (records) =>
        records.some((record) => record.event.status === "live")
          ? liveCacheSeconds
          : normalCacheSeconds,
      () =>
        prisma.proSceneStanding.findMany({
          where: { eventId },
          include: {
            team: true,
            player: true,
            event: { select: { status: true } },
          },
          orderBy: { rank: "asc" },
        }),
    );
  },
  async results(eventId) {
    return cachedRead(
      `results:${eventId}`,
      (records) =>
        records.some((record) => record.event.status === "live")
          ? liveCacheSeconds
          : normalCacheSeconds,
      () =>
        prisma.proSceneResult.findMany({
          where: { eventId },
          include: {
            team: true,
            player: true,
            event: { select: { status: true } },
          },
          orderBy: [{ resultDate: "desc" }, { placement: "asc" }],
        }),
    );
  },
  async teams(gameSlug) {
    return cachedRead(
      `teams:${gameSlug}`,
      () => normalCacheSeconds,
      () =>
        prisma.proSceneTeam.findMany({
          where: { gameSlug },
          include: { players: true },
          orderBy: { name: "asc" },
        }),
    );
  },
  async teamHistory(teamId) {
    return cachedRead(
      `team-history:${teamId}`,
      () => normalCacheSeconds,
      () =>
        prisma.proSceneResult.findMany({
          where: { teamId },
          include: { event: true },
          orderBy: { resultDate: "desc" },
        }),
    );
  },
  async players(gameSlug) {
    return cachedRead(
      `players:${gameSlug}`,
      () => normalCacheSeconds,
      () =>
        prisma.proScenePlayer.findMany({
          where: { gameSlug },
          include: { team: true },
          orderBy: { name: "asc" },
        }),
    );
  },
};

export function isGameSlug(value: string): value is GameSlug {
  return ["pubg-mobile", "free-fire", "tekken-8", "fifa"].includes(value);
}
