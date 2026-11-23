import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isCreatorToolsEnabled())) return NextResponse.json({ error: "Creator tools are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(`creator-party-join:${session.user.id}:${getRequestAddress(request)}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  const party = await prisma.creatorWatchParty.findFirst({ where: { id, status: { in: ["scheduled", "live"] } }, select: { id: true, ownerId: true } });
  if (!party) return NextResponse.json({ error: "Watch party not found." }, { status: 404 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.creatorWatchPartyParticipant.upsert({
        where: { watchPartyId_userId: { watchPartyId: id, userId: session.user.id } },
        create: { watchPartyId: id, userId: session.user.id },
        update: {},
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "creator.watch-party.join", targetType: "creator-watch-party", targetId: id },
      });
    });
    return NextResponse.json({ joined: true });
  } catch (error) {
    console.error("Creator watch-party join failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to join watch party." }, { status: 503 });
  }
}
