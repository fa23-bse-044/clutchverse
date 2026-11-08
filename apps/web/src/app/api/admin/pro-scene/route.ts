import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  gameSlug: z.enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"]),
  name: z.string().trim().min(2).max(120),
  startsAt: z.string().datetime().optional().or(z.literal("")),
  endsAt: z.string().datetime().optional().or(z.literal("")),
  status: z.enum(["upcoming", "live", "completed"]),
  prizePool: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  stage: z.string().trim().max(80).optional(),
  format: z.string().trim().max(80).optional(),
  sourceName: z.string().trim().min(2).max(100),
  sourceUrl: z.string().url().startsWith("https://"),
  license: z.string().trim().min(2).max(120),
});

async function getAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in required.", status: 401 as const };
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return actor?.role === "ADMIN"
    ? { userId: session.user.id }
    : { error: "Administrator permission required.", status: 403 as const };
}

export async function GET() {
  const actor = await getAdmin();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const events = await prisma.proSceneEvent.findMany({
    orderBy: [{ gameSlug: "asc" }, { startsAt: "desc" }],
  });
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const actor = await getAdmin();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sourced event." },
      { status: 400 },
    );
  }
  const { startsAt, endsAt, ...data } = parsed.data;
  try {
    const event = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.proSceneEvent.create({
        data: {
          ...data,
          startsAt: startsAt ? new Date(startsAt) : null,
          endsAt: endsAt ? new Date(endsAt) : null,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "pro-scene.event.create",
          targetType: "pro-scene-event",
          targetId: saved.id,
          metadata: { gameSlug: saved.gameSlug, sourceName: saved.sourceName },
        },
      });
      return saved;
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Pro Scene event creation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json(
      { error: "Unable to save sourced event." },
      { status: 503 },
    );
  }
}
