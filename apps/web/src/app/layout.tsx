import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "@clutchverse/ui/globals.css";
import { AppShell } from "@/components/app-shell";
import { getDirection, isLocale } from "@/i18n/locales";

export const metadata: Metadata = {
  metadataBase: new URL("https://clutchverse.gg"),
  title: {
    default: "ClutchVerse — Play for the moment.",
    template: "%s | ClutchVerse",
  },
  description:
    "The arena for your next big play. Compete, connect, and climb across PUBG Mobile, Free Fire, Tekken 8, and EA SPORTS FC.",
  openGraph: {
    title: "ClutchVerse — Play for the moment.",
    description: "Your next big play starts here.",
    siteName: "ClutchVerse",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("clutchverse-locale")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "en";
  return (
    <html lang={locale} dir={getDirection(locale)} suppressHydrationWarning>
      <body>
        <AppShell initialLocale={locale}>{children}</AppShell>
      </body>
    </html>
  );
}
