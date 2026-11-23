import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { AnalyticsFlagPanel } from "@/components/analytics-flag-panel";
import { isPlayerAnalyticsEnabled, PLAYER_ANALYTICS_FLAG } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Player analytics feature flag" };

export default async function AnalyticsFeaturePage() {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/login?callbackUrl=/admin/features/analytics");
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "ADMIN") redirect("/");
  const flag = await prisma.featureFlag.findUnique({
    where: { key: PLAYER_ANALYTICS_FLAG },
    select: { enabled: true },
  });
  return (
    <section className="section page-top">
      <div className="container">
        <AnalyticsFlagPanel initialEnabled={flag?.enabled ?? (await isPlayerAnalyticsEnabled())} />
      </div>
    </section>
  );
}
