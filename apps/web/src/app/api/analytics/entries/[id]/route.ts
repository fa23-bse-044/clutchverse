import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isPlayerAnalyticsEnabled } from "@/lib/analytics";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isPlayerAnalyticsEnabled()))
    return NextResponse.json({ error: "Analytics are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(
    `analytics:entry-delete:${session.user.id}:${getRequestAddress(request)}`,
    10,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  const entry = await prisma.analyticsManualEntry.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!entry)
    return NextResponse.json({ error: "Result not found." }, { status: 404 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.analyticsManualEntry.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "analytics.manual-result.delete",
          targetType: "analytics-manual-result",
          targetId: id,
        },
      });
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Manual analytics result deletion failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to remove this result." }, { status: 503 });
  }
}
