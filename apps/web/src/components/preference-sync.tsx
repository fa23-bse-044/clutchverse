"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  applyVisualPreferences,
  type VisualPreferences,
} from "@/lib/visual-preferences";
import { applyLocaleToDocument, isLocale } from "@/i18n/locales";

type ProfilePreferences = VisualPreferences & { locale?: string };

export function PreferenceSync() {
  const { status } = useSession();
  const { setTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const savedPerformance = localStorage.getItem("clutchverse-performance");
    const savedVideo = localStorage.getItem("clutchverse-video");
    const savedSound = localStorage.getItem("clutchverse-sound");
    const savedCursor = localStorage.getItem("clutchverse-cursor");
    applyVisualPreferences({
      performanceMode: savedPerformance === "true",
      backgroundVideo: savedVideo === "true",
      soundEnabled: savedSound === "true",
      customCursor: savedCursor === "true",
    });
    root.dataset.performance = String(savedPerformance === "true");
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    void fetch("/api/profile/preferences")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Preference sync failed (${response.status}).`);
        }
        const data = (await response.json()) as {
          preferences?: ProfilePreferences;
        };
        if (!active || !data.preferences) return;
        const { preferences } = data;
        setTheme(preferences.theme ?? "neon-cyber");
        const { locale, ...visualPreferences } = preferences;
        applyVisualPreferences(visualPreferences);
        if (isLocale(locale)) {
          applyLocaleToDocument(locale);
          window.dispatchEvent(
            new CustomEvent("clutchverse:locale", { detail: locale }),
          );
        }
      })
      .catch((error: unknown) =>
        console.error("Could not load profile preferences.", error),
      );
    return () => {
      active = false;
    };
  }, [setTheme, status]);

  return null;
}
