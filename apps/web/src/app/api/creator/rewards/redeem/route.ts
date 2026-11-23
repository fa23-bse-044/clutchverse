import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";

const redeemSchema = z.object({ rewardId: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parsed = redeemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a reward." }, { status: 400 });
  const reward = await prisma.creatorChannelReward.findUnique({
    where: { id: parsed.data.rewardId },
    select: { id: true, ownerId: true, cost: true, active: true },
  });
  if (!reward?.active) return NextResponse.json({ error: "Reward is unavailable." }, { status: 404 });
  if (reward.ownerId === result.actor.userId) return NextResponse.json({ error: "Creators cannot redeem their own rewards." }, { status: 400 });
  try {
    const redemption = await prisma.$transaction(async (transaction) => {
      await transaction.creatorPointBalance.upsert({
        where: { ownerId_viewerId: { ownerId: reward.ownerId, viewerId: result.actor.userId } },
        create: { ownerId: reward.ownerId, viewerId: result.actor.userId, points: 0 },
        update: {},
      });
      await transaction.$queryRaw`SELECT "id" FROM "CreatorPointBalance" WHERE "ownerId" = ${reward.ownerId} AND "viewerId" = ${result.actor.userId} FOR UPDATE`;
      const balance = await transaction.creatorPointBalance.updateMany({
        where: { ownerId: reward.ownerId, viewerId: result.actor.userId, points: { gte: reward.cost } },
        data: { points: { decrement: reward.cost } },
      });
      if (balance.count !== 1) throw new Error("INSUFFICIENT_CHANNEL_POINTS");
      const saved = await transaction.creatorRewardRedemption.create({
        data: { ownerId: reward.ownerId, viewerId: result.actor.userId, rewardId: reward.id, pointsSpent: reward.cost },
      });
      await transaction.creatorPointTransaction.create({
        data: { ownerId: reward.ownerId, viewerId: result.actor.userId, amount: -reward.cost, reason: "reward-redemption" },
      });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.reward.redeem", targetType: "creator-redemption", targetId: saved.id, metadata: { points: reward.cost } },
      });
      return saved;
    });
    return NextResponse.json({ redemption: { id: redemption.id, status: redemption.status } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CHANNEL_POINTS")
      return NextResponse.json({ error: "Not enough virtual points." }, { status: 409 });
    console.error("Creator reward redemption failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to redeem reward." }, { status: 503 });
  }
}
