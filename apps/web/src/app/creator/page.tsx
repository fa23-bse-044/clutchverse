import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";
import { CreatorStudio } from "@/components/creator-studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator studio" };

export default async function CreatorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/creator");
  if (!(await isCreatorToolsEnabled())) notFound();
  return <section className="section page-top"><div className="container"><CreatorStudio /></div></section>;
}
