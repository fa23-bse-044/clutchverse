"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";

export function SeasonalPlayFlagPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const { messages } = useLocale();
  const copy = messages.seasonalPlay;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function toggle() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/feature-flags/seasonal-play", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await response.json() as { enabled?: boolean; error?: string };
      if (!response.ok || typeof data.enabled !== "boolean") throw new Error(data.error ?? copy.actionError);
      setEnabled(data.enabled);
      setNotice(copy.savedFlag);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-panel">
      <h1 className="page-title">{copy.flagTitle}</h1>
      <p>{copy.flagDescription}</p>
      <p><strong>{enabled ? copy.enabled : copy.disabled}</strong></p>
      <button className="button button-primary" type="button" disabled={busy} onClick={() => void toggle()}>
        {busy ? copy.saving : enabled ? copy.disable : copy.enable}
      </button>
      <p role="status" aria-live="polite">{notice}</p>
      <Link href="/admin/features">Back to feature flags</Link>
    </section>
  );
}

export function SeasonalPlayAdminLink() {
  const { messages } = useLocale();
  return <Link href="/admin/features/seasonal-play">{messages.seasonalPlay.flagTitle}</Link>;
}
