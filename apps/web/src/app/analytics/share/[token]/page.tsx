import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@clutchverse/db";
import { isPlayerAnalyticsEnabled, getPlayerAnalytics } from "@/lib/analytics";
import { PublicAnalyticsCard } from "@/components/analytics-dashboard";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export default async function SharedAnalyticsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!(await isPlayerAnalyticsEnabled())) notFound();
  const { token } = await params;
  const incomingHeaders = await headers();
  const address =
    incomingHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    incomingHeaders.get("x-real-ip") ??
    "unknown";
  const limit = await checkRateLimit(
    `analytics:share-read:${token}:${address}`,
    30,
    60_000,
  );
  if (!limit.allowed) notFound();
  const share = await prisma.analyticsShareCard.findUnique({
    where: { token },
    select: { userId: true, user: { select: { profile: { select: { handle: true } } } } },
  });
  if (!share) notFound();
  const data = await getPlayerAnalytics(share.userId);
  return (
    <section className="section page-top">
      <div className="container">
        <PublicAnalyticsCard handle={share.user.profile?.handle ?? null} summary={data.summary} />
      </div>
    </section>
  );
}
