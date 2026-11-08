import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/organizer", "/api/", "/login", "/register"] },
    sitemap: "https://clutchverse.gg/sitemap.xml",
  };
}
