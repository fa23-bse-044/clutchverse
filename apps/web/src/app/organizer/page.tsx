import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { OrganizerDashboard } from "@/components/organizer-dashboard";

export const metadata = { title: "Organizer dashboard" };

export default async function OrganizerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/organizer");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!user || !["ORGANIZER", "ADMIN"].includes(user.role)) redirect("/");
  return <section className="section page-top"><div className="container"><div className="eyebrow">EVENT OPERATIONS</div><h1 className="page-title">Organizer dashboard.</h1><p className="page-intro">Create tournaments, review your event schedule, and manage competition details.</p><OrganizerDashboard /></div></section>;
}
