import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { PLAYER_ANALYTICS_FLAG } from "@/lib/analytics";

export const runtime = "nodejs";

const updateSchema = z.object({ enabled: z.boolean() });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const limit = await checkRateLimit(
    `analytics-flag:${session.user.id}:${getRequestAddress(request)}`,
    10,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "ADMIN")
    return NextResponse.json({ error: "Administrator permission required." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Feature flag update is invalid." }, { status: 400 });
  try {
    const flag = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.featureFlag.upsert({
        where: { key: PLAYER_ANALYTICS_FLAG },
        create: {
          key: PLAYER_ANALYTICS_FLAG,
          enabled: parsed.data.enabled,
          updatedBy: session.user.id,
        },
        update: {
          enabled: parsed.data.enabled,
          updatedBy: session.user.id,
        },
        select: { enabled: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "feature-flag.update",
          targetType: "feature-flag",
          targetId: PLAYER_ANALYTICS_FLAG,
          metadata: { enabled: parsed.data.enabled },
        },
      });
      return saved;
    });
    return NextResponse.json(flag);
  } catch (error) {
    console.error("Analytics feature flag update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to update the feature flag." }, { status: 503 });
  }
}
