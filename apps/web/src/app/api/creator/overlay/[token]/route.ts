import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";

const typeSchema = z.enum(["scoreboard", "bracket", "ticker", "lower-third", "standings"]);

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await isCreatorToolsEnabled())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { token } = await params;
  const limit = await checkRateLimit(`creator-overlay:${token}:${getRequestAddress(request)}`, 60, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const overlay = await prisma.creatorOverlayToken.findUnique({
    where: { token },
    select: { userId: true, user: { select: { name: true, profile: { select: { handle: true } } } } },
  });
  if (!overlay) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const requestedType = new URL(request.url).searchParams.get("type");
  const parsedType = typeSchema.safeParse(requestedType ?? "ticker");
  if (!parsedType.success) return NextResponse.json({ error: "Overlay type is invalid." }, { status: 400 });
  const type = parsedType.data;

  if (type === "lower-third") {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: overlay.userId },
      select: { displayName: true, bio: true, slug: true },
    });
    return NextResponse.json({ type, name: profile?.displayName ?? overlay.user.profile?.handle ?? overlay.user.name ?? null, subtitle: profile?.bio ?? "" });
  }
  if (type === "standings") {
    const rankings = await prisma.ranking.findMany({
      where: { subjectType: "team", period: "season" },
      orderBy: { rating: "desc" },
      take: 10,
      select: { subjectId: true, gameSlug: true, rating: true, points: true },
    });
    const ids = rankings.map((ranking) => ranking.subjectId);
    const teams = await prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const names = new Map(teams.map((team) => [team.id, team.name]));
    return NextResponse.json({ type, entries: rankings.map((item, index) => ({ rank: index + 1, name: names.get(item.subjectId) ?? null, game: item.gameSlug, rating: item.rating, points: item.points })) });
  }
  if (type === "bracket") {
    const tournament = await prisma.tournament.findFirst({
      where: { state: "LIVE" },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, matches: { orderBy: [{ round: "asc" }, { position: "asc" }], take: 32, select: { round: true, position: true, scoreA: true, scoreB: true, state: true, entrantA: { select: { teamName: true, team: { select: { name: true } } } }, entrantB: { select: { teamName: true, team: { select: { name: true } } } } } } },
    });
    return NextResponse.json({ type, tournament: tournament?.title ?? null, matches: tournament?.matches.map((match) => ({ round: match.round, position: match.position, state: match.state, entrantA: match.entrantA?.team?.name ?? match.entrantA?.teamName ?? null, entrantB: match.entrantB?.team?.name ?? match.entrantB?.teamName ?? null, scoreA: match.scoreA, scoreB: match.scoreB })) ?? [] });
  }

  const matches = await prisma.match.findMany({
    where: { state: type === "scoreboard" ? { in: ["live", "LIVE", "completed"] } : "completed" },
    orderBy: { startsAt: "desc" },
    take: type === "scoreboard" ? 1 : 8,
    select: { scoreA: true, scoreB: true, startsAt: true, tournament: { select: { title: true } }, entrantA: { select: { teamName: true, team: { select: { name: true } } } }, entrantB: { select: { teamName: true, team: { select: { name: true } } } } },
  });
  return NextResponse.json({
    type,
    entries: matches.map((match) => ({
      title: match.tournament.title,
      startsAt: match.startsAt?.toISOString() ?? null,
      entrantA: match.entrantA?.team?.name ?? match.entrantA?.teamName ?? null,
      entrantB: match.entrantB?.team?.name ?? match.entrantB?.teamName ?? null,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
    })),
  });
}
