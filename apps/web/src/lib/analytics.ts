import { prisma } from "@clutchverse/db";

export const PLAYER_ANALYTICS_FLAG = "player-team-analytics";

export async function isPlayerAnalyticsEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: PLAYER_ANALYTICS_FLAG },
    select: { enabled: true },
  });
  return flag?.enabled ?? process.env.NODE_ENV !== "production";
}

export type AnalyticsRecord = {
  id: string;
  gameSlug: string;
  gameName: string;
  playedAt: string;
  title: string;
  source: "platform" | "tournament" | "manual";
  outcome: "win" | "loss" | "draw" | "unknown";
  opponent: string | null;
  teamName: string | null;
  placement: number | null;
  kills: number | null;
  deaths: number | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
};

export function summarizeAnalytics(records: AnalyticsRecord[]) {
  const known = records.filter((record) => record.outcome !== "unknown");
  const wins = records.filter((record) => record.outcome === "win").length;
  const losses = records.filter((record) => record.outcome === "loss").length;
  const draws = records.filter((record) => record.outcome === "draw").length;
  const kills = records.reduce((sum, record) => sum + (record.kills ?? 0), 0);
  const deaths = records.reduce((sum, record) => sum + (record.deaths ?? 0), 0);
  const placements = new Map<number, number>();
  const opponents = new Map<string, { played: number; wins: number }>();
  const teams = new Map<string, { played: number; wins: number }>();

  for (const record of records) {
    if (record.placement !== null) {
      placements.set(
        record.placement,
        (placements.get(record.placement) ?? 0) + 1,
      );
    }
    if (record.opponent) {
      const current = opponents.get(record.opponent) ?? { played: 0, wins: 0 };
      current.played += 1;
      if (record.outcome === "win") current.wins += 1;
      opponents.set(record.opponent, current);
    }
    if (record.teamName) {
      const current = teams.get(record.teamName) ?? { played: 0, wins: 0 };
      current.played += 1;
      if (record.outcome === "win") current.wins += 1;
      teams.set(record.teamName, current);
    }
  }

  return {
    results: records.length,
    decided: known.length,
    wins,
    losses,
    draws,
    winRate: known.length ? Math.round((wins / known.length) * 1000) / 10 : null,
    kills,
    deaths,
    killDeathRatio: deaths ? Math.round((kills / deaths) * 100) / 100 : null,
    placementDistribution: [...placements.entries()]
      .sort(([a], [b]) => a - b)
      .map(([placement, count]) => ({ placement, count })),
    headToHead: [...opponents.entries()]
      .map(([opponent, result]) => ({ opponent, ...result }))
      .sort((a, b) => b.played - a.played || a.opponent.localeCompare(b.opponent))
      .slice(0, 8),
    teamPerformance: [...teams.entries()]
      .map(([team, result]) => ({ team, ...result }))
      .sort((a, b) => b.played - a.played || a.team.localeCompare(b.team)),
  };
}

export async function getPlayerAnalytics(userId: string) {
  const [profile, registrations, games, shareCard] = await Promise.all([
    prisma.playerProfile.findUnique({
      where: { userId },
      select: { id: true, handle: true, region: true },
    }),
    prisma.registration.findMany({
      where: {
        OR: [
          { userId },
          { team: { memberships: { some: { userId } } } },
        ],
      },
      select: {
        id: true,
        userId: true,
        teamId: true,
        teamName: true,
        team: { select: { name: true } },
      },
    }),
    prisma.game.findMany({
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.analyticsShareCard.findUnique({
      where: { userId },
      select: { token: true },
    }),
  ]);
  const registrationIds = registrations.map((registration) => registration.id);
  const registrationsById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const gameNames = new Map(games.map((game) => [game.slug, game.name]));

  const [matches, tournamentScores, manualEntries, rankings] = await Promise.all([
    registrationIds.length
      ? prisma.match.findMany({
          where: {
            state: "completed",
            OR: [
              { entrantAId: { in: registrationIds } },
              { entrantBId: { in: registrationIds } },
            ],
          },
          orderBy: { startsAt: "desc" },
          take: 300,
          include: {
            tournament: {
              select: {
                title: true,
                startsAt: true,
                game: { select: { slug: true, name: true } },
              },
            },
            entrantA: {
              select: {
                id: true,
                teamName: true,
                user: { select: { name: true, profile: { select: { handle: true } } } },
                team: { select: { name: true } },
              },
            },
            entrantB: {
              select: {
                id: true,
                teamName: true,
                user: { select: { name: true, profile: { select: { handle: true } } } },
                team: { select: { name: true } },
              },
            },
            resultSubmissions: {
              select: {
                registrationId: true,
                placementA: true,
                placementB: true,
                killsA: true,
                killsB: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    registrationIds.length
      ? prisma.tournamentScore.findMany({
          where: { registrationId: { in: registrationIds } },
          orderBy: { createdAt: "desc" },
          take: 300,
          include: {
            tournament: {
              select: {
                title: true,
                game: { select: { slug: true, name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.analyticsManualEntry.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: 300,
      include: { game: { select: { slug: true, name: true } } },
    }),
    prisma.ranking.findMany({
      where: {
        subjectType: "player",
        subjectId: { in: [userId, ...(profile ? [profile.id] : [])] },
      },
      orderBy: [{ gameSlug: "asc" }, { period: "asc" }],
      select: {
        gameSlug: true,
        subjectId: true,
        region: true,
        period: true,
        rating: true,
        points: true,
        updatedAt: true,
      },
    }),
  ]);

  const records: AnalyticsRecord[] = [];
  for (const match of matches) {
    const registrationId = registrationsById.has(match.entrantAId ?? "")
      ? match.entrantAId
      : match.entrantBId;
    if (!registrationId) continue;
    const isA = registrationId === match.entrantAId;
    const participant = isA ? match.entrantA : match.entrantB;
    const opponent = isA ? match.entrantB : match.entrantA;
    const scoreFor = isA ? match.scoreA : match.scoreB;
    const scoreAgainst = isA ? match.scoreB : match.scoreA;
    const submission = match.resultSubmissions.find(
      (item) => item.registrationId === registrationId,
    );
    const winnerId =
      match.winnerRegistrationId ??
      (match.scoreA !== null && match.scoreB !== null && match.scoreA !== match.scoreB
        ? match.scoreA > match.scoreB
          ? match.entrantAId
          : match.entrantBId
        : null);
    records.push({
      id: `match-${match.id}`,
      gameSlug: match.tournament.game.slug,
      gameName: match.tournament.game.name,
      playedAt: (match.startsAt ?? match.tournament.startsAt).toISOString(),
      title: match.tournament.title,
      source: "platform",
      outcome: winnerId
        ? winnerId === registrationId
          ? "win"
          : "loss"
        : scoreFor === scoreAgainst && scoreFor !== null
          ? "draw"
          : "unknown",
      opponent:
        opponent?.team?.name ??
        opponent?.teamName ??
        opponent?.user?.profile?.handle ??
        opponent?.user?.name ??
        null,
      teamName: participant?.team?.name ?? participant?.teamName ?? null,
      placement: submission ? (isA ? submission.placementA : submission.placementB) : null,
      kills: submission ? (isA ? submission.killsA : submission.killsB) : null,
      deaths: null,
      scoreFor,
      scoreAgainst,
    });
  }

  for (const score of tournamentScores) {
    const registration = registrationsById.get(score.registrationId);
    const game = score.tournament.game;
    records.push({
      id: `score-${score.id}`,
      gameSlug: game.slug,
      gameName: game.name,
      playedAt: score.createdAt.toISOString(),
      title: `${score.tournament.title} · Round ${score.round}`,
      source: "tournament",
      outcome: score.placement === 1 ? "win" : "loss",
      opponent: null,
      teamName: registration?.team?.name ?? registration?.teamName ?? null,
      placement: score.placement,
      kills: score.eliminations,
      deaths: null,
      scoreFor: score.points,
      scoreAgainst: null,
    });
  }

  for (const entry of manualEntries) {
    const outcome =
      entry.scoreFor !== null && entry.scoreAgainst !== null
        ? entry.scoreFor > entry.scoreAgainst
          ? "win"
          : entry.scoreFor < entry.scoreAgainst
            ? "loss"
            : "draw"
        : entry.placement !== null
          ? entry.placement === 1
            ? "win"
            : "loss"
          : "unknown";
    records.push({
      id: `manual-${entry.id}`,
      gameSlug: entry.game.slug,
      gameName: entry.game.name,
      playedAt: entry.playedAt.toISOString(),
      title: entry.opponent ? `vs ${entry.opponent}` : entry.game.name,
      source: "manual",
      outcome,
      opponent: entry.opponent,
      teamName: null,
      placement: entry.placement,
      kills: entry.kills,
      deaths: entry.deaths,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
    });
  }
  records.sort((a, b) => b.playedAt.localeCompare(a.playedAt));

  const rankingsForUser = rankings.filter(
    (ranking) => ranking.subjectId === userId || ranking.subjectId === profile?.id,
  );
  const capturedOn = new Date();
  capturedOn.setUTCHours(0, 0, 0, 0);
  if (rankingsForUser.length) {
    await prisma.$transaction(
      rankingsForUser.map((ranking) =>
        prisma.analyticsRatingSnapshot.upsert({
          where: {
            userId_gameSlug_period_capturedOn: {
              userId,
              gameSlug: ranking.gameSlug,
              period: ranking.period,
              capturedOn,
            },
          },
          create: {
            userId,
            gameSlug: ranking.gameSlug,
            period: ranking.period,
            rating: ranking.rating,
            capturedOn,
          },
          update: { rating: ranking.rating },
        }),
      ),
    );
  }
  const ratingSnapshots = await prisma.analyticsRatingSnapshot.findMany({
    where: { userId },
    orderBy: [{ gameSlug: "asc" }, { capturedOn: "asc" }],
    take: 500,
    select: { gameSlug: true, period: true, rating: true, capturedOn: true },
  });

  const currentRatings = rankingsForUser.map((ranking) => ({
    gameSlug: ranking.gameSlug,
    gameName: gameNames.get(ranking.gameSlug) ?? ranking.gameSlug,
    region: ranking.region,
    period: ranking.period,
    rating: ranking.rating,
    points: ranking.points,
    updatedAt: ranking.updatedAt.toISOString(),
  }));
  const peerComparison = await Promise.all(
    currentRatings.map(async (current) => {
      const peers = await prisma.ranking.findMany({
        where: {
          gameSlug: current.gameSlug,
          subjectType: "player",
          period: current.period,
          region: current.region,
          subjectId: { notIn: [userId, ...(profile ? [profile.id] : [])] },
          rating: { gte: current.rating - 150, lte: current.rating + 150 },
        },
        orderBy: { rating: "asc" },
        take: 100,
        select: { rating: true },
      });
      return {
        gameSlug: current.gameSlug,
        gameName: current.gameName,
        rating: current.rating,
        peerAverageRating: peers.length
          ? Math.round(
              peers.reduce((sum, peer) => sum + peer.rating, 0) / peers.length,
            )
          : null,
        peerCount: peers.length,
      };
    }),
  );

  return {
    handle: profile?.handle ?? null,
    shareToken: shareCard?.token ?? null,
    records,
    summary: summarizeAnalytics(records),
    games,
    currentRatings,
    ratingSnapshots: ratingSnapshots.map((snapshot) => ({
      ...snapshot,
      capturedOn: snapshot.capturedOn.toISOString(),
    })),
    peerComparison,
  };
}
