import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";
import { ensureCreatorProfile } from "@/lib/creator-tools";

export const runtime = "nodejs";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(500),
  coStreamEnabled: z.boolean(),
});

export async function GET(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  try {
    const profile = await ensureCreatorProfile(result.actor.userId);
    if (!profile) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const [followerCount, schedules, rewards, overlay] = await Promise.all([
      prisma.creatorFollow.count({ where: { creatorProfileId: profile.id } }),
      prisma.creatorStreamSchedule.findMany({
        where: { ownerId: result.actor.userId },
        orderBy: { scheduledAt: "asc" },
        take: 20,
      }),
      prisma.creatorChannelReward.findMany({
        where: { ownerId: result.actor.userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.creatorOverlayToken.findUnique({
        where: { userId: result.actor.userId },
        select: { token: true },
      }),
    ]);
    return NextResponse.json({ profile, followerCount, schedules, rewards, overlayToken: overlay?.token ?? null });
  } catch (error) {
    console.error("Creator profile lookup failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to load creator tools." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Creator profile is invalid." }, { status: 400 });
  try {
    const profile = await ensureCreatorProfile(result.actor.userId);
    if (!profile) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.creatorProfile.update({
        where: { userId: result.actor.userId },
        data: parsed.data,
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.actor.userId,
          action: "creator.profile.update",
          targetType: "creator-profile",
          targetId: saved.id,
        },
      });
      return saved;
    });
    return NextResponse.json({ profile: updated });
  } catch (error) {
    console.error("Creator profile update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save creator profile." }, { status: 503 });
  }
}
