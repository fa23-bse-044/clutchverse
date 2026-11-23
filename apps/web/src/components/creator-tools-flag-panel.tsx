"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";

export function CreatorToolsFlagPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const { messages } = useLocale();
  const copy = messages.creatorTools;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function toggle() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/feature-flags/creator-tools", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const result = (await response.json()) as { enabled?: boolean; error?: string };
      if (!response.ok || typeof result.enabled !== "boolean") throw new Error(result.error ?? copy.error);
      setEnabled(result.enabled);
      setNotice(copy.saved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }

  }

  return (
    <section className="panel admin-panel">
      <p className="eyebrow">{copy.adminEyebrow}</p>
      <h1 className="page-title">{copy.adminTitle}</h1>
      <p>{copy.adminDescription}</p>
      <p><strong>{enabled ? copy.enabled : copy.disabled}</strong></p>
      <button className="button button-primary" type="button" disabled={busy} onClick={() => void toggle()}>
        {busy ? copy.saving : enabled ? copy.disable : copy.enable}
      </button>
      <p role="status" aria-live="polite">{notice}</p>
      <Link href="/admin/features">Back to feature flags</Link>
    </section>
  );
}

export function CreatorToolsAdminLink() {
  const { messages } = useLocale();
  return <Link href="/admin/features/creator-tools">{messages.creatorTools.adminTitle}</Link>;
}
