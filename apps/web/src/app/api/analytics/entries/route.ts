import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isPlayerAnalyticsEnabled } from "@/lib/analytics";

export const runtime = "nodejs";

const entrySchema = z
  .object({
    gameSlug: z.string().min(1).max(64),
    playedAt: z.string().datetime(),
    opponent: z.string().trim().max(120).optional(),
    scoreFor: z.number().int().min(0).max(999).optional(),
    scoreAgainst: z.number().int().min(0).max(999).optional(),
    placement: z.number().int().min(1).max(1000).optional(),
    kills: z.number().int().min(0).max(1000).optional(),
    deaths: z.number().int().min(0).max(1000).optional(),
  })
  .refine(
    (entry) =>
      (entry.scoreFor === undefined) === (entry.scoreAgainst === undefined),
    { message: "Enter both scores or neither." },
  )
  .refine(
    (entry) =>
      entry.scoreFor !== undefined ||
      entry.placement !== undefined ||
      entry.kills !== undefined,
    { message: "At least one result metric is required." },
  );

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isPlayerAnalyticsEnabled()))
    return NextResponse.json({ error: "Analytics are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(
    `analytics:entry:${session.user.id}:${getRequestAddress(request)}`,
    10,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many result entries." }, { status: 429 });
  const body = await request.json().catch(() => null);
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Result details are invalid." }, { status: 400 });
  const game = await prisma.game.findUnique({
    where: { slug: parsed.data.gameSlug },
    select: { slug: true },
  });
  if (!game)
    return NextResponse.json({ error: "Select a supported game." }, { status: 400 });

  try {
    const entry = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.analyticsManualEntry.create({
        data: {
          ...parsed.data,
          playedAt: new Date(parsed.data.playedAt),
          userId: session.user.id,
          opponent: parsed.data.opponent || null,
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "analytics.manual-result.create",
          targetType: "analytics-manual-result",
          targetId: saved.id,
          metadata: { gameSlug: parsed.data.gameSlug },
        },
      });
      return saved;
    });
    return NextResponse.json({ id: entry.id }, { status: 201 });
  } catch (error) {
    console.error("Manual analytics result creation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save this result." }, { status: 503 });
  }
}
