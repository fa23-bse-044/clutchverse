import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { CreatorToolsFlagPanel } from "@/components/creator-tools-flag-panel";
import { CREATOR_TOOLS_FLAG } from "@/lib/creator-tools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator tools feature flag" };

export default async function CreatorToolsFeaturePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/features/creator-tools");
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (admin?.role !== "ADMIN") redirect("/");
  const flag = await prisma.featureFlag.findUnique({ where: { key: CREATOR_TOOLS_FLAG }, select: { enabled: true } });
  return (
    <section className="section page-top"><div className="container">
      <CreatorToolsFlagPanel initialEnabled={flag?.enabled ?? process.env.NODE_ENV !== "production"} />
    </div></section>
  );
}
