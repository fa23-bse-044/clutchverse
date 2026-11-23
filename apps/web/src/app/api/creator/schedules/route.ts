import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";

const scheduleSchema = z.object({
  title: z.string().trim().min(2).max(120),
  gameSlug: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(64).optional()),
  scheduledAt: z.string().datetime(),
  streamUrl: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol)).optional(),
  ),
});

export async function GET(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const schedules = await prisma.creatorStreamSchedule.findMany({
    where: { ownerId: result.actor.userId },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });
  return NextResponse.json({ schedules });
}

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Schedule details are invalid." }, { status: 400 });
  try {
    const schedule = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.creatorStreamSchedule.create({
        data: { ...parsed.data, scheduledAt: new Date(parsed.data.scheduledAt), ownerId: result.actor.userId },
      });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.schedule.create", targetType: "creator-schedule", targetId: saved.id },
      });
      return saved;
    });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error("Creator stream schedule creation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to schedule stream." }, { status: 503 });
  }
}
