import { games } from "@clutchverse/core";

export const gameMedia = Object.fromEntries(
  games.map((game) => [
    game.slug,
    {
      poster: game.image,
      webm: `/media/${game.slug}/bg.webm`,
      mp4: `/media/${game.slug}/bg.mp4`,
    },
  ]),
) as Record<(typeof games)[number]["slug"], { poster: string; webm: string; mp4: string }>;
