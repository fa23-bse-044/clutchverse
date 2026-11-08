import type { GameSlug } from "@clutchverse/core";

export type Tournament = {
  id?: string;
  slug: string;
  title: string;
  game: GameSlug;
  state: "UPCOMING" | "LIVE" | "COMPLETED";
  format: string;
  mode?: string;
  starts: string;
  prize: string;
  entries: string;
  region: string;
  entryFee?: number;
  startsAt?: string;
};

export const tournaments: Tournament[] = [
  {
    slug: "drop-zone-invitational",
    title: "The Drop Zone Invitational",
    game: "pubg-mobile",
    state: "LIVE",
    format: "SQUAD · BATTLE ROYALE",
    starts: "Live now",
    prize: "$25,000",
    entries: "32 / 32",
    region: "South Asia",
  },
  {
    slug: "flame-open",
    title: "Flame Open: Clash Series",
    game: "free-fire",
    state: "UPCOMING",
    format: "SQUAD · POINTS",
    starts: "Nov 09 · 18:00 PKT",
    prize: "$12,500",
    entries: "24 / 48",
    region: "Global",
  },
  {
    slug: "iron-fist-cup",
    title: "Iron Fist Cup // Season 04",
    game: "tekken-8",
    state: "UPCOMING",
    format: "1V1 · DOUBLE ELIM",
    starts: "Nov 12 · 20:00 PKT",
    prize: "$8,000",
    entries: "86 / 128",
    region: "Global",
  },
  {
    slug: "club-championship",
    title: "ClutchVerse Club Championship",
    game: "fifa",
    state: "COMPLETED",
    format: "1V1 · SWISS",
    starts: "Completed Nov 02",
    prize: "$15,000",
    entries: "128 / 128",
    region: "Europe",
  },
  {
    slug: "survival-circuit",
    title: "Survival Circuit: Finals",
    game: "pubg-mobile",
    state: "UPCOMING",
    format: "SQUAD · 6 MATCHES",
    starts: "Nov 14 · 19:30 PKT",
    prize: "$40,000",
    entries: "18 / 32",
    region: "South Asia",
  },
  {
    slug: "strike-first",
    title: "Strike First Weekly #31",
    game: "tekken-8",
    state: "LIVE",
    format: "1V1 · SINGLE ELIM",
    starts: "Live now",
    prize: "$2,000",
    entries: "64 / 64",
    region: "Asia",
  },
];

export const topPlayers = [
  { handle: "Vex", game: "TEKKEN 8", record: "48 — 6", rating: 2840 },
  { handle: "NOVA丨Rex", game: "PUBG MOBILE", record: "32 — 4", rating: 2725 },
  { handle: "MØON", game: "FREE FIRE", record: "29 — 5", rating: 2668 },
  { handle: "Kairo", game: "EA SPORTS FC", record: "41 — 9", rating: 2590 },
  { handle: "Sable", game: "TEKKEN 8", record: "36 — 11", rating: 2512 },
  { handle: "Astra", game: "PUBG MOBILE", record: "28 — 8", rating: 2460 },
  { handle: "Riot", game: "FREE FIRE", record: "26 — 8", rating: 2415 },
  { handle: "Juno", game: "EA SPORTS FC", record: "33 — 12", rating: 2358 },
];

export const teams = [
  {
    name: "NOVA ESPORTS",
    slug: "nova-esports",
    game: "PUBG MOBILE",
    members: 5,
    score: "24.8K",
    color: "violet",
  },
  {
    name: "TEAM PHOENIX",
    slug: "team-phoenix",
    game: "FREE FIRE",
    members: 4,
    score: "22.1K",
    color: "orange",
  },
  {
    name: "IRONCLAD",
    slug: "ironclad",
    game: "TEKKEN 8",
    members: 3,
    score: "19.6K",
    color: "red",
  },
];

export function gameName(slug: GameSlug) {
  return {
    "pubg-mobile": "PUBG MOBILE",
    "free-fire": "FREE FIRE",
    "tekken-8": "TEKKEN 8",
    fifa: "EA SPORTS FC",
  }[slug];
}
