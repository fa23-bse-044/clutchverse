import { notFound } from "next/navigation";
import { SpotlightTeamPage } from "@/components/spotlight-team";
import type { SpotlightSnapshot } from "@/components/spotlight-event";
import { getCachedSpotlightSnapshot, isSpotlightEnabled } from "@/lib/spotlight";

export const dynamic = "force-dynamic";

export default async function PmgcTeamPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  if (!(await isSpotlightEnabled())) notFound();
  const { teamSlug } = await params;
  const event = await getCachedSpotlightSnapshot("pmgc");
  if (!event) notFound();
  const participation = event.participants.find((item) => item.team.slug === teamSlug);
  if (!participation) notFound();
  const serializedEvent = JSON.parse(JSON.stringify(event)) as SpotlightSnapshot;
  const serializedParticipation = serializedEvent.participants.find(
    (item) => item.team.slug === teamSlug,
  );
  if (!serializedParticipation) notFound();
  return (
    <SpotlightTeamPage
      event={serializedEvent}
      participation={serializedParticipation}
    />
  );
}
