import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { GameRecordManager } from "@/components/game-record-manager";

export const metadata = { title: "Manage community records" };
export const dynamic = "force-dynamic";

export default async function AdminGameRecordsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/game-records");
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (actor?.role !== "ADMIN") redirect("/");
  const records = await prisma.gameRecord.findMany({
    orderBy: [{ gameSlug: "asc" }, { achievedAt: "desc" }],
  });
  return (
    <section className="section page-top">
      <div className="container">
        <div className="eyebrow">ADMIN · COMMUNITY DATA</div>
        <h1 className="page-title">Game records.</h1>
        <p className="page-intro">
          Curate community-submitted records. Public listings are always labeled
          community-verified and are not publisher records.
        </p>
        <GameRecordManager
          initialRecords={records.map((record) => ({
            ...record,
            achievedAt: record.achievedAt.toISOString(),
          }))}
        />
      </div>
    </section>
  );
}
