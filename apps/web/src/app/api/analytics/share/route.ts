import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isPlayerAnalyticsEnabled } from "@/lib/analytics";

export const runtime = "nodejs";

async function getActor(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  if (!(await isPlayerAnalyticsEnabled()))
    return { error: "Analytics are unavailable.", status: 404 as const };
  const limit = await checkRateLimit(
    `analytics:share:${session.user.id}:${getRequestAddress(request)}`,
    5,
    60_000,
  );
  if (!limit.allowed)
    return { error: "Too many share-link requests.", status: 429 as const };
  return { userId: session.user.id };
}

export async function POST(request: Request) {
  const actor = await getActor(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  try {
    const token = randomBytes(32).toString("base64url");
    const share = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.analyticsShareCard.upsert({
        where: { userId: actor.userId },
        create: { userId: actor.userId, token },
        update: { token },
        select: { token: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "analytics.share-card.create",
          targetType: "analytics-share-card",
          targetId: actor.userId,
        },
      });
      return saved;
    });
    return NextResponse.json({ token: share.token });
  } catch (error) {
    console.error("Analytics share link creation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to create a share link." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const actor = await getActor(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.analyticsShareCard.deleteMany({
        where: { userId: actor.userId },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "analytics.share-card.revoke",
          targetType: "analytics-share-card",
          targetId: actor.userId,
        },
      });
    });
    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error("Analytics share link revocation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to revoke the share link." }, { status: 503 });
  }
}
