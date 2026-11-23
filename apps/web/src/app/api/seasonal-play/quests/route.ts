import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getSeasonalPlayActor } from "@/lib/seasonal-play-api";
import {
  ensureCurrentSeason,
  getUtcDayKey,
  getUtcWeekKey,
  getUtcWeekStart,
} from "@/lib/seasonal-play";

const schema = z.object({ quest: z.enum(["daily-check-in", "weekly-predictions"]) });

export async function POST(request: Request) {
  const result = await getSeasonalPlayActor(request);
  if ("error" in result) return result.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Quest is invalid." }, { status: 400 });
  const now = new Date();
  const season = await ensureCurrentSeason();
  const questKey = parsed.data.quest;
  const periodKey = questKey === "daily-check-in" ? getUtcDayKey(now) : getUtcWeekKey(now);
  const xpAward = questKey === "daily-check-in" ? 10 : 25;
  const pointsAward = xpAward;
  try {
    if (questKey === "weekly-predictions") {
      const picks = await prisma.seasonPick.findMany({
        where: {
          seasonId: season.id,
          userId: result.actor.userId,
          createdAt: { gte: getUtcWeekStart(now) },
        },
        distinct: ["eventType", "eventRefId"],
        select: { eventType: true, eventRefId: true },
      });
      if (picks.length < 3) {
        return NextResponse.json({ error: "Complete three distinct picks this week first." }, { status: 400 });
      }
    }
    await prisma.$transaction(async (transaction) => {
      const wallet = await transaction.seasonWallet.upsert({
        where: { seasonId_userId: { seasonId: season.id, userId: result.actor.userId } },
        create: { seasonId: season.id, userId: result.actor.userId },
        update: {},
      });
      const previousDay = wallet.lastCheckInAt ? getUtcDayKey(wallet.lastCheckInAt) : null;
      const yesterday = getUtcDayKey(new Date(now.getTime() - 86_400_000));
      const nextStreak = questKey !== "daily-check-in"
        ? wallet.streak
        : previousDay === yesterday ? wallet.streak + 1 : wallet.streak || 1;
      await transaction.seasonQuestClaim.create({
        data: { seasonId: season.id, userId: result.actor.userId, questKey, periodKey, xpAward, pointsAward },
      });
      await transaction.seasonWallet.update({
        where: { id: wallet.id },
        data: {
          xp: { increment: xpAward },
          points: { increment: pointsAward },
          ...(questKey === "daily-check-in" ? { streak: nextStreak, lastCheckInAt: now } : {}),
        },
      });
      if (pointsAward > 0) {
        await transaction.seasonPointTransaction.create({
          data: {
            seasonId: season.id,
            userId: result.actor.userId,
            amount: pointsAward,
            reason: "quest",
            referenceKey: `${questKey}:${periodKey}`,
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: result.actor.userId,
          action: "seasonal-play.quest.claim",
          targetType: "season-quest",
          targetId: `${questKey}:${periodKey}`,
          metadata: { seasonId: season.id, xpAward, pointsAward },
        },
      });
    });
    return NextResponse.json({ claimed: true, xpAward, pointsAward });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This quest has already been claimed for this period." }, { status: 409 });
    }
    console.error("Seasonal quest claim failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to claim this quest." }, { status: 503 });
  }
}
