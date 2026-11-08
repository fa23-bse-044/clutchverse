import { NextResponse } from "next/server";
import { z } from "zod";
import { battleRoyalePoints } from "@clutchverse/core";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";

const scoringSchema = z.object({
  tournamentId: z.string().min(1).max(64),
  round: z.number().int().positive().max(100),
  entries: z
    .array(
      z.object({
        registrationId: z.string().min(1).max(64),
        placement: z.number().int().positive().max(1000),
        eliminations: z.number().int().min(0).max(100),
      }),
    )
    .min(2)
    .max(100)
    .superRefine((entries, context) => {
      if (
        new Set(entries.map(({ registrationId }) => registrationId)).size !==
        entries.length
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate tournament registration.",
        });
      }
    }),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = scoringSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Round scores are invalid." },
      { status: 400 },
    );
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!actor || !["ORGANIZER", "ADMIN"].includes(actor.role)) {
    return NextResponse.json(
      { error: "Organizer permission required." },
      { status: 403 },
    );
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parsed.data.tournamentId },
      include: { game: true },
    });
    if (
      !tournament ||
      !["pubg-mobile", "free-fire"].includes(tournament.game.slug) ||
      !["LIVE", "COMPLETED"].includes(tournament.state)
    ) {
      return NextResponse.json(
        { error: "A live or completed battle-royale event is required." },
        { status: 422 },
      );
    }
    if (actor.role !== "ADMIN" && tournament.organizerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only this event's organizer can submit scores." },
        { status: 403 },
      );
    }
    const registrations = await prisma.registration.findMany({
      where: {
        tournamentId: tournament.id,
        id: {
          in: parsed.data.entries.map(({ registrationId }) => registrationId),
        },
      },
      select: { id: true, userId: true, teamId: true },
    });
    if (registrations.length !== parsed.data.entries.length) {
      return NextResponse.json(
        {
          error: "Every scored entrant must be registered for this tournament.",
        },
        { status: 422 },
      );
    }
    const registrationById = new Map(
      registrations.map((registration) => [registration.id, registration]),
    );
    const updated = await prisma.$transaction(async (transaction) => {
      const results = [];
      for (const entry of parsed.data.entries) {
        const registration = registrationById.get(entry.registrationId);
        if (!registration) throw new Error("REGISTRATION_NOT_FOUND");
        const subjectId = registration.teamId ?? registration.userId;
        const subjectType = registration.teamId ? "team" : "player";
        if (!subjectId) throw new Error("REGISTRATION_HAS_NO_SUBJECT");
        const points = battleRoyalePoints(entry.placement, entry.eliminations);
        const oldScore = await transaction.tournamentScore.findUnique({
          where: {
            tournamentId_round_registrationId: {
              tournamentId: tournament.id,
              round: parsed.data.round,
              registrationId: entry.registrationId,
            },
          },
        });
        const score = await transaction.tournamentScore.upsert({
          where: {
            tournamentId_round_registrationId: {
              tournamentId: tournament.id,
              round: parsed.data.round,
              registrationId: entry.registrationId,
            },
          },
          update: {
            placement: entry.placement,
            eliminations: entry.eliminations,
            points,
          },
          create: {
            tournamentId: tournament.id,
            registrationId: entry.registrationId,
            round: parsed.data.round,
            placement: entry.placement,
            eliminations: entry.eliminations,
            points,
          },
        });
        const rankingKey = {
          gameSlug_subjectId_subjectType_region_period: {
            gameSlug: tournament.game.slug,
            subjectId,
            subjectType,
            region: tournament.region,
            period: "season",
          },
        };
        const existing = await transaction.ranking.findUnique({
          where: rankingKey,
        });
        const totalPoints =
          (existing?.points ?? 0) + points - (oldScore?.points ?? 0);
        const ranking = await transaction.ranking.upsert({
          where: rankingKey,
          update: { points: totalPoints, rating: totalPoints },
          create: {
            gameSlug: tournament.game.slug,
            subjectId,
            subjectType,
            region: tournament.region,
            period: "season",
            points,
            rating: points,
          },
        });
        results.push({
          registrationId: score.registrationId,
          subjectId,
          subjectType,
          points: ranking.points,
          rating: ranking.rating,
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "tournament.scores.submit",
          targetType: "tournament",
          targetId: tournament.id,
          metadata: {
            round: parsed.data.round,
            entries: parsed.data.entries.length,
          },
        },
      });
      return results;
    });

    let cacheSynced = false;
    try {
      const redis = await getRedisClient();
      if (redis) {
        for (const item of updated) {
          await redis.zAdd(
            `rank:${tournament.game.slug}:season:${tournament.region}:${item.subjectType}`,
            { score: item.points, value: item.subjectId },
          );
        }
        const events = await Promise.all(
          updated.map(async (item) => {
            const key = `rank:${tournament.game.slug}:season:${tournament.region}:${item.subjectType}`;
            return {
              ...item,
              rank: (await redis.zRevRank(key, item.subjectId)) ?? 0,
            };
          }),
        );
        await redis.publish(
          "ranking-events",
          JSON.stringify({
            gameSlug: tournament.game.slug,
            period: "season",
            region: tournament.region,
            entries: events,
            updatedAt: new Date().toISOString(),
          }),
        );
        cacheSynced = true;
      }
    } catch (error) {
      console.error(
        "Rankings persisted but Redis synchronization failed.",
        error,
      );
    }
    return NextResponse.json({ results: updated, cacheSynced });
  } catch (error) {
    console.error("Tournament score submission failed.", error);
    return NextResponse.json(
      { error: "Unable to apply tournament scores." },
      { status: 503 },
    );
  }
}
