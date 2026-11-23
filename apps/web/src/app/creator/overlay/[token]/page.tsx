import { notFound } from "next/navigation";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";
import { CreatorOverlay } from "@/components/creator-overlay";

export const dynamic = "force-dynamic";

export default async function CreatorOverlayPage({ params }: { params: Promise<{ token: string }> }) {
  if (!(await isCreatorToolsEnabled())) notFound();
  const { token } = await params;
  return <CreatorOverlay token={token} />;
}
