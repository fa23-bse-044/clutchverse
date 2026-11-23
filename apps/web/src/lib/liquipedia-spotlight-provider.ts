import type { SpotlightProvider } from "@/lib/spotlight-provider";

type UnavailableRecord = Record<string, never>;

export const liquipediaSpotlightProvider: SpotlightProvider<
  UnavailableRecord,
  UnavailableRecord,
  UnavailableRecord,
  UnavailableRecord,
  UnavailableRecord
> = {
  sourceName: "Liquipedia LPDB",
  async event() {
    return null;
  },
  async participants() {
    return { data: [], source: unavailableSource() };
  },
  async standings() {
    return { data: [], source: unavailableSource() };
  },
  async matches() {
    return { data: [], source: unavailableSource() };
  },
  async roster() {
    return { data: [], source: unavailableSource() };
  },
};

function unavailableSource() {
  return {
    sourceName: "Liquipedia LPDB",
    sourceUrl: "https://liquipedia.net/api",
    fetchedAt: new Date().toISOString(),
  };
}
