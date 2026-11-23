"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { io } from "socket.io-client";
import { useLocale } from "@/i18n/locale-context";
import { spotlightText } from "@/i18n/messages/spotlight";
import { countryFlagEmoji } from "@/lib/spotlight-domain";
import styles from "./spotlight.module.css";

type Player = { id: string; name: string; role: string | null; sourceUrl: string };
type Team = { id: string; slug: string; name: string; countryCode: string; region: string | null; players: Player[] };
type Participation = {
  id: string; countryCode: string; qualificationPath: string | null; status: string; pinned: boolean;
  sourceName: string; sourceUrl: string; sourceType: string; stage: { id: string; name: string } | null; team: Team;
};
type Stage = { id: string; name: string; sortOrder: number; status: string; startsAt: string | null; endsAt: string | null; sourceName: string; sourceUrl: string };
type Standing = { id: string; participationId: string; rank: number | null; points: number | null; placementPoints: number | null; kills: number | null; sourceName: string; sourceUrl: string; stage: Stage | null; participation: { team: Team } };
type MatchResult = { team: string; placement?: number; points?: number; kills?: number };
type Match = { id: string; title: string; status: string; startsAt: string | null; results: MatchResult[] | null; sourceName: string; sourceUrl: string; stage: Stage | null; participation: { team: Team } | null };
type Champion = { id: string; entityType: string; entityId: string; sourceName: string; sourceUrl: string; fetchedAt: string };
export type SpotlightSnapshot = {
  id: string; slug: string; displayName: string; status: string; startsAt: string | null; endsAt: string | null;
  venue: string | null; prizePool: string | null; totalSlots: number | null; officialLinks: unknown;
  sourceName: string; sourceUrl: string; sourceType: string; fetchedAt: string; updatedAt: string; latestUpdatedAt: string; pinned: boolean;
  participants: Participation[]; stages: Stage[]; standings: Standing[]; matches: Match[]; champions: Champion[];
  counts: { confirmedTeams: number; totalSlots: number | null; countries: number; stages: number; prizePool: string | null };
};
type LiveStream = { videoId: string; title: string; channelTitle: string };

function formatLocalDate(value: string | null, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? null
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function sourceLabel(sourceType: string, key: (key: "provider" | "adminManaged" | "aiVerified") => string) {
  if (sourceType === "provider") return key("provider");
  if (sourceType === "ai_assisted_verified") return key("aiVerified");
  return key("adminManaged");
}

export function SpotlightEvent({
  slug,
  initialEvent,
  streams,
}: {
  slug: string;
  initialEvent: SpotlightSnapshot | null;
  streams: LiveStream[];
}) {
  const { locale } = useLocale();
  const reducedMotion = useReducedMotion();
  const t = useCallback(
    (key: Parameters<typeof spotlightText>[0]) => spotlightText(key, locale),
    [locale],
  );
  const [event, setEvent] = useState(initialEvent);
  const [selectedStage, setSelectedStage] = useState("all");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [refreshError, setRefreshError] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/spotlight/${slug}`, { cache: "no-store" });
    const payload = (await response.json()) as { event?: SpotlightSnapshot | null; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Spotlight refresh failed.");
    setEvent(payload.event ?? null);
    setRefreshError(false);
  }, [slug]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const socket = io(process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001", {
      transports: ["websocket", "polling"],
    });
    const refreshSafely = () => void refresh().catch((error: unknown) => {
      console.error("Could not refresh PMGC spotlight.", error);
      setRefreshError(true);
    });
    socket.on("connect", () => {
      socket.emit("spotlight:subscribe", { slug });
      refreshSafely();
    });
    for (const name of ["team:added", "team:updated", "team:removed", "counts:updated", "standings:updated", "match:updated", "status:changed"]) {
      socket.on(name, refreshSafely);
    }
    return () => {
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, [refresh, slug]);

  const countryNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale],
  );
  const countries = [...new Set(event?.participants.map((item) => item.countryCode) ?? [])].sort();
  const visibleTeams = (event?.participants ?? [])
    .filter((item) =>
      (country === "all" || item.countryCode === country) &&
      `${item.team.name} ${item.countryCode} ${item.qualificationPath ?? ""}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)),
    )
    .sort((a, b) => {
      if (sort === "country") return a.countryCode.localeCompare(b.countryCode) || a.team.name.localeCompare(b.team.name);
      if (sort === "qualification") return (a.qualificationPath ?? "").localeCompare(b.qualificationPath ?? "") || a.team.name.localeCompare(b.team.name);
      return a.team.name.localeCompare(b.team.name);
    });
  const stages = event?.stages ?? [];
  const stageFiltered = (stageId: string | null) => selectedStage === "all" || stageId === selectedStage;
  const standings = (event?.standings ?? []).filter(({ stage }) => stageFiltered(stage?.id ?? null));
  const matches = (event?.matches ?? []).filter(({ stage }) => stageFiltered(stage?.id ?? null));
  const confirmedCount = event?.counts.confirmedTeams ?? 0;
  const countryCount = event?.counts.countries ?? 0;
  const countdown = event?.startsAt ? Math.max(0, new Date(event.startsAt).getTime() - now) : null;
  const countdownParts = countdown === null ? null : [
    Math.floor(countdown / 86_400_000),
    Math.floor((countdown % 86_400_000) / 3_600_000),
    Math.floor((countdown % 3_600_000) / 60_000),
    Math.floor((countdown % 60_000) / 1000),
  ];
  const stale = event ? Date.now() - new Date(event.latestUpdatedAt).getTime() > 30 * 60_000 : false;
  const officialLinks = Array.isArray(event?.officialLinks)
    ? event.officialLinks.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
    : [];
  const sourceType = event?.sourceType ?? "admin";

  if (!event) {
    return (
      <main className={styles.page} style={{ "--spotlight-accent": "#f4a51c" } as CSSProperties}>
        <div className="container">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-intro">{t("notAvailable")}</p>
          <Link className="button button-primary" href="/games/pubg-mobile">{t("explore")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page} style={{ "--spotlight-accent": "#f4a51c" } as CSSProperties}>
      <div className="container">
        <header className={styles.hero}>
          <p className="eyebrow">{t("eyebrow")} · PUBG MOBILE</p>
          <h1 className="page-title">{event.displayName || t("title")}</h1>
          <div className={styles.statusRow}>
            <span className={styles.status}>{t(event.status === "live" ? "statusLive" : event.status === "completed" ? "statusCompleted" : "statusUpcoming")}</span>
            {countdownParts && event.status === "upcoming" && (
              <span className={styles.countdown} aria-live="polite">
                {t("startsIn")} {countdownParts[0]} {t("days")} {countdownParts[1]}:{String(countdownParts[2]).padStart(2, "0")}:{String(countdownParts[3]).padStart(2, "0")}
              </span>
            )}
          </div>
          <div className={styles.eventDetails}>
            <span><strong>{t("date")}</strong> {formatLocalDate(event.startsAt, locale) ?? t("notAvailable")} – {formatLocalDate(event.endsAt, locale) ?? t("notAvailable")}</span>
            <span><strong>{t("venue")}</strong> {event.venue || t("notAvailable")}</span>
            <span><strong>{t("prize")}</strong> {event.prizePool || t("notAvailable")}</span>
          </div>
          <section className={styles.watch}>
            <h2>{t("watch")}</h2>
            {officialLinks.length > 0 && (
              <div className={styles.links}>
                {officialLinks.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{t("officialChannels")}</a>)}
              </div>
            )}
            {event.status === "live" && streams.length > 0 ? (
              <div className={styles.streamGrid}>
                {streams.map((stream) => (
                  <iframe
                    key={stream.videoId}
                    title={`${stream.title} — ${stream.channelTitle}`}
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(stream.videoId)}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ))}
              </div>
            ) : <p>{t("notAvailable")}</p>}
          </section>
        </header>

        <section className={styles.stats} aria-label={t("eyebrow")}>
          {([
            [t("confirmed"), `${confirmedCount}${event.totalSlots ? ` / ${event.totalSlots}` : ""}`],
            [t("countries"), String(countryCount)],
            [t("stages"), String(stages.length)],
            [t("prize"), event.prizePool || t("notAvailable")],
          ] as const).map(([label, value]) => (
            <div className={styles.stat} key={label}>
              <motion.strong
                key={`${label}:${value}`}
                initial={reducedMotion ? false : { opacity: 0.6, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
              >{value}</motion.strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <div><p className="eyebrow">{t("confirmed")}: {confirmedCount}{event.totalSlots ? ` / ${event.totalSlots}` : ""}</p><h2>{t("teams")}</h2></div>
            <div className={styles.source}>
              <span>{sourceLabel(sourceType, t)}</span>
              {stale && <strong role="status">{t("stale")}</strong>}
            </div>
          </div>
          {refreshError && <p role="status" className={styles.error}>{t("refreshError")}</p>}
          <div className={styles.filters}>
            <label>{t("search")}<input value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            <label>{t("country")}
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="all">{t("allCountries")}</option>
                {countries.map((code) => <option key={code} value={code}>{countryFlagEmoji(code)} {countryNames.of(code) ?? code} ({event.participants.filter((item) => item.countryCode === code).length})</option>)}
              </select>
            </label>
            <label>{t("sort")}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">{t("sortName")}</option><option value="country">{t("sortCountry")}</option><option value="qualification">{t("sortQualification")}</option>
              </select>
            </label>
            <div className={styles.viewToggle}>
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>{t("grid")}</button>
              <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>{t("table")}</button>
            </div>
          </div>
          {!visibleTeams.length ? <p>{t("noTeams")}</p> : view === "grid" ? (
            <div className={styles.teamGrid}>
              {visibleTeams.map((item) => (
                <article className={styles.teamCard} key={item.id} id={`team-${item.id}`}>
                  <div className={styles.teamTop}><span className={styles.initial}>{item.team.name.slice(0, 2).toUpperCase()}</span><strong>{item.team.name}</strong></div>
                  <p>{countryFlagEmoji(item.countryCode)} {countryNames.of(item.countryCode) ?? item.countryCode}</p>
                  <p><strong>{t("qualification")}:</strong> {item.qualificationPath || t("notAvailable")}</p>
                  <p><strong>{t("stage")}:</strong> {item.stage?.name ?? t("notAvailable")} · {item.status}</p>
                  <button type="button" className={styles.expand} aria-expanded={expanded.includes(item.id)} onClick={() => setExpanded((old) => old.includes(item.id) ? old.filter((id) => id !== item.id) : [...old, item.id])}>{t("expandRoster")} ({item.team.players.length})</button>
                  {expanded.includes(item.id) && (
                    <ul>{item.team.players.length ? item.team.players.map((player) => <li key={player.id}>{player.name}{player.role ? ` · ${player.role}` : ""}</li>) : <li>{t("noRoster")}</li>}</ul>
                  )}
                  <a className={styles.teamLink} href={`/games/pubg-mobile/pmgc/teams/${encodeURIComponent(item.team.slug)}`}>{t("teamPage")} →</a>
                  <small>{t("source")}: <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName}</a></small>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.tableWrap}><table><thead><tr><th>{t("teams")}</th><th>{t("country")}</th><th>{t("qualification")}</th><th>{t("stage")}</th><th>{t("status")}</th><th>{t("roster")}</th></tr></thead>
              <tbody>{visibleTeams.map((item) => <tr key={item.id}><td><a href={`/games/pubg-mobile/pmgc/teams/${encodeURIComponent(item.team.slug)}`}>{item.team.name}</a></td><td>{countryFlagEmoji(item.countryCode)} {countryNames.of(item.countryCode) ?? item.countryCode}</td><td>{item.qualificationPath ?? t("notAvailable")}</td><td>{item.stage?.name ?? t("notAvailable")}</td><td>{item.status}</td><td>{item.team.players.length}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.heading}><h2>{t("stages")}</h2><div className={styles.tabs} role="tablist">
            <button type="button" aria-selected={selectedStage === "all"} onClick={() => setSelectedStage("all")}>{t("results")}</button>
            {stages.map((stage) => <button key={stage.id} type="button" aria-selected={selectedStage === stage.id} onClick={() => setSelectedStage(stage.id)}>{stage.name}</button>)}
          </div></div>
          {!stages.length && <p>{t("noStages")}</p>}
          <div className={styles.resultGrid}>
            <section><h3>{t("standings")}</h3>{standings.length ? <div className={styles.tableWrap}><table><thead><tr><th>#</th><th>{t("teams")}</th><th>{t("points")}</th><th>{t("placementPoints")}</th><th>{t("kills")}</th><th>{t("source")}</th></tr></thead><tbody>{standings.map((row) => <tr key={row.id}><td>{row.rank ?? "TBD"}</td><td>{row.participation.team.name}</td><td>{row.points ?? "TBD"}</td><td>{row.placementPoints ?? "TBD"}</td><td>{row.kills ?? "TBD"}</td><td><a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName}</a></td></tr>)}</tbody></table></div> : <p>{t("noStandings")}</p>}</section>
            <section><h3>{t("schedule")} / {t("results")}</h3>{matches.length ? <ul className={styles.matchList}>{matches.map((match) => <li key={match.id}><strong>{match.title}</strong><span>{match.stage?.name ?? t("notAvailable")} · {match.status}</span><span>{formatLocalDate(match.startsAt, locale) ?? t("notAvailable")}</span><span>{match.results?.map((result) => `${result.team}: ${result.placement ?? "TBD"} · ${result.points ?? "TBD"} pts · ${result.kills ?? "TBD"} kills`).join(" | ")}</span><small>{t("source")}: <a href={match.sourceUrl} target="_blank" rel="noreferrer">{match.sourceName}</a></small></li>)}</ul> : <p>{t("noSchedule")}</p>}</section>
          </div>
          <h3>{t("history")}</h3>
          <div className={styles.resultGrid}>{event.participants.map((participation) => <article id={`team-results-${participation.id}`} key={participation.id}><strong>{participation.team.name}</strong>{event.standings.filter((standing) => standing.participationId === participation.id).length ? <ul>{event.standings.filter((standing) => standing.participationId === participation.id).map((standing) => <li key={standing.id}>{standing.stage?.name ?? t("notAvailable")}: {t("placement")} {standing.rank ?? "TBD"}, {standing.points ?? "TBD"} pts, {standing.kills ?? "TBD"} kills</li>)}</ul> : <p>{t("notAvailable")}</p>}</article>)}</div>
        </section>
        <section className={styles.section}>
          <h2>{t("pastChampions")}</h2>
          {event.champions.length ? <ul>{event.champions.map((champion) => <li key={champion.id}>{champion.entityId} · {t("source")}: <a href={champion.sourceUrl} target="_blank" rel="noreferrer">{champion.sourceName}</a></li>)}</ul> : <p>{t("noChampions")}</p>}
        </section>
        <footer className={styles.attribution}>
          {t("source")}: <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName}</a> · {t("updated")} {formatLocalDate(event.latestUpdatedAt, locale) ?? t("notAvailable")}
          {event.sourceName.toLowerCase().includes("liquipedia") && <p>{t("attribution")} <a href="https://liquipedia.net/api-terms-of-use" target="_blank" rel="noreferrer">Liquipedia API terms</a></p>}
        </footer>
      </div>
    </main>
  );
}
