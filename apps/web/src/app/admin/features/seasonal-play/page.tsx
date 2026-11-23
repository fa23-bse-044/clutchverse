import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { SeasonalPlayFlagPanel } from "@/components/seasonal-play-flag-panel";
import { isSeasonalPlayEnabled, SEASONAL_PLAY_FLAG } from "@/lib/seasonal-play";

export const dynamic = "force-dynamic";
export const metadata = { title: "Season play feature flag" };

export default async function SeasonalPlayFeaturePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/features/seasonal-play");
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "ADMIN") redirect("/");
  const flag = await prisma.featureFlag.findUnique({
    where: { key: SEASONAL_PLAY_FLAG },
    select: { enabled: true },
  });
  return (
    <section className="section page-top">
      <div className="container">
        <SeasonalPlayFlagPanel initialEnabled={flag?.enabled ?? (await isSeasonalPlayEnabled())} />
      </div>
    </section>
  );
}
