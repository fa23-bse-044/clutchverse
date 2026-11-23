import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { AiAssistantFlagPanel } from "@/components/ai-assistant-flag-panel";
import { AI_ASSISTANT_FLAG, isAiAssistantEnabled } from "@/lib/ai-assistant";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI assistant feature flag" };

export default async function AiAssistantFeaturePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/features/ai-assistant");
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (admin?.role !== "ADMIN") redirect("/");
  const flag = await prisma.featureFlag.findUnique({ where: { key: AI_ASSISTANT_FLAG }, select: { enabled: true } });
  return (
    <section className="section page-top">
      <div className="container">
        <AiAssistantFlagPanel initialEnabled={flag?.enabled ?? (await isAiAssistantEnabled())} />
      </div>
    </section>
  );
}
