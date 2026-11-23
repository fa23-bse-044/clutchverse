import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlayerAnalyticsEnabled } from "@/lib/analytics";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Player & team analytics" };

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/analytics");
  if (!(await isPlayerAnalyticsEnabled())) notFound();
  return (
    <section className="section page-top">
      <div className="container">
        <AnalyticsDashboard />
      </div>
    </section>
  );
}
