import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(5).max(100),
  gameSlug: z.enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"]),
  format: z.enum([
    "SINGLE_ELIMINATION",
    "DOUBLE_ELIMINATION",
    "ROUND_ROBIN",
    "SWISS",
    "BATTLE_ROYALE",
  ]),
  startsAt: z.string().datetime(),
  region: z.string().trim().min(2).max(40),
  prizePool: z.number().int().min(0).max(100_000_000),
  entryFee: z.number().int().min(0).max(1_000_000).default(0),
});

export async function GET() {
  try {
    const items = await prisma.tournament.findMany({
      include: { game: true, _count: { select: { registrations: true } } },
      orderBy: [{ startsAt: "asc" }, { title: "asc" }],
      take: 100,
    });
    return NextResponse.json({ tournaments: items });
  } catch (error) {
    console.error("Tournament listing failed.", error);
    return NextResponse.json(
      { error: "Tournament service is unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!actor || !["ORGANIZER", "ADMIN"].includes(actor.role)) {
    return NextResponse.json(
      { error: "Organizer permission required." },
      { status: 403 },
    );
  }

  const input = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Tournament details are invalid.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  if (new Date(parsed.data.startsAt).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Start time must be in the future." },
      { status: 400 },
    );
  }
  try {
    const game = await prisma.game.findUnique({
      where: { slug: parsed.data.gameSlug },
      select: { id: true },
    });
    if (!game)
      return NextResponse.json(
        { error: "Game is not configured in the database." },
        { status: 422 },
      );
    const slug = `${parsed.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)}-${randomUUID().slice(0, 8)}`;
    const tournament = await prisma.$transaction(async (transaction) => {
      const created = await transaction.tournament.create({
        data: {
          ...parsed.data,
          slug,
          startsAt: new Date(parsed.data.startsAt),
          gameId: game.id,
          organizerId: session.user.id,
          region: parsed.data.region,
          settings: {
            maxEntries: 128,
            checkInMinutes: 30,
            timezone: "UTC",
            mode: parsed.data.format === "BATTLE_ROYALE" ? "squad" : "solo",
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "tournament.create",
          targetType: "tournament",
          targetId: created.id,
          metadata: { slug: created.slug, format: created.format },
        },
      });
      return created;
    });
    return NextResponse.json({ tournament }, { status: 201 });
  } catch (error) {
    console.error("Tournament creation failed.", error);
    return NextResponse.json(
      { error: "Unable to create tournament." },
      { status: 503 },
    );
  }
}
