import { NextResponse } from "next/server";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlatformStats = { players: number; liveEvents: number; prizePool: number };

const seededFallback: PlatformStats = {
  players: 8,
  liveEvents: 1,
  prizePool: 4_550_000,
};

type StatsGlobal = typeof globalThis & {
  clutchVerseLastGoodStats?: PlatformStats;
};
const statsGlobal = globalThis as StatsGlobal;

export async function GET() {
  try {
    const [players, liveEvents, prizePool] = await Promise.all([
      prisma.playerProfile.count(),
      prisma.tournament.count({ where: { state: "LIVE" } }),
      prisma.tournament.aggregate({
        where: { state: { in: ["UPCOMING", "LIVE"] } },
        _sum: { prizePool: true },
      }),
    ]);
    const stats = {
      players,
      liveEvents,
      prizePool: prizePool._sum.prizePool ?? 0,
    };
    statsGlobal.clutchVerseLastGoodStats = stats;
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.warn(
      "Platform counter query failed; serving cached or seeded counters.",
      error,
    );
    return NextResponse.json(
      statsGlobal.clutchVerseLastGoodStats ?? seededFallback,
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
