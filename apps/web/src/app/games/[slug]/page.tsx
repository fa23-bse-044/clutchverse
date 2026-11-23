import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findGame, games } from "@clutchverse/core";
import { GameHub } from "@/components/game-hub";
import { SpotlightHubCard } from "@/components/spotlight-hub-card";
import { prisma } from "@clutchverse/db";
import { isSpotlightEnabled } from "@/lib/spotlight";
import type { Tournament as DemoTournament } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return games.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = findGame(slug);
  return game
    ? { title: `${game.name} hub`, description: game.description }
    : {};
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = findGame(slug);
  if (!game) notFound();
  let events: DemoTournament[] = [];
  let players: {
    handle: string;
    game: string;
    record: string;
    rating: number;
    region: string;
    winRate: string;
  }[] = [];
  let teams: {
    name: string;
    slug: string;
    game: string;
    members: number;
    score: string;
    color: string;
  }[] = [];
  let records: {
    id: string;
    title: string;
    holder: string;
    value: string;
    achievedAt: string;
    proofUrl: string | null;
  }[] = [];
  let liveStreams: { id: string; title: string; provider: string }[] = [];
  let playerCount = 0;
  let liveCount = 0;
  let spotlightCard: { status: string | null; startsAt: string | null } | null = null;

  if (slug === "pubg-mobile") {
    try {
      if (await isSpotlightEnabled()) {
        const spotlight = await prisma.spotlightEvent.findUnique({
          where: { slug: "pmgc" },
          select: { status: true, startsAt: true },
        });
        spotlightCard = {
          status: spotlight?.status ?? null,
          startsAt: spotlight?.startsAt?.toISOString() ?? null,
        };
      }
    } catch (error) {
      console.error("PMGC hub spotlight unavailable.", {
        reason: error instanceof Error ? error.name : "database-error",
      });
    }
  }

  try {
    const [
      tournamentRows,
      rankingRows,
      teamRows,
      recordRows,
      streamRows,
      count,
      completedMatches,
    ] = await Promise.all([
      prisma.tournament.findMany({
        where: { game: { slug } },
        include: { _count: { select: { registrations: true } } },
        orderBy: [{ startsAt: "asc" }, { title: "asc" }],
        take: 100,
      }),
      prisma.ranking.findMany({
        where: {
          gameSlug: slug,
          subjectType: "player",
          region: "Global",
          period: "season",
        },
        orderBy: [{ points: "desc" }, { rating: "desc" }],
        take: 10,
      }),
      prisma.team.findMany({
        where: { gameSlug: slug },
        include: { _count: { select: { memberships: true } } },
        orderBy: { name: "asc" },
        take: 20,
      }),
      prisma.gameRecord.findMany({
        where: { gameSlug: slug },
        orderBy: { achievedAt: "desc" },
        take: 20,
      }),
      prisma.stream.findMany({
        where: { gameSlug: slug, state: "live" },
        select: { id: true, title: true, provider: true },
        orderBy: { scheduledAt: "desc" },
        take: 20,
      }),
      prisma.ranking.count({
        where: { gameSlug: slug, subjectType: "player", period: "season" },
      }),
      prisma.match.findMany({
        where: { state: "completed", tournament: { game: { slug } } },
        select: {
          winnerRegistrationId: true,
          entrantA: { select: { id: true, userId: true } },
          entrantB: { select: { id: true, userId: true } },
        },
      }),
    ]);
    const profiles = await prisma.playerProfile.findMany({
      where: { userId: { in: rankingRows.map(({ subjectId }) => subjectId) } },
      select: { userId: true, handle: true, region: true },
    });
    const profileById = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );
    const resultsByUser = new Map<string, { wins: number; played: number }>();
    for (const match of completedMatches) {
      for (const registration of [match.entrantA, match.entrantB]) {
        if (!registration?.userId) continue;
        const stats = resultsByUser.get(registration.userId) ?? {
          wins: 0,
          played: 0,
        };
        stats.played += 1;
        if (match.winnerRegistrationId === registration.id) stats.wins += 1;
        resultsByUser.set(registration.userId, stats);
      }
    }
    events = tournamentRows.map((event) => ({
      slug: event.slug,
      title: event.title,
      game: game.slug,
      state: event.state,
      format: event.format.replaceAll("_", " "),
      mode:
        typeof event.settings === "object" &&
        event.settings !== null &&
        "mode" in event.settings &&
        typeof event.settings.mode === "string"
          ? event.settings.mode
          : event.format === "BATTLE_ROYALE"
            ? "squad"
            : "solo",
      starts:
        event.startsAt.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }) + " UTC",
      prize: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(event.prizePool),
      entries: `${event._count.registrations}`,
      region: event.region,
      entryFee: event.entryFee,
      startsAt: event.startsAt.toISOString(),
    }));
    players = rankingRows.flatMap((ranking) => {
      const profile = profileById.get(ranking.subjectId);
      if (!profile) return [];
      const performance = resultsByUser.get(ranking.subjectId) ?? {
        wins: 0,
        played: 0,
      };
      return [
        {
          handle: profile.handle,
          game: game.name,
          record: `${performance.wins}W-${performance.played - performance.wins}L`,
          rating: ranking.rating,
          region: profile.region,
          winRate: performance.played
            ? `${Math.round((performance.wins / performance.played) * 100)}% wins`
            : "No match history",
        },
      ];
    });
    teams = teamRows.map((team) => ({
      name: team.name,
      slug: team.slug,
      game: game.name,
      members: team._count.memberships,
      score: "",
      color:
        game.slug === "free-fire"
          ? "orange"
          : game.slug === "tekken-8"
            ? "red"
            : "violet",
    }));
    records = recordRows.map((record) => ({
      id: record.id,
      title: record.title,
      holder: record.holder,
      value: record.value,
      achievedAt: record.achievedAt.toISOString(),
      proofUrl: record.proofUrl,
    }));
    liveStreams = streamRows;
    playerCount = count;
    liveCount = tournamentRows.filter((event) => event.state === "LIVE").length;
  } catch (error) {
    console.warn(`Game hub data unavailable for ${slug}.`, error);
  }

  return (
    <>
      {spotlightCard && (
        <SpotlightHubCard
          status={spotlightCard.status}
          startsAt={spotlightCard.startsAt}
        />
      )}
      <GameHub
        game={game}
        events={events}
        players={players}
        teams={teams}
        records={records}
        liveStreams={liveStreams}
        playerCount={playerCount}
        liveCount={liveCount}
      />
    </>
  );
}
