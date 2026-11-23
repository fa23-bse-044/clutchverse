import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { SPOTLIGHT_FLAG } from "@/lib/spotlight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({ enabled: z.boolean() });

async function admin(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  const limit = await checkRateLimit(
    `spotlight-admin:${session.user.id}:${getRequestAddress(request)}`,
    30,
    60_000,
  );
  if (!limit.allowed)
    return { error: "Too many requests.", status: 429 as const };
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return actor?.role === "ADMIN"
    ? { userId: session.user.id }
    : { error: "Administrator permission required.", status: 403 as const };
}

export async function GET(request: Request) {
  const actor = await admin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const flag = await prisma.featureFlag.findUnique({
    where: { key: SPOTLIGHT_FLAG },
    select: { enabled: true, updatedAt: true },
  });
  return NextResponse.json({
    key: SPOTLIGHT_FLAG,
    enabled: flag?.enabled ?? false,
    updatedAt: flag?.updatedAt ?? null,
  });
}

export async function PATCH(request: Request) {
  const actor = await admin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Feature flag update is invalid." }, { status: 400 });
  try {
    const flag = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.featureFlag.upsert({
        where: { key: SPOTLIGHT_FLAG },
        create: {
          key: SPOTLIGHT_FLAG,
          enabled: parsed.data.enabled,
          updatedBy: actor.userId,
        },
        update: { enabled: parsed.data.enabled, updatedBy: actor.userId },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "spotlight.flag.update",
          targetType: "feature-flag",
          targetId: SPOTLIGHT_FLAG,
          metadata: { enabled: parsed.data.enabled },
        },
      });
      return updated;
    });
    return NextResponse.json({
      key: flag.key,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt,
    });
  } catch (error) {
    console.error("Spotlight flag update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to update spotlight flag." }, { status: 503 });
  }
}
