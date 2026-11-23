"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";

export function MatchLobbyEntry() {
  const { messages } = useLocale();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/match-lobby/availability")
      .then(async (response) => {
        const data = (await response.json()) as { enabled?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Availability check failed.");
        if (active) setEnabled(data.enabled === true);
      })
      .catch((error: unknown) => {
        console.error("Could not check match-lobby availability.", {
          reason: error instanceof Error ? error.message : "request-error",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;
  return (
    <p>
      <Link className="button button-secondary" href="/matches">
        {messages.matchLobby.myMatches}
      </Link>
    </p>
  );
}
