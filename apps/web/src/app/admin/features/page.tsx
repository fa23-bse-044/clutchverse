import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { FeatureFlagPanel } from "@/components/feature-flag-panel";
import { CreatorToolsAdminLink } from "@/components/creator-tools-flag-panel";
import { MATCH_LOBBY_FLAG } from "@/lib/match-lobby";
import { AnalyticsFeatureFlagLink } from "@/components/analytics-flag-panel";
import { SeasonalPlayAdminLink } from "@/components/seasonal-play-flag-panel";
import { AiAssistantAdminLink } from "@/components/ai-assistant-flag-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feature flags" };

export default async function AdminFeaturesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/features");
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (actor?.role !== "ADMIN") redirect("/");
  const flag = await prisma.featureFlag.findUnique({
    where: { key: MATCH_LOBBY_FLAG },
    select: { enabled: true },
  });
  return (
    <section className="section page-top">
      <div className="container">
        <div className="eyebrow">ADMIN · PLATFORM CONTROLS</div>
        <h1 className="page-title">Feature flags.</h1>
        <p className="page-intro">
          New feature routes remain unavailable when their flag is off.
        </p>
        <FeatureFlagPanel
          initialEnabled={flag?.enabled ?? process.env.NODE_ENV !== "production"}
        />
        <p className="panel admin-panel"><CreatorToolsAdminLink /></p>
        <p className="panel admin-panel"><AnalyticsFeatureFlagLink /></p>
        <p className="panel admin-panel"><SeasonalPlayAdminLink /></p>
        <p className="panel admin-panel"><AiAssistantAdminLink /></p>
      </div>
    </section>
  );
}
