"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";

export function AiAssistantFlagPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const { messages } = useLocale();
  const copy = messages.aiAssistant;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function toggle() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/feature-flags/ai-assistant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await response.json() as { enabled?: boolean; error?: string };
      if (!response.ok || typeof data.enabled !== "boolean") throw new Error(data.error ?? copy.error);
      setEnabled(data.enabled);
      setNotice(copy.saved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-panel">
      <h1 className="page-title">{copy.flagTitle}</h1>
      <p>{copy.flagDescription}</p>
      <p><strong>{enabled ? copy.enabled : copy.disabled}</strong></p>
      <button className="button button-primary" disabled={busy} onClick={() => void toggle()} type="button">
        {busy ? copy.saving : enabled ? copy.disable : copy.enable}
      </button>
      <p role="status" aria-live="polite">{notice}</p>
      <Link href="/admin/features">Back to feature flags</Link>
      {" · "}<Link href="/admin/ai-drafts">{copy.reviewDrafts}</Link>
      {" · "}<Link href="/admin/ai-moderation">{messages.aiModeration.title}</Link>
    </section>
  );
}

export function AiAssistantAdminLink() {
  const { messages } = useLocale();
  return <Link href="/admin/features/ai-assistant">{messages.aiAssistant.flagTitle}</Link>;
}
