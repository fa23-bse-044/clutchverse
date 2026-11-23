"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/locale-context";

export function FeatureFlagPanel({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const { messages } = useLocale();
  const copy = messages.matchLobby;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save(nextEnabled: boolean) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "match-lobby", enabled: nextEnabled }),
      });
      const data = (await response.json()) as { enabled?: boolean; error?: string };
      if (!response.ok || typeof data.enabled !== "boolean") {
        throw new Error(data.error ?? copy.saveError);
      }
      setEnabled(data.enabled);
      setNotice(copy.saved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-panel" aria-labelledby="match-lobby-flag">
      <h2 id="match-lobby-flag">{copy.title}</h2>
      <p>{copy.flagDescription}</p>
      <p>
        <strong>{enabled ? copy.enabled : copy.disabled}</strong>
      </p>
      <button
        className="button button-primary"
        type="button"
        disabled={busy}
        onClick={() => void save(!enabled)}
      >
        {busy ? copy.saving : enabled ? copy.disableFlag : copy.enableFlag}
      </button>
      <p role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  );
}
