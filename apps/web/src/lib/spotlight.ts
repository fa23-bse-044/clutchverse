import { prisma } from "@clutchverse/db";
import { getRedisClient } from "@/lib/redis";
import { summarizeSpotlightCounts } from "@/lib/spotlight-domain";

export const SPOTLIGHT_FLAG = "spotlight-events";
export const SPOTLIGHT_REDIS_CHANNEL = "spotlight-events";
const snapshotCacheSeconds = 15;

function dateMillis(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isoDate(value: Date | string | null | undefined): string | null {
  const timestamp = dateMillis(value);
  return timestamp ? new Date(timestamp).toISOString() : null;
}

export async function isSpotlightEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: SPOTLIGHT_FLAG },
    select: { enabled: true },
  });
  return flag?.enabled ?? false;
}

export async function getSpotlightSnapshot(slug: string) {
  const event = await prisma.spotlightEvent.findUnique({
    where: { slug },
    include: {
      participants: {
        include: {
          team: { include: { players: { orderBy: { name: "asc" } } } },
          stage: true,
        },
        orderBy: [{ team: { name: "asc" } }],
      },
      stages: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      standings: {
        include: {
          participation: { include: { team: true } },
          stage: true,
        },
        orderBy: [{ rank: "asc" }, { points: "desc" }],
      },
      matches: {
        include: {
          stage: true,
          participation: { include: { team: true } },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!event) return null;
  const champions = await prisma.spotlightSourceRecord.findMany({
    where: { eventSlug: slug, entityType: "champion" },
    orderBy: { fetchedAt: "desc" },
    take: 20,
  });
  const latestUpdatedAt = new Date(Math.max(
    event.fetchedAt.getTime(),
    ...event.participants.flatMap((participation) => [
      participation.fetchedAt.getTime(),
      ...participation.team.players.map((player) => player.fetchedAt.getTime()),
    ]),
    ...event.stages.map((stage) => stage.fetchedAt.getTime()),
    ...event.standings.map((standing) => standing.fetchedAt.getTime()),
    ...event.matches.map((match) => match.fetchedAt.getTime()),
    ...champions.map((record) => record.fetchedAt.getTime()),
  ));
  return {
    ...event,
    champions,
    latestUpdatedAt,
    counts: summarizeSpotlightCounts(
      event.participants.map(({ countryCode, status }) => ({ countryCode, status })),
      event.totalSlots,
      event.stages.length,
      event.prizePool,
    ),
  };
}

export async function getCachedSpotlightSnapshot(slug: string) {
  const redis = await getRedisClient();
  const key = `clutchverse:spotlight:snapshot:${slug}`;
  if (redis) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as Awaited<ReturnType<typeof getSpotlightSnapshot>>;
  }
  const snapshot = await getSpotlightSnapshot(slug);
  if (snapshot && redis)
    await redis.setEx(key, snapshotCacheSeconds, JSON.stringify(snapshot));
  return snapshot;
}

export async function publishSpotlightChange(
  slug: string,
  event: "team:added" | "team:updated" | "team:removed" | "counts:updated" |
    "standings:updated" | "match:updated" | "status:changed",
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  const key = `clutchverse:spotlight:snapshot:${slug}`;
  await redis.del(key);
  await redis.publish(
    SPOTLIGHT_REDIS_CHANNEL,
    JSON.stringify({
      slug,
      event,
      payload,
      updatedAt: new Date().toISOString(),
    }),
  );
  return true;
}

export async function getEventSpotlight(slug: string) {
  const snapshot = await getCachedSpotlightSnapshot(slug);
  if (!snapshot) return null;
  const asOf = isoDate(snapshot.latestUpdatedAt) ?? new Date().toISOString();
  return {
    event: {
      name: snapshot.displayName,
      status: snapshot.status,
      startsAt: isoDate(snapshot.startsAt),
      endsAt: isoDate(snapshot.endsAt),
      venue: snapshot.venue,
      prizePool: snapshot.prizePool,
    },
    teams: snapshot.participants.map((participation) => ({
      name: participation.team.name,
      countryCode: participation.countryCode,
      qualificationPath: participation.qualificationPath,
      status: participation.status,
      sourceName: participation.sourceName,
      sourceUrl: participation.sourceUrl,
    })),
    standings: snapshot.standings.map((standing) => ({
      stage: standing.stage?.name ?? "Data not available yet",
      team: standing.participation.team.name,
      rank: standing.rank,
      points: standing.points,
      kills: standing.kills,
      sourceName: standing.sourceName,
      sourceUrl: standing.sourceUrl,
    })),
    schedule: snapshot.matches.map((match) => ({
      title: match.title,
      stage: match.stage?.name ?? "Data not available yet",
      status: match.status,
      startsAt: isoDate(match.startsAt),
      sourceName: match.sourceName,
      sourceUrl: match.sourceUrl,
    })),
    source: {
      name: snapshot.sourceName,
      url: snapshot.sourceUrl,
    },
    asOf,
    missing: {
      teams: snapshot.participants.length === 0,
      standings: snapshot.standings.length === 0,
      schedule: snapshot.matches.length === 0,
    },
  };
}

export const get_event_spotlight = getEventSpotlight;

export function getSpotlightBotContext(
  spotlight: Awaited<ReturnType<typeof getEventSpotlight>>,
): string {
  if (!spotlight) return "PMGC spotlight data is not available yet.";
  return [
    `get_event_spotlight result as of ${spotlight.asOf} (source: ${spotlight.source.name}; ${spotlight.source.url}):`,
    `Event: ${spotlight.event.name}; status=${spotlight.event.status}; starts=${spotlight.event.startsAt ?? "Data not available yet"}; ends=${spotlight.event.endsAt ?? "Data not available yet"}; venue=${spotlight.event.venue ?? "Data not available yet"}; prize=${spotlight.event.prizePool ?? "Data not available yet"}.`,
    `Teams: ${spotlight.teams.length ? spotlight.teams.map((team) => `${team.name} (${team.countryCode}; ${team.qualificationPath ?? "qualification path not provided"}; source ${team.sourceName}: ${team.sourceUrl})`).join("; ") : "Data not available yet."}`,
    `Standings: ${spotlight.standings.length ? spotlight.standings.map((row) => `${row.stage}: ${row.team}, rank ${row.rank ?? "TBD"}, points ${row.points ?? "TBD"}, kills ${row.kills ?? "TBD"} (${row.sourceName}: ${row.sourceUrl})`).join("; ") : "Data not available yet."}`,
    `Schedule/results: ${spotlight.schedule.length ? spotlight.schedule.map((match) => `${match.stage}: ${match.title}; ${match.status}; ${match.startsAt ?? "date TBD"} (${match.sourceName}: ${match.sourceUrl})`).join("; ") : "Data not available yet."}`,
  ].join("\n");
}
