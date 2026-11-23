import type { SpotlightProvider } from "@/lib/spotlight-provider";
import { checkPandaScoreCoverage } from "@/lib/spotlight-provider";

type UnavailableRecord = Record<string, never>;

export const pandaScoreSpotlightProvider: SpotlightProvider<
  UnavailableRecord,
  UnavailableRecord,
  UnavailableRecord,
  UnavailableRecord,
  UnavailableRecord
> = {
  sourceName: "PandaScore",
  async event() {
    await checkPandaScoreCoverage();
    return null;
  },
  async participants() {
    await checkPandaScoreCoverage();
    return { data: [], source: unavailableSource() };
  },
  async standings() {
    await checkPandaScoreCoverage();
    return { data: [], source: unavailableSource() };
  },
  async matches() {
    await checkPandaScoreCoverage();
    return { data: [], source: unavailableSource() };
  },
  async roster() {
    await checkPandaScoreCoverage();
    return { data: [], source: unavailableSource() };
  },
};

function unavailableSource() {
  return {
    sourceName: "PandaScore",
    sourceUrl: "https://developers.pandascore.co/reference/get_videogames",
    fetchedAt: new Date().toISOString(),
  };
}
