import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";

const rewardSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).default(""),
  cost: z.number().int().min(1).max(1_000_000),
});

export async function GET(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const [rewards, redemptions] = await Promise.all([
    prisma.creatorChannelReward.findMany({ where: { ownerId: result.actor.userId }, orderBy: { createdAt: "desc" } }),
    prisma.creatorRewardRedemption.findMany({
      where: { ownerId: result.actor.userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { viewer: { select: { name: true, email: true } }, reward: { select: { title: true } } },
    }),
  ]);
  return NextResponse.json({ rewards, redemptions });
}

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parsed = rewardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Reward details are invalid." }, { status: 400 });
  try {
    const reward = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.creatorChannelReward.create({ data: { ...parsed.data, ownerId: result.actor.userId } });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.reward.create", targetType: "creator-reward", targetId: saved.id, metadata: { cost: saved.cost } },
      });
      return saved;
    });
    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error("Creator reward creation failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to create reward." }, { status: 503 });
  }
}
