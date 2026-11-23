"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocale } from "@/i18n/locale-context";
import { spotlightText } from "@/i18n/messages/spotlight";
import { parseSpotlightCsv } from "@/lib/spotlight-domain";
import type { SpotlightSnapshot } from "@/components/spotlight-event";
import styles from "./spotlight.module.css";

type Draft = {
  id: string;
  kind: string;
  facts: unknown;
  sourceName: string;
  sourceUrl: string;
  createdAt: string;
};
type ProviderStatus = {
  name: string;
  configured: boolean;
  enabled: boolean;
  budgetUsed?: number | null;
  budgetLimit?: number;
  reason: string;
  checkedAt: string | null;
};
type SourceStatus = { sourceName: string; sourceUrl: string; fetchedAt: string } | null;

function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isoDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Enter a valid local date and time.");
  return date.toISOString();
}

export function SpotlightAdmin() {
  const { locale } = useLocale();
  const t = useCallback(
    (key: Parameters<typeof spotlightText>[0]) => spotlightText(key, locale),
    [locale],
  );
  const [enabled, setEnabled] = useState(false);
  const [event, setEvent] = useState<SpotlightSnapshot | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [lastSync, setLastSync] = useState<SourceStatus>(null);
  const [lastError, setLastError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState("team,country,path,source_url\n");
  const [csvPreview, setCsvPreview] = useState<string>("");
  const [aiSource, setAiSource] = useState("");
  const [matchResults, setMatchResults] = useState("[]");
  const [champion, setChampion] = useState({ name: "", sourceName: "Admin-managed data", sourceUrl: "" });
  const [eventForm, setEventForm] = useState({
    displayName: "PUBG Mobile Global Championship",
    status: "upcoming",
    startsAt: "",
    endsAt: "",
    venue: "",
    prizePool: "",
    totalSlots: "",
    officialLinks: "",
    sourceName: "Admin-managed data",
    sourceUrl: "",
  });
  const [teamForm, setTeamForm] = useState({
    name: "", countryCode: "", region: "", qualificationPath: "",
    status: "confirmed", sourceName: "Admin-managed data", sourceUrl: "",
  });
  const [stageForm, setStageForm] = useState({
    name: "", sortOrder: "0", status: "upcoming", startsAt: "", endsAt: "",
    sourceName: "Admin-managed data", sourceUrl: "",
  });
  const [standingForm, setStandingForm] = useState({
    teamSlug: "", stageName: "", rank: "", points: "", placementPoints: "", kills: "",
    sourceName: "Admin-managed data", sourceUrl: "",
  });
  const [matchForm, setMatchForm] = useState({
    title: "", stageName: "", teamSlug: "", status: "scheduled", startsAt: "",
    sourceName: "Admin-managed data", sourceUrl: "",
  });
  const [playerForm, setPlayerForm] = useState({
    teamSlug: "", name: "", role: "", sourceName: "Admin-managed data", sourceUrl: "",
  });

  const refresh = useCallback(async () => {
    const [flagResponse, eventResponse, draftResponse, statusResponse] = await Promise.all([
      fetch("/api/admin/spotlight", { cache: "no-store" }),
      fetch("/api/admin/spotlight/pmgc", { cache: "no-store" }),
      fetch("/api/admin/spotlight/pmgc/imports", { cache: "no-store" }),
      fetch("/api/admin/spotlight/status", { cache: "no-store" }),
    ]);
    const [flag, eventPayload, draftPayload, statusPayload] = await Promise.all([
      flagResponse.json(), eventResponse.json(), draftResponse.json(), statusResponse.json(),
    ]) as [
      { enabled?: boolean; error?: string },
      { event?: SpotlightSnapshot | null; error?: string },
      { drafts?: Draft[]; error?: string },
      { providers?: ProviderStatus[]; error?: string; lastSync?: SourceStatus; lastError?: string },
    ];
    for (const [response, payload] of [
      [flagResponse, flag], [eventResponse, eventPayload], [draftResponse, draftPayload], [statusResponse, statusPayload],
    ] as const) {
      if (!response.ok) throw new Error(payload.error ?? t("error"));
    }
    setEnabled(flag.enabled ?? false);
    setEvent(eventPayload.event ?? null);
    setDrafts(draftPayload.drafts ?? []);
    setProviders(statusPayload.providers ?? []);
    setLastSync(statusPayload.lastSync ?? null);
    setLastError(statusPayload.lastError ?? "");
    if (eventPayload.event) {
      const saved = eventPayload.event;
      const officialLinks = Array.isArray(saved.officialLinks)
        ? saved.officialLinks.filter((item): item is string => typeof item === "string").join("\n")
        : "";
      setEventForm((old) => ({
        ...old,
        displayName: saved.displayName,
        status: saved.status,
        startsAt: localDateTime(saved.startsAt),
        endsAt: localDateTime(saved.endsAt),
        venue: saved.venue ?? "",
        prizePool: saved.prizePool ?? "",
        totalSlots: saved.totalSlots?.toString() ?? "",
        officialLinks,
        sourceName: saved.sourceName,
        sourceUrl: saved.sourceUrl,
      }));
    }
  }, [t]);

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      console.error("Could not load spotlight admin data.", error);
      setNotice(error instanceof Error ? error.message : t("error"));
    });
  }, [refresh, t]);

  async function send(url: string, method: "POST" | "PATCH", body: unknown) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? t("error"));
      setNotice(payload.message ?? t("success"));
      await refresh();
    } catch (error) {
      console.error("Spotlight admin action failed.", error);
      setNotice(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(
    event: FormEvent<HTMLFormElement>,
    action: string,
    data: Record<string, unknown>,
  ) {
    event.preventDefault();
    await send("/api/admin/spotlight/pmgc", "POST", { action, ...data });
  }

  function localPreview(value: string) {
    setCsv(value);
    setCsvPreview("");
    if (!value.trim()) return;
    try {
      const rows = parseSpotlightCsv(value);
      setCsvPreview(`${rows.length} ${t("teams")} — ${t("validPreview")}`);
    } catch (error) {
      setCsvPreview(error instanceof Error ? error.message : t("error"));
    }
  }

  const teamOptions = event?.participants ?? [];
  const stageOptions = event?.stages ?? [];
  return (
    <div className={styles.admin}>
      <p className="eyebrow">{t("eyebrow")} · ADMIN</p>
      <h1 className="page-title">{t("adminTitle")}</h1>
      <p className="page-intro">{t("adminIntro")}</p>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <section className={styles.adminSection}>
        <label className={styles.flagToggle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              void send("/api/admin/spotlight", "PATCH", { enabled: e.target.checked });
            }}
          />
          {t("enabled")}
        </label>
      </section>

      <form className={styles.adminSection} onSubmit={(e) => {
        e.preventDefault();
        try {
          void send("/api/admin/spotlight/pmgc", "POST", {
            action: "event",
            displayName: eventForm.displayName,
            status: eventForm.status,
            startsAt: isoDateTime(eventForm.startsAt),
            endsAt: isoDateTime(eventForm.endsAt),
            venue: eventForm.venue || null,
            prizePool: eventForm.prizePool || null,
            totalSlots: eventForm.totalSlots ? Number(eventForm.totalSlots) : null,
            officialLinks: eventForm.officialLinks.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
            sourceName: eventForm.sourceName,
            sourceUrl: eventForm.sourceUrl,
          });
        } catch (error) {
          setNotice(error instanceof Error ? error.message : t("error"));
        }
      }}>
        <h2>{t("eventName")}</h2>
        <div className={styles.formGrid}>
          <label>{t("eventName")}<input required maxLength={160} value={eventForm.displayName} onChange={(e) => setEventForm({ ...eventForm, displayName: e.target.value })} /></label>
          <label>{t("status")}<select value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}><option value="upcoming">{t("upcoming")}</option><option value="live">{t("live")}</option><option value="completed">{t("completed")}</option></select></label>
          <label>{t("startAt")}<input type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} /></label>
          <label>{t("endAt")}<input type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} /></label>
          <label>{t("venue")}<input maxLength={160} value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} /></label>
          <label>{t("prizePool")}<input maxLength={80} value={eventForm.prizePool} onChange={(e) => setEventForm({ ...eventForm, prizePool: e.target.value })} /></label>
          <label>{t("totalSlots")}<input type="number" min="1" max="500" value={eventForm.totalSlots} onChange={(e) => setEventForm({ ...eventForm, totalSlots: e.target.value })} /></label>
          <label>{t("sourceName")}<input required maxLength={120} value={eventForm.sourceName} onChange={(e) => setEventForm({ ...eventForm, sourceName: e.target.value })} /></label>
          <label>{t("sourceUrl")}<input required type="url" maxLength={2048} value={eventForm.sourceUrl} onChange={(e) => setEventForm({ ...eventForm, sourceUrl: e.target.value })} /></label>
          <label className={styles.wide}>{t("officialLinksLabel")}<textarea rows={3} value={eventForm.officialLinks} onChange={(e) => setEventForm({ ...eventForm, officialLinks: e.target.value })} /></label>
        </div>
        <button className="button button-primary" disabled={busy}>{busy ? t("saving") : t("saveEvent")}</button>
      </form>

      {event && (
        <section className={styles.adminSection}>
          <h2>{t("pin")}</h2>
          <div className={styles.recordRow}>
            <strong>{event.displayName}</strong>
            <button type="button" className="button button-quiet" onClick={() => void send("/api/admin/spotlight/pmgc", "POST", { action: "pin", entity: "event", id: event.id, pinned: !event.pinned })}>
              {event.pinned ? t("unpin") : t("pin")}
            </button>
          </div>
          {event.participants.map((participation) => (
            <div className={styles.recordRow} key={participation.id}>
              <span>{participation.team.name} · {participation.countryCode}</span>
              <button type="button" className="button button-quiet" onClick={() => void send("/api/admin/spotlight/pmgc", "POST", { action: "pin", entity: "participation", id: participation.id, pinned: !participation.pinned })}>
                {participation.pinned ? t("unpin") : t("pin")}
              </button>
              <button type="button" className="button button-quiet" onClick={() => void send("/api/admin/spotlight/pmgc", "POST", { action: "removeTeam", participationId: participation.id })}>{t("remove")}</button>
            </div>
          ))}
        </section>
      )}

      <form className={styles.adminSection} onSubmit={(e) => void onSubmit(e, "team", {
        ...teamForm, countryCode: teamForm.countryCode.toUpperCase(),
      })}>
        <h2>{t("addTeam")}</h2>
        <div className={styles.formGrid}>
          <label>{t("teamName")}<input required value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} /></label>
          <label>{t("countryCode")}<input required minLength={2} maxLength={2} value={teamForm.countryCode} onChange={(e) => setTeamForm({ ...teamForm, countryCode: e.target.value })} /></label>
          <label>{t("region")}<input value={teamForm.region} onChange={(e) => setTeamForm({ ...teamForm, region: e.target.value })} /></label>
          <label>{t("qualificationPathLabel")}<input value={teamForm.qualificationPath} onChange={(e) => setTeamForm({ ...teamForm, qualificationPath: e.target.value })} /></label>
          <label>{t("teamStatus")}<select value={teamForm.status} onChange={(e) => setTeamForm({ ...teamForm, status: e.target.value })}><option value="confirmed">{t("confirmedStatus")}</option><option value="pending">{t("pending")}</option><option value="withdrawn">{t("withdrawn")}</option></select></label>
          <label>{t("sourceName")}<input required value={teamForm.sourceName} onChange={(e) => setTeamForm({ ...teamForm, sourceName: e.target.value })} /></label>
          <label className={styles.wide}>{t("sourceUrl")}<input required type="url" value={teamForm.sourceUrl} onChange={(e) => setTeamForm({ ...teamForm, sourceUrl: e.target.value })} /></label>
        </div>
        <button className="button" disabled={busy}>{t("addTeam")}</button>
      </form>

      <form className={styles.adminSection} onSubmit={(e) => void onSubmit(e, "stage", {
        ...stageForm, sortOrder: Number(stageForm.sortOrder),
        startsAt: isoDateTime(stageForm.startsAt), endsAt: isoDateTime(stageForm.endsAt),
      })}>
        <h2>{t("addStage")}</h2>
        <div className={styles.formGrid}>
          <label>{t("stageName")}<input required value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} /></label>
          <label>{t("sortOrder")}<input type="number" min="0" max="100" value={stageForm.sortOrder} onChange={(e) => setStageForm({ ...stageForm, sortOrder: e.target.value })} /></label>
          <label>{t("status")}<select value={stageForm.status} onChange={(e) => setStageForm({ ...stageForm, status: e.target.value })}><option value="upcoming">{t("upcoming")}</option><option value="live">{t("live")}</option><option value="completed">{t("completed")}</option></select></label>
          <label>{t("startAt")}<input type="datetime-local" value={stageForm.startsAt} onChange={(e) => setStageForm({ ...stageForm, startsAt: e.target.value })} /></label>
          <label>{t("endAt")}<input type="datetime-local" value={stageForm.endsAt} onChange={(e) => setStageForm({ ...stageForm, endsAt: e.target.value })} /></label>
          <label>{t("sourceName")}<input required value={stageForm.sourceName} onChange={(e) => setStageForm({ ...stageForm, sourceName: e.target.value })} /></label>
          <label className={styles.wide}>{t("sourceUrl")}<input required type="url" value={stageForm.sourceUrl} onChange={(e) => setStageForm({ ...stageForm, sourceUrl: e.target.value })} /></label>
        </div>
        <button className="button" disabled={busy}>{t("addStage")}</button>
      </form>

      <form className={styles.adminSection} onSubmit={(e) => void onSubmit(e, "player", playerForm)}>
        <h2>{t("addPlayer")}</h2>
        <div className={styles.formGrid}>
          <label>{t("teams")}<select required value={playerForm.teamSlug} onChange={(e) => setPlayerForm({ ...playerForm, teamSlug: e.target.value })}><option value="">—</option>{teamOptions.map((item) => <option key={item.team.slug} value={item.team.slug}>{item.team.name}</option>)}</select></label>
          <label>{t("playerName")}<input required value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} /></label>
          <label>{t("playerRole")}<input value={playerForm.role} onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })} /></label>
          <label>{t("sourceName")}<input required value={playerForm.sourceName} onChange={(e) => setPlayerForm({ ...playerForm, sourceName: e.target.value })} /></label>
          <label className={styles.wide}>{t("sourceUrl")}<input required type="url" value={playerForm.sourceUrl} onChange={(e) => setPlayerForm({ ...playerForm, sourceUrl: e.target.value })} /></label>
        </div>
        <button className="button" disabled={busy}>{t("addPlayer")}</button>
      </form>

      <form className={styles.adminSection} onSubmit={(e) => void onSubmit(e, "standing", {
        ...standingForm,
        rank: standingForm.rank ? Number(standingForm.rank) : null,
        points: standingForm.points ? Number(standingForm.points) : null,
        placementPoints: standingForm.placementPoints ? Number(standingForm.placementPoints) : null,
        kills: standingForm.kills ? Number(standingForm.kills) : null,
      })}>
        <h2>{t("addStanding")}</h2>
        <div className={styles.formGrid}>
          <label>{t("teams")}<select required value={standingForm.teamSlug} onChange={(e) => setStandingForm({ ...standingForm, teamSlug: e.target.value })}><option value="">—</option>{teamOptions.map((item) => <option key={item.team.slug} value={item.team.slug}>{item.team.name}</option>)}</select></label>
          <label>{t("stageName")}<select value={standingForm.stageName} onChange={(e) => setStandingForm({ ...standingForm, stageName: e.target.value })}><option value="">—</option>{stageOptions.map((stage) => <option key={stage.id}>{stage.name}</option>)}</select></label>
          <label>{t("rank")}<input type="number" min="1" value={standingForm.rank} onChange={(e) => setStandingForm({ ...standingForm, rank: e.target.value })} /></label>
          <label>{t("pointsLabel")}<input type="number" step="any" value={standingForm.points} onChange={(e) => setStandingForm({ ...standingForm, points: e.target.value })} /></label>
          <label>{t("placementPoints")}<input type="number" step="any" value={standingForm.placementPoints} onChange={(e) => setStandingForm({ ...standingForm, placementPoints: e.target.value })} /></label>
          <label>{t("killsLabel")}<input type="number" min="0" value={standingForm.kills} onChange={(e) => setStandingForm({ ...standingForm, kills: e.target.value })} /></label>
          <label>{t("sourceName")}<input required value={standingForm.sourceName} onChange={(e) => setStandingForm({ ...standingForm, sourceName: e.target.value })} /></label>
          <label className={styles.wide}>{t("sourceUrl")}<input required type="url" value={standingForm.sourceUrl} onChange={(e) => setStandingForm({ ...standingForm, sourceUrl: e.target.value })} /></label>
        </div>
        <button className="button" disabled={busy}>{t("addStanding")}</button>
      </form>

      <form className={styles.adminSection} onSubmit={(e) => {
        e.preventDefault();
        try {
          const results = JSON.parse(matchResults) as unknown;
          void send("/api/admin/spotlight/pmgc", "POST", {
            action: "match", ...matchForm,
            startsAt: isoDateTime(matchForm.startsAt),
            teamSlug: matchForm.teamSlug || undefined,
            results,
          });
        } catch (error) {
          setNotice(error instanceof Error ? error.message : t("error"));
        }
      }}>
        <h2>{t("addMatch")}</h2>
        <div className={styles.formGrid}>
          <label>{t("matchTitle")}<input required value={matchForm.title} onChange={(e) => setMatchForm({ ...matchForm, title: e.target.value })} /></label>
          <label>{t("stageName")}<select value={matchForm.stageName} onChange={(e) => setMatchForm({ ...matchForm, stageName: e.target.value })}><option value="">—</option>{stageOptions.map((stage) => <option key={stage.id}>{stage.name}</option>)}</select></label>
          <label>{t("teams")}<select value={matchForm.teamSlug} onChange={(e) => setMatchForm({ ...matchForm, teamSlug: e.target.value })}><option value="">—</option>{teamOptions.map((item) => <option key={item.team.slug} value={item.team.slug}>{item.team.name}</option>)}</select></label>
          <label>{t("matchStatus")}<select value={matchForm.status} onChange={(e) => setMatchForm({ ...matchForm, status: e.target.value })}><option value="scheduled">{t("scheduled")}</option><option value="live">{t("live")}</option><option value="completed">{t("completed")}</option><option value="cancelled">{t("cancelled")}</option></select></label>
          <label>{t("startAt")}<input type="datetime-local" value={matchForm.startsAt} onChange={(e) => setMatchForm({ ...matchForm, startsAt: e.target.value })} /></label>
          <label>{t("sourceName")}<input required value={matchForm.sourceName} onChange={(e) => setMatchForm({ ...matchForm, sourceName: e.target.value })} /></label>
          <label className={styles.wide}>{t("sourceUrl")}<input required type="url" value={matchForm.sourceUrl} onChange={(e) => setMatchForm({ ...matchForm, sourceUrl: e.target.value })} /></label>
          <label className={styles.wide}>{t("jsonLabel")}<textarea rows={3} value={matchResults} onChange={(e) => setMatchResults(e.target.value)} /></label>
        </div>
        <button className="button" disabled={busy}>{t("addMatch")}</button>
      </form>

      <form className={styles.adminSection} onSubmit={(e) => void onSubmit(e, "csv", { csv })}>
        <h2>{t("importCsv")}</h2>
        <label>{t("importCsv")}<textarea rows={7} value={csv} onChange={(e) => localPreview(e.target.value)} /></label>
        <p role="status">{csvPreview}</p>
        <button type="button" className="button button-quiet" onClick={() => localPreview(csv)}>{t("previewCsv")}</button>
        <button className="button" disabled={busy || !csvPreview.includes(t("validPreview"))}>{t("commitCsv")}</button>
      </form>

      <form className={styles.adminSection} onSubmit={(e) => {
        e.preventDefault();
        try {
          const url = new URL(aiSource);
          void send("/api/admin/spotlight/pmgc/imports", "POST", { sourceUrl: url.toString() });
        } catch {
          void send("/api/admin/spotlight/pmgc/imports", "POST", { query: aiSource });
        }
      }}>
        <h2>{t("aiImport")}</h2>
        <p>{t("adminIntro")}</p>
        <label>{t("sourceOrQuery")}<input value={aiSource} onChange={(e) => setAiSource(e.target.value)} /></label>
        <button className="button" disabled={busy || !aiSource.trim()}>{t("createDraft")}</button>
        <h3>{t("pendingDrafts")}</h3>
        {drafts.length ? drafts.map((draft) => (
          <article className={styles.draft} key={draft.id}>
            <p><strong>{draft.sourceName}</strong> · <a href={draft.sourceUrl} target="_blank" rel="noreferrer">{draft.sourceUrl}</a></p>
            <pre>{JSON.stringify(draft.facts, null, 2)}</pre>
            <button type="button" className="button button-primary" onClick={() => void send("/api/admin/spotlight/pmgc", "POST", { action: "review", draftId: draft.id, decision: "approve" })}>{t("approve")}</button>
            <button type="button" className="button button-quiet" onClick={() => void send("/api/admin/spotlight/pmgc", "POST", { action: "review", draftId: draft.id, decision: "reject" })}>{t("reject")}</button>
          </article>
        )) : <p>{t("notAvailable")}</p>}
      </form>

      <form className={styles.adminSection} onSubmit={(e) => void onSubmit(e, "champion", champion)}>
        <h2>{t("pastChampions")}</h2>
        <div className={styles.formGrid}>
          <label>{t("teamName")}<input required value={champion.name} onChange={(e) => setChampion({ ...champion, name: e.target.value })} /></label>
          <label>{t("sourceName")}<input required value={champion.sourceName} onChange={(e) => setChampion({ ...champion, sourceName: e.target.value })} /></label>
          <label className={styles.wide}>{t("sourceUrl")}<input required type="url" value={champion.sourceUrl} onChange={(e) => setChampion({ ...champion, sourceUrl: e.target.value })} /></label>
        </div>
        <button className="button" disabled={busy}>{t("save")}</button>
      </form>

      <section className={styles.adminSection}>
        <h2>{t("providerStatus")}</h2>
        <button type="button" className="button" disabled={busy} onClick={() => void send("/api/admin/spotlight/status", "POST", {})}>{t("checkProvider")}</button>
        <p>{t("lastSync")}: {lastSync ? <><a href={lastSync.sourceUrl} target="_blank" rel="noreferrer">{lastSync.sourceName}</a> · {new Date(lastSync.fetchedAt).toLocaleString(locale)}</> : t("notAvailable")}</p>
        <p>{t("lastError")}: {lastError || t("notAvailable")}</p>
        <p>{t("manualSyncDisabled")}</p>
        {providers.map((provider) => <article className={styles.provider} key={provider.name}><strong>{provider.name}</strong><span>{provider.enabled ? t("live") : t("pending")}</span><p>{provider.reason}</p><small>{t("budgetUsed")}: {provider.budgetUsed ?? t("notAvailable")} / {provider.budgetLimit ?? t("notAvailable")}</small></article>)}
      </section>
    </div>
  );
}
