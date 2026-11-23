import { randomBytes } from "node:crypto";
import { prisma } from "@clutchverse/db";

export const SEASONAL_PLAY_FLAG = "seasonal-play";
const REWARD_LEVELS = [
  { level: 1, title: "Rookie badge", kind: "badge" },
  { level: 2, title: "Season frame", kind: "frame" },
  { level: 3, title: "Rising star", kind: "title" },
  { level: 5, title: "Veteran badge", kind: "badge" },
  { level: 10, title: "Champion frame", kind: "frame" },
  { level: 20, title: "Season legend", kind: "title" },
] as const;

export async function isSeasonalPlayEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: SEASONAL_PLAY_FLAG },
    select: { enabled: true },
  });
  return flag?.enabled ?? process.env.NODE_ENV !== "production";
}

export function getSeasonWindow(now = new Date()) {
  const quarter = Math.floor(now.getUTCMonth() / 3);
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 + 3, 1));
  const key = `${startsAt.getUTCFullYear()}-Q${quarter + 1}`;
  return { key, startsAt, endsAt, title: `Season ${key}` };
}

export function getUtcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getUtcWeekKey(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getUtcWeekStart(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

export function getSeasonLevel(xp: number) {
  return Math.floor(Math.max(0, xp) / 100) + 1;
}

export function getSeasonRewards(level: number) {
  return REWARD_LEVELS.map((reward) => ({ ...reward, unlocked: level >= reward.level }));
}

export function scoreMatchPick(state: string, winnerId: string | null, selectionId: string) {
  if (state !== "completed" || !winnerId) return null;
  return winnerId === selectionId ? 5 : 0;
}

export function scoreProScenePick(
  status: string,
  rank: number | null,
  selectionId: string,
  teamId: string | null,
  playerId: string | null,
) {
  if (status !== "completed") return null;
  if (selectionId !== teamId && selectionId !== playerId) return 0;
  if (rank === null || rank < 1) return 0;
  return rank === 1 ? 10 : rank <= 3 ? 5 : 1;
}

export async function ensureCurrentSeason() {
  const now = new Date();
  const window = getSeasonWindow(now);
  return prisma.gameSeason.upsert({
    where: { key: window.key },
    create: { ...window },
    update: {},
  });
}

export function newSeasonInviteCode() {
  return randomBytes(6).toString("base64url").toUpperCase();
}

export async function getSeasonalPlayDashboard(userId: string) {
  const season = await ensureCurrentSeason();
  const now = new Date();
  const weekStart = getUtcWeekStart(now);
  const dayKey = getUtcDayKey(now);
  const weekKey = getUtcWeekKey(now);
  const wallet = await prisma.seasonWallet.upsert({
    where: { seasonId_userId: { seasonId: season.id, userId } },
    create: { seasonId: season.id, userId },
    update: {},
  });
  const [claims, pickCount, leagueMemberships, leaderboard] = await Promise.all([
    prisma.seasonQuestClaim.findMany({
      where: {
        seasonId: season.id,
        userId,
        OR: [
          { questKey: "daily-check-in", periodKey: dayKey },
          { questKey: "weekly-predictions", periodKey: weekKey },
        ],
      },
      select: { questKey: true },
    }),
    prisma.seasonPick.findMany({
      where: { seasonId: season.id, userId, createdAt: { gte: weekStart } },
      distinct: ["eventType", "eventRefId"],
      select: { eventType: true, eventRefId: true },
    }),
    prisma.seasonLeagueMember.findMany({
      where: { userId, league: { seasonId: season.id } },
      take: 10,
      orderBy: { joinedAt: "desc" },
      include: {
        league: {
          include: {
            members: {
              take: 50,
              include: { user: { select: { name: true, profile: { select: { handle: true } } } } },
            },
            picks: { take: 500, orderBy: { createdAt: "desc" } },
          },
        },
      },
    }),
    prisma.seasonWallet.findMany({
      where: { seasonId: season.id },
      orderBy: [{ xp: "desc" }, { points: "desc" }, { updatedAt: "asc" }],
      take: 10,
      include: { user: { select: { name: true, profile: { select: { handle: true } } } } },
    }),
  ]);
  const matchPicks = leagueMemberships.flatMap(({ league }) =>
    league.picks.filter((pick) => pick.eventType === "match"),
  );
  const scenePicks = leagueMemberships.flatMap(({ league }) =>
    league.picks.filter((pick) => pick.eventType === "pro-scene"),
  );
  const [matches, sceneEvents, standings] = await Promise.all([
    prisma.match.findMany({
      where: { id: { in: [...new Set(matchPicks.map((pick) => pick.eventRefId))] } },
      select: { id: true, state: true, winnerRegistrationId: true },
    }),
    prisma.proSceneEvent.findMany({
      where: { id: { in: [...new Set(scenePicks.map((pick) => pick.eventRefId))] } },
      select: { id: true, status: true },
    }),
    prisma.proSceneStanding.findMany({
      where: { eventId: { in: [...new Set(scenePicks.map((pick) => pick.eventRefId))] } },
      select: { eventId: true, teamId: true, playerId: true, rank: true },
    }),
  ]);
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const eventById = new Map(sceneEvents.map((event) => [event.id, event]));
  const standingsByEvent = new Map<string, (typeof standings)[number][]>();
  for (const standing of standings) {
    standingsByEvent.set(standing.eventId, [...(standingsByEvent.get(standing.eventId) ?? []), standing]);
  }
  const leagueResults = leagueMemberships.map(({ league }) => {
    const scores = new Map<string, number>();
    for (const pick of league.picks) {
      let score: number | null = null;
      if (pick.eventType === "match") {
        const event = matchById.get(pick.eventRefId);
        if (event) score = scoreMatchPick(event.state, event.winnerRegistrationId, pick.selectionRefId);
      } else {
        const event = eventById.get(pick.eventRefId);
        const result = standingsByEvent.get(pick.eventRefId)?.find(
          (standing) => standing.teamId === pick.selectionRefId || standing.playerId === pick.selectionRefId,
        );
        if (event) score = scoreProScenePick(event.status, result?.rank ?? null, pick.selectionRefId, result?.teamId ?? null, result?.playerId ?? null);
      }
      if (score !== null) scores.set(pick.userId, (scores.get(pick.userId) ?? 0) + score);
    }
    return {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      ownerId: league.ownerId,
      members: league.members.map((member) => ({
        userId: member.userId,
        name: member.user.profile?.handle ?? member.user.name ?? "Player",
        score: scores.get(member.userId) ?? 0,
      })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
      myPicks: league.picks.filter((pick) => pick.userId === userId),
    };
  });
  const achievements = [
    { key: "first-check-in", unlocked: wallet.lastCheckInAt !== null },
    { key: "week-streak", unlocked: wallet.streak >= 7 },
    { key: "first-pick", unlocked: await prisma.seasonPick.count({ where: { seasonId: season.id, userId } }) > 0 },
    { key: "prediction-winner", unlocked: leagueResults.some((league) => league.members[0]?.userId === userId && league.members[0].score > 0) },
  ];
  await prisma.seasonAchievement.createMany({
    data: achievements.filter((item) => item.unlocked).map((item) => ({ seasonId: season.id, userId, key: item.key })),
    skipDuplicates: true,
  });
  const level = getSeasonLevel(wallet.xp);
  const rewards = getSeasonRewards(level);
  await prisma.seasonRewardClaim.createMany({
    data: rewards.filter((reward) => reward.unlocked).map((reward) => ({ seasonId: season.id, userId, level: reward.level })),
    skipDuplicates: true,
  });
  const matchOptions = await prisma.match.findMany({
    where: {
      state: { notIn: ["completed", "disputed"] },
      startsAt: { gt: now },
      entrantAId: { not: null },
      entrantBId: { not: null },
    },
    take: 20,
    orderBy: { startsAt: "asc" },
    include: {
      tournament: { select: { title: true } },
      entrantA: { select: { id: true, teamName: true, team: { select: { name: true } }, user: { select: { name: true, profile: { select: { handle: true } } } } } },
      entrantB: { select: { id: true, teamName: true, team: { select: { name: true } }, user: { select: { name: true, profile: { select: { handle: true } } } } } },
    },
  });
  const sceneOptions = await prisma.proSceneEvent.findMany({
    where: { status: "upcoming", startsAt: { gt: now } },
    take: 20,
    orderBy: { startsAt: "asc" },
    include: { teams: { include: { team: { select: { id: true, name: true } } } } },
  });
  return {
    season: { id: season.id, key: season.key, title: season.title, startsAt: season.startsAt, endsAt: season.endsAt },
    wallet: { xp: wallet.xp, points: wallet.points, streak: wallet.streak, level },
    quests: {
      dailyCheckIn: { claimed: claims.some((claim) => claim.questKey === "daily-check-in"), xp: 10, points: 10 },
      weeklyPredictions: { claimed: claims.some((claim) => claim.questKey === "weekly-predictions"), eligible: pickCount.length >= 3, picks: pickCount.length, xp: 25, points: 25 },
    },
    rewards,
    achievements,
    leaderboard: leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      name: entry.user.profile?.handle ?? entry.user.name ?? "Player",
      xp: entry.xp,
      points: entry.points,
    })),
    leagues: leagueResults,
    matches: matchOptions.map((match) => ({
      id: match.id,
      title: match.tournament.title,
      startsAt: match.startsAt,
      entrants: [match.entrantA, match.entrantB].flatMap((entrant) => entrant ? [{
        id: entrant.id,
        name: entrant.team?.name ?? entrant.teamName ?? entrant.user?.profile?.handle ?? entrant.user?.name ?? "Entrant",
      }] : []),
    })),
    proSceneEvents: sceneOptions.map((event) => ({
      id: event.id,
      title: event.name,
      startsAt: event.startsAt,
      teams: event.teams.map(({ team }) => ({ id: team.id, name: team.name })),
    })),
    unlockedRewardClaims: await prisma.seasonRewardClaim.findMany({
      where: { seasonId: season.id, userId },
      select: { level: true },
    }),
  };
}
