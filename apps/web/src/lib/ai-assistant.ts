import { prisma } from "@clutchverse/db";

export const AI_ASSISTANT_FLAG = "ai-coach-smart-assistant";

export async function isAiAssistantEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: AI_ASSISTANT_FLAG },
    select: { enabled: true },
  });
  return flag?.enabled ?? process.env.NODE_ENV !== "production";
}

export function isNewsDraftRequest(message: string) {
  return /\b(?:draft|write|create|compose)\b.{0,60}\b(?:news|article|announcement|recap post)\b|\b(?:news|article|announcement)\b.{0,40}\b(?:draft|write|create)\b/i.test(message);
}

export function isMatchRecapRequest(message: string) {
  return /\b(?:recap|summari[sz]e|review)\b.{0,40}\b(?:my\s+)?(?:match|game|results?)\b|\b(?:match|game)\b.{0,40}\b(?:recap|summary)\b/i.test(message);
}

export function getAssistantMode(message: string) {
  if (isNewsDraftRequest(message)) return "news-draft";
  if (isMatchRecapRequest(message)) return "match-recap";
  if (/\b(?:recommend|suggest|find)\b.{0,50}\b(?:tournament|event)\b/i.test(message)) return "tournament-recommendation";
  if (/\b(?:find|help me find|looking for)\b.{0,60}\b(?:team|scrim|practice partner|squad)\b/i.test(message)) return "team-scrim-helper";
  return "coach";
}

export async function getPersonalAssistantContext(userId: string, message: string) {
  const gameSlug = /\b(?:pubg|bgmi)\b/i.test(message)
    ? "pubg-mobile"
    : /\bfree[\s-]*fire\b/i.test(message)
      ? "free-fire"
      : /\btekken\b/i.test(message)
        ? "tekken-8"
        : /\b(?:ea\s*fc|fifa)\b/i.test(message)
          ? "fifa"
          : undefined;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profile: { select: { handle: true, region: true } } },
  });
  const registrations = await prisma.registration.findMany({
    where: {
      OR: [
        { userId },
        { team: { memberships: { some: { userId } } } },
      ],
    },
    orderBy: { tournament: { startsAt: "desc" } },
    take: 100,
    select: { id: true, tournamentId: true, tournament: { select: { title: true, game: { select: { slug: true } } } } },
  });
  const registrationIds = registrations.map(({ id }) => id);
  const completedMatches = registrationIds.length
    ? await prisma.match.findMany({
        where: {
          state: "completed",
          OR: [
            { entrantAId: { in: registrationIds } },
            { entrantBId: { in: registrationIds } },
          ],
          ...(gameSlug ? { tournament: { game: { slug: gameSlug } } } : {}),
        },
        orderBy: { startsAt: "desc" },
        take: 40,
        select: {
          id: true,
          scoreA: true,
          scoreB: true,
          entrantAId: true,
          entrantBId: true,
          winnerRegistrationId: true,
          startsAt: true,
          entrantA: { select: { id: true, teamName: true, team: { select: { name: true } } } },
          entrantB: { select: { id: true, teamName: true, team: { select: { name: true } } } },
          tournament: { select: { title: true, game: { select: { name: true, slug: true } } } },
        },
      })
    : [];
  const wins = completedMatches.filter((match) =>
    match.winnerRegistrationId !== null && registrationIds.includes(match.winnerRegistrationId),
  ).length;
  const records = registrations.filter((registration) =>
    !gameSlug || registration.tournament.game.slug === gameSlug,
  );
  const upcomingTournaments = await prisma.tournament.findMany({
    where: {
      state: "UPCOMING",
      startsAt: { gt: new Date() },
      ...(gameSlug ? { game: { slug: gameSlug } } : {}),
      ...(user?.profile?.region ? { region: user.profile.region } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 8,
    select: { id: true, title: true, region: true, startsAt: true, game: { select: { name: true, slug: true } } },
  });
  const teams = await prisma.team.findMany({
    where: {
      ...(gameSlug ? { gameSlug } : {}),
      memberships: { none: { userId } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, name: true, gameSlug: true, _count: { select: { memberships: true } } },
  });
  const recent = completedMatches.slice(0, 5);
  const mode = getAssistantMode(message);
  const label = user?.profile?.handle ?? "Player";
  return [
    `Assistant intent: ${mode}.`,
    `Personal context for ${label}: profile region=${user?.profile?.region ?? "not set"}; ${completedMatches.length} confirmed completed matches found (maximum 40); wins=${wins}; registrations considered=${records.length}.`,
    `Confirmed recent matches (recap source; do not infer missing details): ${recent.length
      ? recent.map((match) => {
          const userRegistrationIsA = match.entrantAId !== null && registrationIds.includes(match.entrantAId);
          const userTeam = userRegistrationIsA
            ? match.entrantA?.team?.name ?? match.entrantA?.teamName ?? "Player"
            : match.entrantB?.team?.name ?? match.entrantB?.teamName ?? "Player";
          const opponent = userRegistrationIsA
            ? match.entrantB?.team?.name ?? match.entrantB?.teamName ?? "opponent"
            : match.entrantA?.team?.name ?? match.entrantA?.teamName ?? "opponent";
          const userScore = userRegistrationIsA ? match.scoreA : match.scoreB;
          const opponentScore = userRegistrationIsA ? match.scoreB : match.scoreA;
          const outcome = match.winnerRegistrationId
            ? registrationIds.includes(match.winnerRegistrationId) ? "win" : "loss"
            : "result has no confirmed winner";
          return `${match.tournament.game.name} — ${match.tournament.title}; ${match.startsAt?.toISOString() ?? "date unavailable"}; ${userTeam} vs ${opponent}; score ${userScore ?? "?"}-${opponentScore ?? "?"}; ${outcome}`;
        }).join("; ")
      : "No confirmed match results available."}`,
    `Upcoming tournament recommendations (internal platform data): ${upcomingTournaments.length
      ? upcomingTournaments.map((tournament) => `${tournament.game.name} — ${tournament.title}; ${tournament.region}; starts ${tournament.startsAt.toISOString()}`).join("; ")
      : "No matching upcoming tournaments found."}`,
    `Team directory candidates (not marked as recruiting or scrim-available; never claim availability): ${teams.length
      ? teams.map((team) => `${team.name}; game=${team.gameSlug}; roster size=${team._count.memberships}`).join("; ")
      : "No team directory entries found."}`,
    "Use this data only when relevant, identify it as ClutchVerse platform data, do not claim these teams are recruiting, and ask for game/region/preferences when matching a team or scrim. Do not expose private identifiers or personal account data.",
  ].join("\n").slice(0, 4000);
}
