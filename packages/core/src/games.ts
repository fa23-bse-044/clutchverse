export const games = [
  {
    slug: "pubg-mobile",
    name: "PUBG MOBILE",
    shortName: "PUBG",
    category: "BATTLE ROYALE",
    accent: "#d5bb63",
    color: "#b4943f",
    tag: "DROP IN. DOMINATE.",
    description: "Squad up, outlast the lobby, and claim your place at the top.",
    image: "/media/pubg-mobile/poster.svg",
    teams: 4,
    players: "2.4M",
    live: 128,
  },
  {
    slug: "free-fire",
    name: "FREE FIRE",
    shortName: "FREE FIRE",
    category: "BATTLE ROYALE",
    accent: "#ff6b35",
    color: "#dc4b23",
    tag: "FAST. FEARLESS. FIRED UP.",
    description: "Fast lobbies. Big plays. A community that never backs down.",
    image: "/media/free-fire/poster.svg",
    teams: 4,
    players: "1.8M",
    live: 96,
  },
  {
    slug: "tekken-8",
    name: "TEKKEN 8",
    shortName: "TEKKEN",
    category: "FIGHTING",
    accent: "#e74463",
    color: "#8a294d",
    tag: "THE KING OF THE IRON FIST.",
    description: "Read the opponent, own the set, and make every round count.",
    image: "/media/tekken-8/poster.svg",
    teams: 1,
    players: "864K",
    live: 42,
  },
  {
    slug: "fifa",
    name: "EA SPORTS FC",
    shortName: "EA FC",
    category: "FOOTBALL",
    accent: "#4bdf9b",
    color: "#168a68",
    tag: "THIS IS YOUR CLUB.",
    description: "Build your run, find your rivals, and play for the badge.",
    image: "/media/fifa/poster.svg",
    teams: 1,
    players: "1.1M",
    live: 57,
  },
] as const;

export type Game = (typeof games)[number];
export type GameSlug = Game["slug"];

export const findGame = (slug: string): Game | undefined =>
  games.find((game) => game.slug === slug);
