import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";

const requestSchema = z.object({
  tournamentId: z.string().min(1).max(64),
  message: z.string().trim().max(500).default(""),
});

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Co-stream request is invalid." }, { status: 400 });
  const creator = await prisma.creatorProfile.findUnique({ where: { userId: result.actor.userId }, select: { coStreamEnabled: true } });
  if (!creator?.coStreamEnabled) return NextResponse.json({ error: "Enable co-stream requests in your creator profile first." }, { status: 403 });
  const tournament = await prisma.tournament.findUnique({ where: { id: parsed.data.tournamentId }, select: { id: true, title: true, organizerId: true } });
  if (!tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  try {
    const saved = await prisma.$transaction(async (transaction) => {
      const requestRow = await transaction.creatorCoStreamRequest.upsert({
        where: { tournamentId_creatorId: { tournamentId: tournament.id, creatorId: result.actor.userId } },
        create: { tournamentId: tournament.id, creatorId: result.actor.userId, message: parsed.data.message },
        update: { status: "pending", message: parsed.data.message },
      });
      await transaction.notification.create({
        data: { userId: tournament.organizerId, type: "creator.costream.request", payload: { requestId: requestRow.id, tournamentId: tournament.id } },
      });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.costream.request", targetType: "tournament", targetId: tournament.id },
      });
      return requestRow;
    });
    return NextResponse.json({ request: { id: saved.id, status: saved.status } }, { status: 201 });
  } catch (error) {
    console.error("Creator co-stream request failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to submit co-stream request." }, { status: 503 });
  }
}
