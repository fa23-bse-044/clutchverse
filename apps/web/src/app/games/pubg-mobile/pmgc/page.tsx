import { notFound } from "next/navigation";
import { SpotlightEvent } from "@/components/spotlight-event";
import type { SpotlightSnapshot } from "@/components/spotlight-event";
import { findSpotlightConfig } from "@/config/spotlight-events";
import { fetchYoutubeLiveGroup } from "@/lib/youtube-live";
import { getCachedSpotlightSnapshot, isSpotlightEnabled } from "@/lib/spotlight";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "PMGC Spotlight",
  description: "Source-attributed PUBG Mobile Global Championship event data.",
};

export default async function PmgcPage() {
  const config = findSpotlightConfig("pmgc");
  if (!config || !(await isSpotlightEnabled())) notFound();
  const event = await getCachedSpotlightSnapshot(config.slug);
  let streams: Array<{ videoId: string; title: string; channelTitle: string }> = [];
  if (event?.status === "live" && process.env.YOUTUBE_API_KEY) {
    const liveGroup = await fetchYoutubeLiveGroup("pubg-mobile", "en");
    streams = liveGroup.streams.filter((stream) =>
      /pmgc|global championship/i.test(stream.title),
    );
  }
  const initialEvent = event
    ? (JSON.parse(JSON.stringify(event)) as SpotlightSnapshot)
    : null;
  return (
    <SpotlightEvent slug={config.slug} initialEvent={initialEvent} streams={streams} />
  );
}
