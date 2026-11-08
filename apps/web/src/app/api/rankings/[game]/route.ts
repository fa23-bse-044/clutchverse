import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const gameSchema = z.enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"]);
const querySchema = z.object({
  period: z.enum(["daily", "weekly", "season", "all-time"]).default("season"),
  region: z.string().trim().min(2).max(32).default("Global"),
  type: z.enum(["player", "team"]).default("player"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ game: string }> },
) {
  const { game: inputGame } = await params;
  const game = gameSchema.safeParse(inputGame);
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!game.success || !query.success)
    return NextResponse.json(
      { error: "Ranking filters are invalid." },
      { status: 400 },
    );
  let source: "redis" | "database" = "database";
  let subjects: { id: string; score?: number }[] = [];
  try {
    const redis = await getRedisClient();
    if (redis) {
      try {
        const sorted = await redis.zRangeWithScores(
          `rank:${game.data}:${query.data.period}:${query.data.region}:${query.data.type}`,
          0,
          49,
          { REV: true },
        );
        if (sorted.length) {
          subjects = sorted.map(({ value, score }) => ({ id: value, score }));
          source = "redis";
        }
      } catch (error) {
        console.error("Redis ranking read failed; querying PostgreSQL.", error);
      }
    }

    const where = {
      gameSlug: game.data,
      subjectType: query.data.type,
      period: query.data.period,
      region: query.data.region,
    };
    const records = subjects.length
      ? await prisma.ranking.findMany({
          where: { ...where, subjectId: { in: subjects.map(({ id }) => id) } },
        })
      : await prisma.ranking.findMany({
          where,
          orderBy: [{ points: "desc" }, { rating: "desc" }],
          take: 50,
        });
    const byId = new Map(records.map((record) => [record.subjectId, record]));
    const ordered = subjects.length
      ? subjects.flatMap(({ id }) => {
          const record = byId.get(id);
          return record ? [record] : [];
        })
      : records;
    const ids = ordered.map(({ subjectId }) => subjectId);
    const nameById = new Map<string, { name: string; region: string }>();
    if (query.data.type === "player") {
      const profiles = await prisma.playerProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, handle: true, region: true },
      });
      for (const profile of profiles)
        nameById.set(profile.userId, {
          name: profile.handle,
          region: profile.region,
        });
    } else {
      const teams = await prisma.team.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      for (const team of teams)
        nameById.set(team.id, { name: team.name, region: query.data.region });
    }
    return NextResponse.json({
      source,
      updatedAt: new Date().toISOString(),
      entries: ordered.flatMap((record, index) => {
        const subject = nameById.get(record.subjectId);
        if (!subject) return [];
        return [
          {
            rank: index + 1,
            subjectId: record.subjectId,
            name: subject.name,
            region: subject.region,
            rating: record.rating,
            points: record.points,
          },
        ];
      }),
    });
  } catch (error) {
    console.error("Leaderboard query failed.", error);
    return NextResponse.json(
      { error: "Leaderboard is unavailable." },
      { status: 503 },
    );
  }
}
