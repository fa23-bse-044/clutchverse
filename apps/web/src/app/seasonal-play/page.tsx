import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SeasonalPlayDashboard } from "@/components/seasonal-play-dashboard";
import { isSeasonalPlayEnabled } from "@/lib/seasonal-play";

export const dynamic = "force-dynamic";
export const metadata = { title: "Season play" };

export default async function SeasonalPlayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/seasonal-play");
  if (!(await isSeasonalPlayEnabled())) notFound();
  return (
    <section className="section page-top">
      <div className="container">
        <SeasonalPlayDashboard />
      </div>
    </section>
  );
}
