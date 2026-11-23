import { NextResponse } from "next/server";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";
import { newCreatorToken } from "@/lib/creator-tools";

export async function GET(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const token = await prisma.creatorOverlayToken.findUnique({
    where: { userId: result.actor.userId },
    select: { token: true },
  });
  return NextResponse.json({ token: token?.token ?? null });
}

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  try {
    const saved = await prisma.$transaction(async (transaction) => {
      const token = await transaction.creatorOverlayToken.upsert({
        where: { userId: result.actor.userId },
        create: { userId: result.actor.userId, token: newCreatorToken() },
        update: { token: newCreatorToken() },
      });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.overlay-token.rotate", targetType: "creator-overlay", targetId: token.id },
      });
      return token;
    });
    return NextResponse.json({ token: saved.token });
  } catch (error) {
    console.error("Creator overlay token rotation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to create overlay URL." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  await prisma.$transaction(async (transaction) => {
    await transaction.creatorOverlayToken.deleteMany({ where: { userId: result.actor.userId } });
    await transaction.auditLog.create({
      data: { actorId: result.actor.userId, action: "creator.overlay-token.revoke", targetType: "creator-overlay", targetId: result.actor.userId },
    });
  });
  return NextResponse.json({ revoked: true });
}
