import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { MATCH_LOBBY_FLAG } from "@/lib/match-lobby";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  key: z.literal(MATCH_LOBBY_FLAG),
  enabled: z.boolean(),
});

async function getAdmin(request?: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in required.", status: 401 as const };
  const limit = await checkRateLimit(
    `feature-flags:${session.user.id}:${request ? getRequestAddress(request) : "read"}`,
    30,
    60_000,
  );
  if (!limit.allowed) return { error: "Too many requests.", status: 429 as const };
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return actor?.role === "ADMIN"
    ? { userId: session.user.id }
    : { error: "Administrator permission required.", status: 403 as const };
}

export async function GET(request: Request) {
  const actor = await getAdmin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const stored = await prisma.featureFlag.findUnique({
    where: { key: MATCH_LOBBY_FLAG },
    select: { enabled: true, updatedAt: true },
  });
  return NextResponse.json({
    key: MATCH_LOBBY_FLAG,
    enabled: stored?.enabled ?? process.env.NODE_ENV !== "production",
    updatedAt: stored?.updatedAt ?? null,
  });
}

export async function PATCH(request: Request) {
  const actor = await getAdmin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Feature flag update is invalid." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const flag = await transaction.featureFlag.upsert({
        where: { key: parsed.data.key },
        create: {
          key: parsed.data.key,
          enabled: parsed.data.enabled,
          updatedBy: actor.userId,
        },
        update: {
          enabled: parsed.data.enabled,
          updatedBy: actor.userId,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "feature-flag.update",
          targetType: "feature-flag",
          targetId: parsed.data.key,
          metadata: { enabled: parsed.data.enabled },
        },
      });
      return flag;
    });
    return NextResponse.json({
      key: updated.key,
      enabled: updated.enabled,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Feature flag update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to update feature flag." }, { status: 503 });
  }
}
