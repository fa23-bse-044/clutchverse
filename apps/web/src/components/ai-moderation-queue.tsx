"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale-context";

type Report = {
  id: string;
  targetId: string;
  author: string;
  body: string | null;
  category: string;
  confidence: number | null;
  createdAt: string;
};

export function AiModerationQueue() {
  const { messages } = useLocale();
  const copy = messages.aiModeration;
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ai-moderation", { cache: "no-store" });
      const data = await response.json() as { reports?: Report[]; error?: string };
      if (!response.ok || !data.reports) throw new Error(data.error ?? copy.error);
      setReports(data.reports);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error]);

  useEffect(() => { void load(); }, [load]);

  async function review(reportId: string, decision: "reviewed" | "dismissed") {
    setBusy(reportId);
    setError("");
    try {
      const response = await fetch("/api/admin/ai-moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, decision }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? copy.error);
      setReports((items) => items.filter((item) => item.id !== reportId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error);
    } finally {
      setBusy("");
    }
  }

  return (
    <section>
      <header className="panel">
        <h1 className="page-title">{copy.title}</h1>
        <p>{copy.description}</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">{copy.loading}</p> : reports.length === 0 && !error ? <p className="panel">{copy.empty}</p> : reports.map((report) => (
        <article className="panel" key={report.id}>
          <p><strong>{copy.category}:</strong> {report.category}</p>
          <p><strong>{copy.confidence}:</strong> {report.confidence === null ? "—" : `${Math.round(report.confidence * 100)}%`}</p>
          <p><strong>{copy.author}:</strong> {report.author}</p>
          <p>{report.body ?? "Message unavailable or deleted."}</p>
          <div className="ai-draft-actions">
            <button className="button button-primary" disabled={Boolean(busy)} onClick={() => void review(report.id, "reviewed")}>{copy.review}</button>
            <button className="button" disabled={Boolean(busy)} onClick={() => void review(report.id, "dismissed")}>{copy.dismiss}</button>
          </div>
        </article>
      ))}
    </section>
  );
}
