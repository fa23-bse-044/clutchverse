"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale-context";

type Draft = {
  id: string;
  kind: string;
  title: string;
  content: string;
  createdAt: string;
  owner: { name: string | null; profile: { handle: string } | null };
};

export function AiDraftReview() {
  const { messages } = useLocale();
  const copy = messages.aiDrafts;
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ai-drafts", { cache: "no-store" });
      const data = await response.json() as { drafts?: Draft[]; error?: string };
      if (!response.ok || !data.drafts) throw new Error(data.error ?? copy.error);
      setDrafts(data.drafts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error]);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/admin/ai-drafts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? copy.error);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="ai-draft-review">
      <header className="panel">
        <p className="eyebrow">{copy.pending}</p>
        <h1 className="page-title">{copy.title}</h1>
        <p>{copy.description}</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">{copy.loading}</p> : drafts.length === 0 && !error ? <p className="panel">{copy.empty}</p> : drafts.map((draft) => (
        <article className="panel" key={draft.id}>
          <p className="eyebrow">{copy.generatedLabel} · {draft.kind}</p>
          <h2>{draft.title}</h2>
          <p>{draft.owner.profile?.handle ?? draft.owner.name ?? "Player"} · {new Date(draft.createdAt).toLocaleString(messages.language)}</p>
          <div className="ai-draft-content">{draft.content}</div>
          <div className="ai-draft-actions">
            <button className="button button-primary" disabled={Boolean(busyId)} onClick={() => void review(draft.id, "approved")}>{copy.approve}</button>
            <button className="button" disabled={Boolean(busyId)} onClick={() => void review(draft.id, "rejected")}>{copy.reject}</button>
          </div>
        </article>
      ))}
    </section>
  );
}
