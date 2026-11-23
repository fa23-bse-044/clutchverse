import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";

const grantSchema = z.object({
  viewerEmail: z.string().email().max(254),
  amount: z.number().int().min(1).max(10_000),
  reason: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parsed = grantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Point grant details are invalid." }, { status: 400 });
  const viewer = await prisma.user.findUnique({
    where: { email: parsed.data.viewerEmail.toLowerCase() },
    select: { id: true },
  });
  if (!viewer) return NextResponse.json({ error: "Viewer account not found." }, { status: 404 });
  if (viewer.id === result.actor.userId) return NextResponse.json({ error: "You cannot grant points to yourself." }, { status: 400 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.creatorPointBalance.upsert({
        where: { ownerId_viewerId: { ownerId: result.actor.userId, viewerId: viewer.id } },
        create: { ownerId: result.actor.userId, viewerId: viewer.id, points: parsed.data.amount },
        update: { points: { increment: parsed.data.amount } },
      });
      await transaction.creatorPointTransaction.create({
        data: { ownerId: result.actor.userId, viewerId: viewer.id, amount: parsed.data.amount, reason: parsed.data.reason },
      });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.points.grant", targetType: "creator-points", targetId: viewer.id, metadata: { amount: parsed.data.amount } },
      });
    });
    return NextResponse.json({ granted: parsed.data.amount });
  } catch (error) {
    console.error("Creator virtual point grant failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to grant virtual points." }, { status: 503 });
  }
}
