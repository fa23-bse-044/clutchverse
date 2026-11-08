import type { MetadataRoute } from "next";
import { games } from "@clutchverse/core";
import { tournaments } from "@/lib/demo-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://clutchverse.gg";
  const routes = ["/", "/games", "/tournaments", "/rankings", "/live", "/community", "/teams", "/store", "/about", "/fair-play"];
  return [
    ...routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: route === "/" ? 1 : 0.7 })),
    ...games.map((game) => ({ url: `${base}/games/${game.slug}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.8 })),
    ...tournaments.map((event) => ({ url: `${base}/tournaments/${event.slug}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
