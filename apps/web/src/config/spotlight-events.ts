export type SpotlightEventConfig = {
  slug: string;
  game: "pubg-mobile" | "free-fire" | "tekken-8" | "fifa";
  displayName: string;
  flag: string;
  providerIds: {
    liquipedia?: string;
    pandaScore?: string;
  };
};

export const spotlightEvents: SpotlightEventConfig[] = [
  {
    slug: "pmgc",
    game: "pubg-mobile",
    displayName: "PUBG Mobile Global Championship",
    flag: "spotlight-pmgc",
    providerIds: {},
  },
];

export function findSpotlightConfig(slug: string) {
  return spotlightEvents.find((event) => event.slug === slug);
}
