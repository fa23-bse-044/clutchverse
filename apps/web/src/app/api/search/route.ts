import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { games, type GameSlug } from "@clutchverse/core";
import { prisma } from "@clutchverse/db";
import { messages } from "@/i18n/messages";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { getRedisClient } from "@/lib/redis";
import { rankCandidates } from "@/lib/search-matcher";
import { isSpotlightEnabled } from "@/lib/spotlight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const gameSlugs: GameSlug[] = ["pubg-mobile", "free-fire", "tekken-8", "fifa"];
const resultTypes = [
  "games",
  "tournaments",
  "teams",
  "players",
  "news",
  "streams",
  "faqs",
  "records",
  "proScene",
] as const;
type ResultType = (typeof resultTypes)[number];
type SearchItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  game?: string;
  source?: { name: string; url: string; fetchedAt?: string };
};
type SearchGroups = Record<ResultType, SearchItem[]>;
type SearchResponse = { query: string; groups: SearchGroups };

const cacheDurationSeconds = 20;
const memoryCache = new Map<string, { expiresAt: number; response: SearchResponse }>();

function emptyGroups(): SearchGroups {
  return {
    games: [],
    tournaments: [],
    teams: [],
    players: [],
    news: [],
    streams: [],
    faqs: [],
    records: [],
    proScene: [],
  };
}

function cacheKey(query: string, game: string, type: string): string {
  return `clutchverse:search:${createHash("sha256")
    .update(`${query}\0${game}\0${type}`)
    .digest("hex")}`;
}

async function readCache(key: string): Promise<SearchResponse | null> {
  try {
    const redis = await getRedisClient();
    const cached = await redis?.get(key);
    if (cached) return JSON.parse(cached) as SearchResponse;
  } catch (error) {
    console.warn("Search Redis cache read failed.", {
      reason: error instanceof Error ? error.name : "redis-error",
    });
  }
  const local = memoryCache.get(key);
  if (local && local.expiresAt > Date.now()) return local.response;
  if (local) memoryCache.delete(key);
  return null;
}

async function writeCache(key: string, response: SearchResponse): Promise<void> {
  memoryCache.set(key, {
    response,
    expiresAt: Date.now() + cacheDurationSeconds * 1000,
  });
  if (memoryCache.size > 200) {
    const now = Date.now();
    for (const [cacheKeyValue, entry] of memoryCache) {
      if (entry.expiresAt <= now) memoryCache.delete(cacheKeyValue);
    }
    while (memoryCache.size > 200) {
      const oldest = memoryCache.keys().next().value as string | undefined;
      if (!oldest) break;
      memoryCache.delete(oldest);
    }
  }
  try {
    const redis = await getRedisClient();
    await redis?.setEx(key, cacheDurationSeconds, JSON.stringify(response));
  } catch (error) {
    console.warn("Search Redis cache write failed.", {
      reason: error instanceof Error ? error.name : "redis-error",
    });
  }
}

function appendRanked(
  group: SearchItem[],
  query: string,
  candidates: SearchItem[],
): void {
  group.push(
    ...rankCandidates(query, candidates, (item) => `${item.title} ${item.description}`)
      .slice(0, 8)
      .map(({ item }) => item),
  );
}

function filterGroups(
  groups: SearchGroups,
  type: string | null,
): SearchGroups {
  if (!type) return groups;
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [
      key,
      key === type ? value : [],
    ]),
  ) as SearchGroups;
}

export async function GET(request: Request) {
  const limit = await checkRateLimit(`search:${getRequestAddress(request)}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Search rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().slice(0, 100) ?? "";
  const gameFilter = params.get("game") ?? "";
  const typeFilter = params.get("type");
  if (query.length < 2) {
    return NextResponse.json({ error: "Search query must contain at least 2 characters." }, { status: 400 });
  }
  if (gameFilter && !gameSlugs.includes(gameFilter as GameSlug)) {
    return NextResponse.json({ error: "Unknown game filter." }, { status: 400 });
  }
  if (typeFilter && !(resultTypes as readonly string[]).includes(typeFilter)) {
    return NextResponse.json({ error: "Unknown search result type." }, { status: 400 });
  }

  const normalizedQuery = query.toLocaleLowerCase("en-US");
  const key = cacheKey(normalizedQuery, gameFilter, typeFilter ?? "");
  const cached = await readCache(key);
  if (cached) return NextResponse.json(cached);

  const groups = emptyGroups();
  const scopedGame = gameFilter || undefined;
  const dbGameFilter = scopedGame ? { gameSlug: scopedGame } : {};
  const selectedGroups = !typeFilter || typeFilter === "games";
  try {
    if (selectedGroups) {
      appendRanked(
        groups.games,
        query,
        games
          .filter((entry) => !scopedGame || entry.slug === scopedGame)
          .map((entry) => ({
            id: entry.slug,
            title: entry.name,
            description: `${entry.category} · Game hub`,
            href: `/games/${entry.slug}`,
            game: entry.slug,
          })),
      );
    }

    const shouldLoad = (resultType: ResultType) =>
      !typeFilter || typeFilter === resultType;
    const [
      tournaments,
      teams,
      rankings,
      profiles,
      streams,
      records,
      proEvents,
      proTeams,
      proPlayers,
      standings,
      results,
      spotlightTeams,
    ] = await Promise.all([
      shouldLoad("tournaments")
        ? prisma.tournament.findMany({
            where: scopedGame ? { game: { slug: scopedGame } } : undefined,
            select: { id: true, slug: true, title: true, state: true, region: true, game: { select: { slug: true, name: true } } },
            orderBy: { startsAt: "desc" },
            take: 200,
          })
        : [],
      shouldLoad("teams")
        ? prisma.team.findMany({
            where: scopedGame ? { gameSlug: scopedGame } : undefined,
            select: { id: true, slug: true, name: true, gameSlug: true },
            orderBy: { name: "asc" },
            take: 200,
          })
        : [],
      shouldLoad("players")
        ? prisma.ranking.findMany({
            where: scopedGame ? { gameSlug: scopedGame, subjectType: "player" } : { subjectType: "player" },
            select: { subjectId: true, gameSlug: true, rating: true },
            orderBy: { points: "desc" },
            take: 500,
          })
        : [],
      shouldLoad("players")
        ? prisma.playerProfile.findMany({
            select: { userId: true, handle: true, region: true },
            orderBy: { handle: "asc" },
            take: 500,
          })
        : [],
      shouldLoad("streams")
        ? prisma.stream.findMany({
            where: scopedGame ? { gameSlug: scopedGame } : undefined,
            select: { id: true, gameSlug: true, title: true, provider: true, providerUrl: true, state: true },
            orderBy: { scheduledAt: "desc" },
            take: 200,
          })
        : [],
      shouldLoad("records")
        ? prisma.gameRecord.findMany({
            where: scopedGame ? { gameSlug: scopedGame } : undefined,
            select: { id: true, gameSlug: true, title: true, holder: true, value: true, achievedAt: true },
            orderBy: { achievedAt: "desc" },
            take: 200,
          })
        : [],
      shouldLoad("proScene")
        ? prisma.proSceneEvent.findMany({
            where: dbGameFilter,
            select: { id: true, gameSlug: true, name: true, status: true, sourceName: true, sourceUrl: true, fetchedAt: true, region: true },
            orderBy: { startsAt: "desc" },
            take: 200,
          })
        : [],
      shouldLoad("proScene")
        ? prisma.proSceneTeam.findMany({
            where: dbGameFilter,
            select: { id: true, gameSlug: true, name: true, region: true, sourceName: true, sourceUrl: true, fetchedAt: true },
            orderBy: { name: "asc" },
            take: 200,
          })
        : [],
      shouldLoad("proScene")
        ? prisma.proScenePlayer.findMany({
            where: dbGameFilter,
            select: { id: true, gameSlug: true, name: true, region: true, sourceName: true, sourceUrl: true, fetchedAt: true },
            orderBy: { name: "asc" },
            take: 200,
          })
        : [],
      shouldLoad("proScene")
        ? prisma.proSceneStanding.findMany({
            where: scopedGame ? { event: { gameSlug: scopedGame } } : undefined,
            include: { event: { select: { id: true, gameSlug: true, name: true } }, team: { select: { name: true } }, player: { select: { name: true } } },
            orderBy: { rank: "asc" },
            take: 300,
          })
        : [],
      shouldLoad("proScene")
        ? prisma.proSceneResult.findMany({
            where: scopedGame ? { event: { gameSlug: scopedGame } } : undefined,
            include: { event: { select: { id: true, gameSlug: true, name: true } }, team: { select: { name: true } }, player: { select: { name: true } } },
            orderBy: { resultDate: "desc" },
            take: 300,
          })
        : [],
      shouldLoad("teams") && await isSpotlightEnabled()
        ? prisma.spotlightParticipation.findMany({
            where: { event: { slug: "pmgc" } },
            select: {
              id: true,
              countryCode: true,
              qualificationPath: true,
              sourceName: true,
              sourceUrl: true,
              fetchedAt: true,
              team: { select: { name: true, slug: true } },
            },
            orderBy: { team: { name: "asc" } },
            take: 200,
          })
        : [],
    ]);

    appendRanked(groups.tournaments, query, tournaments.map((event) => ({
      id: event.id,
      title: event.title,
      description: `${event.game.name} · ${event.state} · ${event.region}`,
      href: `/tournaments/${event.slug}`,
      game: event.game.slug,
    })));
    appendRanked(groups.teams, query, teams.map((team) => ({
      id: team.id,
      title: team.name,
      description: `${team.gameSlug} · Team`,
      href: `/teams/${team.slug}`,
      game: team.gameSlug,
    })).concat(spotlightTeams.map((participation) => ({
      id: `spotlight:${participation.id}`,
      title: participation.team.name,
      description: `PUBG Mobile · ${participation.countryCode} · ${participation.qualificationPath ?? "qualified team"}`,
      href: `/games/pubg-mobile/pmgc#team-${participation.id}`,
      game: "pubg-mobile",
      source: {
        name: participation.sourceName,
        url: participation.sourceUrl,
        fetchedAt: participation.fetchedAt.toISOString(),
      },
    }))));
    const rankingByUser = new Map(rankings.map((ranking) => [ranking.subjectId, ranking]));
    appendRanked(groups.players, query, profiles.flatMap((profile) => {
      const ranking = rankingByUser.get(profile.userId);
      if (scopedGame && !ranking) return [];
      return [{
        id: profile.userId,
        title: profile.handle,
        description: `${ranking?.gameSlug ?? "Player"} · ${profile.region}${ranking ? ` · ${ranking.rating} rating` : ""}`,
        href: `/players/${profile.handle}`,
        game: ranking?.gameSlug,
      }];
    }));
    appendRanked(groups.streams, query, streams.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: `${stream.gameSlug} · ${stream.provider} · ${stream.state}`,
      href: "/live",
      game: stream.gameSlug,
      source: { name: stream.provider, url: stream.providerUrl },
    })));
    appendRanked(groups.records, query, records.map((record) => ({
      id: record.id,
      title: record.title,
      description: `${record.gameSlug} · ${record.holder} · ${record.value} · community record`,
      href: `/games/${record.gameSlug}`,
      game: record.gameSlug,
    })));
    appendRanked(groups.proScene, query, [
      ...proEvents.map((event) => ({
        id: `event:${event.id}`,
        title: event.name,
        description: `${event.gameSlug} · ${event.status} · ${event.region ?? "Region unavailable"}`,
        href: `/games/${event.gameSlug}/pro-scene/${event.id}`,
        game: event.gameSlug,
        source: { name: event.sourceName, url: event.sourceUrl, fetchedAt: event.fetchedAt.toISOString() },
      })),
      ...proTeams.map((team) => ({
        id: `team:${team.id}`,
        title: team.name,
        description: `${team.gameSlug} · ${team.region ?? "Team"} · sourced team`,
        href: `/games/${team.gameSlug}/pro-scene/teams/${team.id}`,
        game: team.gameSlug,
        source: { name: team.sourceName, url: team.sourceUrl, fetchedAt: team.fetchedAt.toISOString() },
      })),
      ...proPlayers.map((player) => ({
        id: `player:${player.id}`,
        title: player.name,
        description: `${player.gameSlug} · ${player.region ?? "Player"} · sourced player`,
        href: `/games/${player.gameSlug}/pro-scene/players/${player.id}`,
        game: player.gameSlug,
        source: { name: player.sourceName, url: player.sourceUrl, fetchedAt: player.fetchedAt.toISOString() },
      })),
      ...standings.map((standing) => ({
        id: `standing:${standing.id}`,
        title: standing.team?.name ?? standing.player?.name ?? "Sourced standing",
        description: `${standing.event.gameSlug} · ${standing.event.name} · rank ${standing.rank ?? "unavailable"} · ${standing.points ?? "—"} pts`,
        href: `/games/${standing.event.gameSlug}/pro-scene/${standing.event.id}`,
        game: standing.event.gameSlug,
        source: { name: standing.sourceName, url: standing.sourceUrl, fetchedAt: standing.fetchedAt.toISOString() },
      })),
      ...results.map((result) => ({
        id: `result:${result.id}`,
        title: result.team?.name ?? result.player?.name ?? result.title ?? "Sourced result",
        description: `${result.event.gameSlug} · ${result.event.name} · ${result.title ?? `${result.placement ?? "—"} place`}`,
        href: `/games/${result.event.gameSlug}/pro-scene/${result.event.id}`,
        game: result.event.gameSlug,
        source: { name: result.sourceName, url: result.sourceUrl, fetchedAt: result.fetchedAt.toISOString() },
      })),
    ]);
    appendRanked(groups.faqs, query, messages.en.faq.questions.map(([category, title, answer], index) => ({
      id: `faq:${index}`,
      title,
      description: `${category} · ${answer}`,
      href: "/faq",
    })));
  } catch (error) {
    console.error("Search database query failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json(
      { error: "Search is temporarily unavailable." },
      { status: 503 },
    );
  }

  const response = {
    query,
    groups: filterGroups(groups, typeFilter),
  };
  await writeCache(key, response);
  return NextResponse.json(response, {
    headers: { "cache-control": "private, max-age=10" },
  });
}
