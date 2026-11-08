import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { ProSceneManager } from "@/components/pro-scene-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage Pro Scene data" };

export default async function AdminProScenePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/pro-scene");
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (actor?.role !== "ADMIN") redirect("/");
  const records = await prisma.proSceneEvent.findMany({
    orderBy: [{ gameSlug: "asc" }, { startsAt: "desc" }],
  });
  return (
    <section className="section page-top">
      <div className="container">
        <div className="eyebrow">ADMIN · SOURCE-ATTRIBUTED DATA</div>
        <h1 className="page-title">Pro Scene records.</h1>
        <p className="page-intro">
          Only publish facts with a verifiable source URL and license. No
          unverified sample teams, players, prizes, or results are supplied.
        </p>
        <ProSceneManager
          initialEvents={records.map((record) => ({
            ...record,
            startsAt: record.startsAt?.toISOString() ?? "",
            endsAt: record.endsAt?.toISOString() ?? "",
            fetchedAt: record.fetchedAt.toISOString(),
          }))}
        />
      </div>
    </section>
  );
}
