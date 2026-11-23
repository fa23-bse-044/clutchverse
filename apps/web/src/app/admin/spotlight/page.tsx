import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { SpotlightAdmin } from "@/components/spotlight-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage event spotlight" };

export default async function AdminSpotlightPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/spotlight");
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (actor?.role !== "ADMIN") redirect("/");
  return (
    <section className="section page-top">
      <div className="container">
        <SpotlightAdmin />
      </div>
    </section>
  );
}
