import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClutchVerse — Play for the moment",
    short_name: "ClutchVerse",
    description: "The arena for your next big play.",
    start_url: "/",
    display: "standalone",
    background_color: "#090a12",
    theme_color: "#090a12",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
