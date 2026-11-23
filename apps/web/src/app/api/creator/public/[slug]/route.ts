import { NextResponse } from "next/server";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isCreatorToolsEnabled())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const limit = await checkRateLimit(`creator-public:${getRequestAddress(request)}`, 60, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { slug } = await params;
  const profile = await prisma.creatorProfile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      displayName: true,
      bio: true,
      coStreamEnabled: true,
      userId: true,
      _count: { select: { follows: true } },
      user: {
        select: {
          creatorSchedules: { where: { scheduledAt: { gte: new Date() }, status: "scheduled" }, orderBy: { scheduledAt: "asc" }, take: 10 },
          creatorClips: { where: { visibility: "public" }, orderBy: { createdAt: "desc" }, take: 12, include: { _count: { select: { votes: true } } } },
          creatorRewards: { where: { active: true }, orderBy: { cost: "asc" }, take: 20 },
        },
      },
    },
  });
  if (!profile) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  return NextResponse.json({
    creator: {
      slug: profile.slug,
      displayName: profile.displayName,
      bio: profile.bio,
      coStreamEnabled: profile.coStreamEnabled,
      followers: profile._count.follows,
      schedules: profile.user.creatorSchedules,
      clips: profile.user.creatorClips.map((clip) => ({ id: clip.id, title: clip.title, votes: clip._count.votes, createdAt: clip.createdAt })),
      rewards: profile.user.creatorRewards.map((reward) => ({ id: reward.id, title: reward.title, description: reward.description, cost: reward.cost })),
    },
  });
}
