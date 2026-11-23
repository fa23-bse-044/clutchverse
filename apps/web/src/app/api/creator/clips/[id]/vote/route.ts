import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isCreatorToolsEnabled())) return NextResponse.json({ error: "Creator tools are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(`creator-clip-vote:${session.user.id}:${getRequestAddress(request)}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many votes." }, { status: 429 });
  const { id } = await params;
  const clip = await prisma.creatorClip.findFirst({
    where: { id, visibility: "public", owner: { creatorProfile: { isNot: null } }, ownerId: { not: session.user.id } },
    select: { id: true },
  });
  if (!clip) return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.creatorClipVote.upsert({
        where: { clipId_userId: { clipId: id, userId: session.user.id } },
        create: { clipId: id, userId: session.user.id },
        update: { value: 1 },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "creator.clip.vote", targetType: "creator-clip", targetId: id },
      });
    });
    return NextResponse.json({ voted: true });
  } catch (error) {
    console.error("Creator clip vote failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to vote for this clip." }, { status: 503 });
  }
}
