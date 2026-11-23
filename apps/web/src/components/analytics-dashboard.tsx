"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocale } from "@/i18n/locale-context";
import type { AnalyticsRecord } from "@/lib/analytics";

type Summary = {
  results: number;
  decided: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  kills: number;
  deaths: number;
  killDeathRatio: number | null;
  placementDistribution: { placement: number; count: number }[];
  headToHead: { opponent: string; played: number; wins: number }[];
  teamPerformance: { team: string; played: number; wins: number }[];
};

type DashboardData = {
  handle: string | null;
  shareToken: string | null;
  records: AnalyticsRecord[];
  summary: Summary;
  games: { slug: string; name: string }[];
  currentRatings: {
    gameSlug: string;
    gameName: string;
    region: string;
    period: string;
    rating: number;
    points: number;
    updatedAt: string;
  }[];
  ratingSnapshots: {
    gameSlug: string;
    period: string;
    rating: number;
    capturedOn: string;
  }[];
  peerComparison: {
    gameSlug: string;
    gameName: string;
    rating: number;
    peerAverageRating: number | null;
    peerCount: number;
  }[];
};

export function AnalyticsDashboard() {
  const { messages, locale } = useLocale();
  const copy = messages.analytics;
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      if (!response.ok) throw new Error(copy.loadError);
      const result = (await response.json()) as DashboardData;
      setData(result);
      setShareUrl(
        result.shareToken
          ? `${window.location.origin}/analytics/share/${result.shareToken}`
          : "",
      );
    } catch {
      setLoadError(true);
    }
  }, [copy.loadError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const gamePerformance = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; played: number; wins: number }>();
    for (const result of data.records) {
      if (result.outcome === "unknown") continue;
      const item = map.get(result.gameSlug) ?? {
        name: result.gameName,
        played: 0,
        wins: 0,
      };
      item.played += 1;
      if (result.outcome === "win") item.wins += 1;
      map.set(result.gameSlug, item);
    }
    return [...map.entries()]
      .map(([slug, item]) => ({
        slug,
        ...item,
        winRate: item.played ? Math.round((item.wins / item.played) * 100) : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }, [data]);

  async function addManualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const numeric = (name: string) => {
      const value = String(formData.get(name) ?? "");
      return value.trim() ? Number(value) : undefined;
    };
    const date = String(formData.get("playedAt") ?? "");
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/analytics/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameSlug: formData.get("gameSlug"),
          playedAt: new Date(`${date}T12:00:00.000Z`).toISOString(),
          opponent: formData.get("opponent") || undefined,
          scoreFor: numeric("scoreFor"),
          scoreAgainst: numeric("scoreAgainst"),
          placement: numeric("placement"),
          kills: numeric("kills"),
          deaths: numeric("deaths"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? copy.entryError);
      form.reset();
      setNotice(copy.entrySaved);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.entryError);
    } finally {
      setBusy(false);
    }
  }

  async function manageShare(method: "POST" | "DELETE") {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/analytics/share", { method });
      const result = (await response.json()) as { token?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? copy.shareError);
      setShareUrl(result.token ? `${window.location.origin}/analytics/share/${result.token}` : "");
      setNotice(method === "POST" ? copy.shareCreated : copy.shareRevoked);
      if (method === "DELETE") await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.shareError);
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    if (!data) return;
    const columns = [
      "date",
      "game",
      "event",
      "source",
      "outcome",
      "opponent",
      "team",
      "placement",
      "kills",
      "deaths",
      "score_for",
      "score_against",
    ];
    const rows = data.records.map((record) =>
      [
        record.playedAt,
        record.gameName,
        record.title,
        record.source,
        record.outcome,
        record.opponent,
        record.teamName,
        record.placement,
        record.kills,
        record.deaths,
        record.scoreFor,
        record.scoreAgainst,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[columns.join(","), ...rows].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "clutchverse-analytics.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function removeEntry(id: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/analytics/entries/${encodeURIComponent(id.replace(/^manual-/, ""))}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? copy.entryError);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.entryError);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !loadError)
    return <p role="status">{copy.loading}</p>;
  if (loadError || !data)
    return <p role="alert">{copy.loadError}</p>;

  const maxPlacement = Math.max(
    1,
    ...data.summary.placementDistribution.map((item) => item.count),
  );
  const timeline = data.records.slice(0, 20).reverse();
  const timelinePoints = timeline
    .map((record, index) => {
      const x = timeline.length < 2 ? 320 : (index / (timeline.length - 1)) * 640;
      const y = record.outcome === "win" ? 30 : record.outcome === "loss" ? 160 : 95;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="analytics-dashboard" dir={locale === "ar" || locale === "ur" ? "rtl" : "auto"}>
      <header className="detail-section-title">
        <div>
          <span className="eyebrow">{copy.sourceLabel}</span>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-intro">{copy.description}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={downloadCsv}>
          {copy.exportCsv}
        </button>
      </header>

      <div className="profile-stats">
        <Metric label={copy.matches} value={data.summary.results} />
        <Metric label={copy.winRate} value={data.summary.winRate === null ? "—" : `${data.summary.winRate}%`} />
        <Metric label={copy.kills} value={data.summary.kills} />
        <Metric label={copy.killDeathRatio} value={data.summary.killDeathRatio ?? "—"} />
      </div>
      {data.summary.killDeathRatio === null && <p className="muted">{copy.noDeathData}</p>}

      <div className="team-profile-grid">
        <section className="panel profile-section">
          <h2>{copy.resultsTimeline}</h2>
          {timeline.length ? (
            <svg viewBox="0 0 640 190" role="img" aria-label={`${copy.resultsTimeline}: ${timeline.length} recent results`} style={{ width: "100%", height: "auto" }}>
              <path d="M0 95 H640" stroke="var(--border, rgba(255,255,255,.15))" strokeDasharray="4 5" />
              <polyline points={timelinePoints} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinejoin="round" />
              {timeline.map((record, index) => (
                <circle
                  key={record.id}
                  cx={timeline.length < 2 ? 320 : (index / (timeline.length - 1)) * 640}
                  cy={record.outcome === "win" ? 30 : record.outcome === "loss" ? 160 : 95}
                  r="5"
                  fill={record.outcome === "win" ? "var(--accent)" : "currentColor"}
                />
              ))}
            </svg>
          ) : <p>{copy.noResults}</p>}
        </section>
        <section className="panel profile-section">
          <h2>{copy.placementDistribution}</h2>
          {data.summary.placementDistribution.length ? data.summary.placementDistribution.map((item) => (
            <div key={item.placement} style={{ display: "grid", gridTemplateColumns: "5rem 1fr 2rem", gap: ".5rem", alignItems: "center", marginBlock: ".5rem" }}>
              <span>{copy.placement} {item.placement}</span>
              <span aria-hidden="true" style={{ height: ".6rem", background: "var(--border, #333)", borderRadius: "1rem" }}>
                <span style={{ display: "block", width: `${(item.count / maxPlacement) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: "inherit" }} />
              </span>
              <strong>{item.count}</strong>
            </div>
          )) : <p>{copy.noResults}</p>}
        </section>
      </div>

      <section className="panel profile-section">
        <h2>{copy.strengthsWeaknesses}</h2>
        {gamePerformance.length ? (
          <div className="team-profile-grid">
            <p><strong>{copy.strongest}:</strong> {gamePerformance[0].name} · {gamePerformance[0].winRate}%</p>
            <p><strong>{copy.developing}:</strong> {gamePerformance[gamePerformance.length - 1].name} · {gamePerformance[gamePerformance.length - 1].winRate}%</p>
          </div>
        ) : <p>{copy.noResults}</p>}
      </section>

      <section className="panel profile-section">
        <div className="detail-section-title"><h2>{copy.similarPlayers}</h2></div>
        {data.peerComparison.length ? data.peerComparison.map((peer) => (
          <div className="match-row" key={`${peer.gameSlug}-${peer.gameName}`}>
            <strong>{peer.gameName}</strong>
            <span>{copy.rankProgression}: {peer.rating}</span>
            <span>{peer.peerAverageRating === null ? copy.noRankData : `${copy.average}: ${peer.peerAverageRating}`}</span>
            <small>{peer.peerCount} {copy.played}</small>
          </div>
        )) : <p>{copy.noRankData}</p>}
      </section>

      <section className="panel profile-section">
        <h2>{copy.rankProgression}</h2>
        <p className="muted">{copy.observedRankHistory}</p>
        {data.ratingSnapshots.length ? data.ratingSnapshots.map((snapshot) => (
          <div className="match-row" key={`${snapshot.gameSlug}-${snapshot.period}-${snapshot.capturedOn}`}>
            <strong>{snapshot.gameSlug}</strong>
            <span>{snapshot.period}</span>
            <strong>{snapshot.rating.toLocaleString(locale)}</strong>
            <small>{new Date(snapshot.capturedOn).toLocaleDateString(locale)}</small>
          </div>
        )) : <p>{copy.noRankData}</p>}
      </section>

      <div className="team-profile-grid">
        <section className="panel profile-section">
          <h2>{copy.headToHead}</h2>
          {data.summary.headToHead.length ? data.summary.headToHead.map((item) => (
            <div className="match-row" key={item.opponent}>
              <strong>{item.opponent}</strong>
              <span>{item.played} {copy.played}</span>
              <span>{item.wins} {copy.wins}</span>
            </div>
          )) : <p>{copy.noResults}</p>}
        </section>
        <section className="panel profile-section">
          <h2>{copy.teamPerformance}</h2>
          {data.summary.teamPerformance.length ? data.summary.teamPerformance.map((item) => (
            <div className="match-row" key={item.team}>
              <strong>{item.team}</strong>
              <span>{item.played} {copy.played}</span>
              <span>{item.wins} {copy.wins}</span>
            </div>
          )) : <p>{copy.noResults}</p>}
        </section>
      </div>

      <section className="panel profile-section">
        <h2>{copy.manualEntry}</h2>
        <form onSubmit={(event) => void addManualEntry(event)} className="analytics-entry-form" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))", gap: "1rem" }}>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.game}<select name="gameSlug" required defaultValue=""><option value="" disabled>{copy.game}</option>{data.games.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}</select></label>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.playedAt}<input name="playedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.opponent}<input name="opponent" maxLength={120} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.scoreFor}<input name="scoreFor" type="number" min="0" max="999" inputMode="numeric" /></label>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.scoreAgainst}<input name="scoreAgainst" type="number" min="0" max="999" inputMode="numeric" /></label>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.placement}<input name="placement" type="number" min="1" max="1000" inputMode="numeric" /></label>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.kills}<input name="kills" type="number" min="0" max="1000" inputMode="numeric" /></label>
          <label style={{ display: "grid", gap: ".4rem" }}>{copy.deaths}<input name="deaths" type="number" min="0" max="1000" inputMode="numeric" /></label>
          <button className="button button-primary" type="submit" disabled={busy}>{copy.addResult}</button>
        </form>
        <p className="muted">{copy.manualSource}</p>
      </section>

      <section className="panel profile-section">
        <h2>{copy.shareCard}</h2>
        <div className="analytics-share-actions">
          <button className="button button-primary" type="button" disabled={busy} onClick={() => void manageShare("POST")}>{copy.createShare}</button>
          {shareUrl && <button className="button button-secondary" type="button" disabled={busy} onClick={() => void manageShare("DELETE")}>{copy.revokeShare}</button>}
        </div>
        {shareUrl && <p><a href={shareUrl}>{shareUrl}</a></p>}
      </section>

      <section className="panel profile-section">
        <h2>{copy.resultsTimeline}</h2>
        {data.records.map((record) => (
          <div className="match-row" key={record.id}>
            <span className={`match-result ${record.outcome === "loss" ? "loss" : ""}`}>{record.outcome === "win" ? "W" : record.outcome === "loss" ? "L" : "—"}</span>
            <span><strong>{record.title}</strong><small>{record.gameName} · {new Date(record.playedAt).toLocaleDateString(locale)} · {sourceName(record.source, copy)}</small></span>
            <span>{record.placement === null ? "" : `${copy.placement} ${record.placement}`}</span>
            {record.source === "manual" && <button type="button" className="button button-secondary" disabled={busy} onClick={() => void removeEntry(record.id)}>{copy.remove}</button>}
          </div>
        ))}
      </section>
      <p role="status" aria-live="polite">{notice}</p>
    </div>
  );
}

export function PublicAnalyticsCard({
  handle,
  summary,
}: {
  handle: string | null;
  summary: Summary;
}) {
  const { messages } = useLocale();
  const copy = messages.analytics;
  return (
    <article className="panel profile-section" aria-label={copy.shareCard}>
      <span className="eyebrow">CLUTCHVERSE · {copy.shareCard}</span>
      <h1 className="page-title">{handle ?? copy.title}</h1>
      <p className="muted">{copy.sourceLabel}: {copy.platformSource}, {copy.tournamentSource}, {copy.manualSource}</p>
      <div className="profile-stats">
        <Metric label={copy.matches} value={summary.results} />
        <Metric label={copy.winRate} value={summary.winRate === null ? "—" : `${summary.winRate}%`} />
        <Metric label={copy.kills} value={summary.kills} />
        <Metric label={copy.killDeathRatio} value={summary.killDeathRatio ?? "—"} />
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><span className="eyebrow">{label}</span><strong>{value}</strong></div>;
}

function sourceName(source: AnalyticsRecord["source"], copy: ReturnType<typeof useLocale>["messages"]["analytics"]) {
  return source === "platform" ? copy.platformSource : source === "tournament" ? copy.tournamentSource : copy.manualSource;
}
