import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { AiDraftReview } from "@/components/ai-draft-review";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI draft review" };

export default async function AiDraftReviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/ai-drafts");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") redirect("/");
  return (
    <section className="section page-top">
      <div className="container">
        <AiDraftReview />
      </div>
    </section>
  );
}
