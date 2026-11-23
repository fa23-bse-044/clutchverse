import { notFound } from "next/navigation";
import { prisma } from "@clutchverse/db";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";
import { CreatorPublicProfile } from "@/components/creator-public-profile";

export const dynamic = "force-dynamic";

export default async function CreatorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isCreatorToolsEnabled())) notFound();
  const { slug } = await params;
  const profile = await prisma.creatorProfile.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, displayName: true, bio: true, userId: true,
      _count: { select: { follows: true } },
      user: {
        select: {
          creatorSchedules: { where: { scheduledAt: { gte: new Date() }, status: "scheduled" }, orderBy: { scheduledAt: "asc" }, take: 10 },
          creatorWatchParties: { where: { startsAt: { gte: new Date() }, status: "scheduled" }, orderBy: { startsAt: "asc" }, take: 10, include: { _count: { select: { participants: true } } } },
          creatorClips: { where: { visibility: "public" }, orderBy: { createdAt: "desc" }, take: 12, include: { _count: { select: { votes: true } } } },
          creatorRewards: { where: { active: true }, orderBy: { cost: "asc" }, take: 20 },
        },
      },
    },
  });
  if (!profile) notFound();
  return <section className="section page-top"><div className="container">
    <CreatorPublicProfile creator={{
      userId: profile.userId,
      slug: profile.slug,
      displayName: profile.displayName,
      bio: profile.bio,
      followers: profile._count.follows,
      schedules: profile.user.creatorSchedules.map((item) => ({ id: item.id, title: item.title, scheduledAt: item.scheduledAt.toISOString(), streamUrl: item.streamUrl })),
      parties: profile.user.creatorWatchParties.map((party) => ({ id: party.id, title: party.title, description: party.description, startsAt: party.startsAt.toISOString(), participants: party._count.participants })),
      clips: profile.user.creatorClips.map((clip) => ({ id: clip.id, title: clip.title, votes: clip._count.votes, trimStartMs: clip.trimStartMs, trimEndMs: clip.trimEndMs })),
      rewards: profile.user.creatorRewards.map((reward) => ({ id: reward.id, title: reward.title, description: reward.description, cost: reward.cost })),
    }} />
  </div></section>;
}
