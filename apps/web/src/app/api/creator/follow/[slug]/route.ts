import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";

async function authorize(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) } as const;
  if (!(await isCreatorToolsEnabled())) return { error: NextResponse.json({ error: "Creator tools are unavailable." }, { status: 404 }) } as const;
  const limit = await checkRateLimit(`creator-follow:${session.user.id}:${getRequestAddress(request)}`, 20, 60_000);
  if (!limit.allowed) return { error: NextResponse.json({ error: "Too many requests." }, { status: 429 }) } as const;
  return { userId: session.user.id } as const;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await authorize(request);
  if ("error" in actor) return actor.error;
  const { slug } = await params;
  const creator = await prisma.creatorProfile.findUnique({ where: { slug }, select: { id: true, userId: true } });
  if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  if (creator.userId === actor.userId) return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.creatorFollow.upsert({
        where: { followerId_creatorProfileId: { followerId: actor.userId, creatorProfileId: creator.id } },
        create: { followerId: actor.userId, creatorProfileId: creator.id },
        update: {},
      });
      await transaction.notification.create({
        data: {
          userId: creator.userId,
          type: "creator.follow",
          payload: { followerId: actor.userId, creatorSlug: slug },
        },
      });
      await transaction.auditLog.create({
        data: { actorId: actor.userId, action: "creator.follow", targetType: "creator-profile", targetId: creator.id },
      });
    });
    return NextResponse.json({ following: true });
  } catch (error) {
    console.error("Creator follow failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to follow creator." }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await authorize(request);
  if ("error" in actor) return actor.error;
  const { slug } = await params;
  const creator = await prisma.creatorProfile.findUnique({ where: { slug }, select: { id: true } });
  if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  await prisma.$transaction(async (transaction) => {
    await transaction.creatorFollow.deleteMany({
      where: { followerId: actor.userId, creatorProfileId: creator.id },
    });
    await transaction.auditLog.create({
      data: { actorId: actor.userId, action: "creator.unfollow", targetType: "creator-profile", targetId: creator.id },
    });
  });
  return NextResponse.json({ following: false });
}
