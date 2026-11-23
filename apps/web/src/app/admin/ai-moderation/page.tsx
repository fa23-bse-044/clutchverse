import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { AiModerationQueue } from "@/components/ai-moderation-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI moderation review" };

export default async function AiModerationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/ai-moderation");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) redirect("/");
  return (
    <section className="section page-top">
      <div className="container">
        <AiModerationQueue />
      </div>
    </section>
  );
}
