import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";

const partySchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(""),
  startsAt: z.string().datetime(),
  streamUrl: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol)).optional(),
  ),
});

export async function GET(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parties = await prisma.creatorWatchParty.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, status: { in: ["scheduled", "live"] } },
    orderBy: { startsAt: "asc" },
    take: 50,
    include: {
      owner: { select: { creatorProfile: { select: { slug: true, displayName: true } } } },
      _count: { select: { participants: true } },
    },
  });
  return NextResponse.json({ parties });
}

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parsed = partySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Watch party details are invalid." }, { status: 400 });
  try {
    const party = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.creatorWatchParty.create({
        data: { ...parsed.data, startsAt: new Date(parsed.data.startsAt), ownerId: result.actor.userId },
      });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.watch-party.create", targetType: "creator-watch-party", targetId: saved.id },
      });
      return saved;
    });
    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    console.error("Creator watch party creation failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to create watch party." }, { status: 503 });
  }
}
