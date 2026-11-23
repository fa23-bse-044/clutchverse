"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { useLocale } from "@/i18n/locale-context";

type Entrant = { id: string; name: string; ready: boolean };
type LobbyMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null };
};
type Evidence = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
  aiSuggestion?: { placement?: number; kills?: number; score?: number } | null;
  visionStatus?: "suggested" | "unconfigured" | "failed";
};
type Dispute = {
  id: string;
  status: string;
  reason: string;
  resolution: string | null;
  dueAt: string;
  messages: LobbyMessage[];
};
type LobbyState = {
  match: {
    id: string;
    state: string;
    round: number;
    position: number;
    startsAt: string | null;
    tournamentId: string;
    tournamentTitle: string;
    format: string;
    organizerId: string;
    roomId: string | null;
    roomPassword: string | null;
    roomRevealAt: string | null;
    checkInStartsAt: string | null;
    checkInEndsAt: string | null;
    entrantA: Entrant | null;
    entrantB: Entrant | null;
  };
  currentUserId: string;
  canManage: boolean;
  canImportScores: boolean;
  readyStatuses: { userId: string; ready: boolean; updatedAt: string }[];
  messages: LobbyMessage[];
  submissions: {
    id: string;
    registrationId: string;
    scoreA: number;
    scoreB: number;
    placementA: number | null;
    placementB: number | null;
    killsA: number | null;
    killsB: number | null;
    evidenceId: string | null;
    createdAt: string;
  }[];
  dispute: { id: string; reason: string; dueAt: string; createdAt: string } | null;
};

function localDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIso(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

export function MatchLobby({ matchId }: { matchId: string }) {
  const { messages: catalogs, locale } = useLocale();
  const copy = catalogs.matchLobby;
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [roomRevealAt, setRoomRevealAt] = useState("");
  const [checkInStartsAt, setCheckInStartsAt] = useState("");
  const [checkInEndsAt, setCheckInEndsAt] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeBody, setDisputeBody] = useState("");
  const [resolution, setResolution] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [placementA, setPlacementA] = useState("");
  const [placementB, setPlacementB] = useState("");
  const [killsA, setKillsA] = useState("");
  const [killsB, setKillsB] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [realtime, setRealtime] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const initializedSettings = useRef(false);

  const refresh = useCallback(async () => {
    const [lobbyResponse, disputeResponse] = await Promise.all([
      fetch(`/api/matches/${encodeURIComponent(matchId)}/lobby`, {
        cache: "no-store",
      }),
      fetch(`/api/matches/${encodeURIComponent(matchId)}/dispute`, {
        cache: "no-store",
      }),
    ]);
    const lobbyData = (await lobbyResponse.json()) as LobbyState & { error?: string };
    const disputeData = (await disputeResponse.json()) as {
      dispute: Dispute | null;
      evidence: Evidence[];
      error?: string;
    };
    if (!lobbyResponse.ok) throw new Error(lobbyData.error ?? copy.loadError);
    if (!disputeResponse.ok)
      throw new Error(disputeData.error ?? copy.loadError);
    setLobby(lobbyData);
    setDispute(disputeData.dispute);
    setEvidence((previous) =>
      disputeData.evidence.map((item) => ({
        ...item,
        ...previous.find((existing) => existing.id === item.id),
      })),
    );
    if (!initializedSettings.current) {
      setRoomId(lobbyData.match.roomId ?? "");
      setRoomPassword(lobbyData.match.roomPassword ?? "");
      setRoomRevealAt(localDateTime(lobbyData.match.roomRevealAt));
      setCheckInStartsAt(localDateTime(lobbyData.match.checkInStartsAt));
      setCheckInEndsAt(localDateTime(lobbyData.match.checkInEndsAt));
      initializedSettings.current = true;
    }
  }, [matchId, copy.loadError]);

  useEffect(() => {
    let active = true;
    const load = () => {
      void refresh().catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : copy.loadError);
      });
    };
    load();
    const poll = window.setInterval(load, 12_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    void fetch("/api/realtime-token")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { token?: string };
        return data.token ?? null;
      })
      .then((token) => {
        if (!active || !token) return;
        const socket = io(
          process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001",
          { auth: { token }, transports: ["websocket", "polling"] },
        );
        socketRef.current = socket;
        socket.on("connect", () => {
          socket.emit(
            "match:subscribe",
            { matchId },
            (result: { ok?: boolean; error?: string }) => {
              if (!active) return;
              setRealtime(Boolean(result?.ok));
              if (result?.error) setNotice(result.error);
            },
          );
        });
        socket.on("match:lobby:update", (event: { matchId?: string }) => {
          if (event.matchId === matchId) load();
        });
        socket.on("match:lobby:message", (event: { matchId?: string }) => {
          if (event.matchId === matchId) load();
        });
        socket.on("disconnect", () => setRealtime(false));
        socket.on("connect_error", () => setRealtime(false));
      })
      .catch(() => setRealtime(false));
    return () => {
      active = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [matchId, refresh, copy.loadError]);

  async function sendJson(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
  ) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        error?: string;
        status?: string;
      };
      if (!response.ok) throw new Error(result.error ?? copy.loadError);
      setNotice(
        result.status === "awaiting-opponent"
          ? copy.awaitingOpponent
          : result.status === "confirmed"
            ? copy.resultConfirmed
            : result.status === "disputed"
              ? copy.mismatch
            : copy.saved,
      );
      await refresh();
      return result;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.loadError);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendJson(`/api/matches/${encodeURIComponent(matchId)}/lobby`, "PATCH", {
      roomId,
      roomPassword,
      roomRevealAt: toIso(roomRevealAt),
      checkInStartsAt: toIso(checkInStartsAt),
      checkInEndsAt: toIso(checkInEndsAt),
    });
  }

  async function toggleReady() {
    if (!lobby) return;
    const isReady = lobby.readyStatuses.some(
      (status) => status.userId === lobby.currentUserId && status.ready,
    );
    await sendJson(`/api/matches/${encodeURIComponent(matchId)}/lobby`, "POST", {
      ready: !isReady,
    });
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await sendJson(
      `/api/matches/${encodeURIComponent(matchId)}/lobby/messages`,
      "POST",
      { body: chatBody },
    );
    if (result) setChatBody("");
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const screenshotInput = form.elements.namedItem("screenshot");
    const file =
      screenshotInput instanceof HTMLInputElement
        ? screenshotInput.files?.[0]
        : undefined;
    if (!file) {
      setNotice(copy.uploadError);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(
        `/api/matches/${encodeURIComponent(matchId)}/evidence`,
        { method: "POST", body },
      );
      const data = (await response.json()) as {
        evidence?: Evidence;
        error?: string;
      };
      if (!response.ok || !data.evidence)
        throw new Error(data.error ?? copy.uploadError);
      setEvidence((items) => [...items, data.evidence!]);
      setEvidenceId(data.evidence.id);
      const suggestion = data.evidence.aiSuggestion;
      if (suggestion?.score !== undefined) setScoreA(String(suggestion.score));
      if (suggestion?.placement !== undefined) setPlacementA(String(suggestion.placement));
      if (suggestion?.kills !== undefined) setKillsA(String(suggestion.kills));
      setNotice(
        data.evidence.visionStatus === "suggested"
          ? copy.aiSuggestion
          : data.evidence.visionStatus === "failed"
            ? copy.aiFailed
            : copy.aiNotConfigured,
      );
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.uploadError);
    } finally {
      setBusy(false);
      form.reset();
    }
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = (value: string) => (value === "" ? undefined : Number(value));
    await sendJson(`/api/matches/${encodeURIComponent(matchId)}/lobby/results`, "POST", {
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      ...(numeric(placementA) === undefined ? {} : { placementA: numeric(placementA) }),
      ...(numeric(placementB) === undefined ? {} : { placementB: numeric(placementB) }),
      ...(numeric(killsA) === undefined ? {} : { killsA: numeric(killsA) }),
      ...(numeric(killsB) === undefined ? {} : { killsB: numeric(killsB) }),
      ...(evidenceId ? { evidenceId } : {}),
    });
  }

  async function openDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await sendJson(
      `/api/matches/${encodeURIComponent(matchId)}/dispute`,
      "POST",
      { reason: disputeReason },
    );
    if (result) setDisputeReason("");
  }

  async function addDisputeMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dispute) return;
    const result = await sendJson(
      `/api/matches/${encodeURIComponent(matchId)}/dispute/messages`,
      "POST",
      { disputeId: dispute.id, body: disputeBody },
    );
    if (result) setDisputeBody("");
  }

  async function resolveDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lobby) return;
    const endpoint = dispute
      ? `/api/matches/${encodeURIComponent(matchId)}/dispute/resolve`
      : `/api/matches/${encodeURIComponent(matchId)}/lobby/results/confirm`;
    await sendJson(endpoint, "POST", {
      ...(dispute ? { disputeId: dispute.id } : {}),
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      resolution,
    });
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lobby) return;
    const form = event.currentTarget;
    const file = (form.elements.namedItem("roundCsv") as HTMLInputElement).files?.[0];
    if (!file) {
      setNotice(copy.importError);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const lines = (await file.text())
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const rows = lines[0]?.toLowerCase().includes("registrationid")
        ? lines.slice(1)
        : lines;
      const entries = rows.map((line) => {
        const [registrationId, placement, eliminations] = line.split(",").map((part) => part.trim());
        return {
          registrationId,
          placement: Number(placement),
          eliminations: Number(eliminations),
        };
      });
      if (
        entries.length < 2 ||
        entries.length > 100 ||
        entries.some(
          (entry) =>
            !entry.registrationId ||
            !Number.isInteger(entry.placement) ||
            entry.placement < 1 ||
            !Number.isInteger(entry.eliminations) ||
            entry.eliminations < 0,
        ) ||
        new Set(entries.map((entry) => entry.registrationId)).size !== entries.length
      ) {
        throw new Error(copy.importError);
      }
      const response = await fetch("/api/rankings/scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tournamentId: lobby.match.tournamentId,
          round: lobby.match.round,
          entries,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? copy.importError);
      setNotice(copy.importSuccess);
      form.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.importError);
    } finally {
      setBusy(false);
    }
  }

  if (!lobby) {
    return (
      <section className="section page-top">
        <div className="container">
          <p role="status">{notice || copy.loading}</p>
        </div>
      </section>
    );
  }

  const ready = lobby.readyStatuses.some(
    (status) => status.userId === lobby.currentUserId && status.ready,
  );
  const checkInStart = lobby.match.checkInStartsAt
    ? new Date(lobby.match.checkInStartsAt).getTime()
    : null;
  const checkInEnd = lobby.match.checkInEndsAt
    ? new Date(lobby.match.checkInEndsAt).getTime()
    : null;
  const checkInOpen =
    (checkInStart === null || now >= checkInStart) &&
    (checkInEnd === null || now <= checkInEnd);
  const revealTime = lobby.match.roomRevealAt
    ? new Date(lobby.match.roomRevealAt).getTime()
    : null;
  const checkInCountdown =
    checkInStart !== null && now < checkInStart
      ? Math.ceil((checkInStart - now) / 1000)
      : null;
  const readyCount = lobby.readyStatuses.filter((status) => status.ready).length;
  const statusLabels: Record<string, string> = {
    scheduled: copy.stateScheduled,
    ready: copy.stateReady,
    live: copy.stateLive,
    reported: copy.stateReported,
    disputed: copy.stateDisputed,
    completed: copy.stateCompleted,
  };
  const localeDate = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale) : "—";

  return (
    <section className="section page-top">
      <div className="container">
        <div className="eyebrow">{lobby.match.tournamentTitle}</div>
        <h1 className="page-title">{copy.title}.</h1>
        <p className="page-intro">
          {copy.match} · {copy.round} {lobby.match.round} · {copy.position}{" "}
          {lobby.match.position} · {copy.status}:{" "}
          {statusLabels[lobby.match.state] ?? lobby.match.state}
        </p>
        <p role="status" aria-live="polite">
          {notice}
        </p>
        <p aria-live="off">{realtime ? copy.connected : copy.polling}</p>

        <div className="admin-grid">
          <section className="panel admin-panel">
            <h2>{copy.roster}</h2>
            <ul>
              {[lobby.match.entrantA, lobby.match.entrantB].map((entrant) => (
                <li key={entrant?.id ?? "empty"}>
                  {entrant
                    ? `${entrant.name} · ${entrant.ready ? copy.ready : copy.notReady}`
                    : "—"}
                </li>
              ))}
            </ul>
            <p>
              {copy.ready}: {readyCount}
            </p>
            <h3>{copy.checkIn}</h3>
            <p>
              {copy.checkInStartsAt}: {localeDate(lobby.match.checkInStartsAt)}
            </p>
            <p>
              {copy.checkInEndsAt}: {localeDate(lobby.match.checkInEndsAt)}
            </p>
            {checkInCountdown !== null ? (
              <p>
                {copy.checkInOpens}: {Math.floor(checkInCountdown / 60)}:
                {String(checkInCountdown % 60).padStart(2, "0")}
              </p>
            ) : null}
            {lobby.match.checkInEndsAt && !checkInOpen ? (
              <p>{copy.checkInClosed}</p>
            ) : null}
            <button
              className="button button-primary"
              type="button"
              disabled={busy || !checkInOpen || !lobby.match.entrantA || !lobby.match.entrantB}
              onClick={() => void toggleReady()}
            >
              {ready ? copy.cancelReady : copy.readyUp}
            </button>
          </section>

          <section className="panel admin-panel">
            <h2>{copy.room}</h2>
            {revealTime !== null && now < revealTime && !lobby.canManage ? (
              <>
                <p>{copy.roomHidden}</p>
                <p>
                  {copy.revealAt}: {localeDate(lobby.match.roomRevealAt)}
                </p>
              </>
            ) : (
              <>
                <p>{copy.roomId}: {lobby.match.roomId ?? "—"}</p>
                <p>{copy.roomPassword}: {lobby.match.roomPassword ?? "—"}</p>
              </>
            )}
          </section>
        </div>

        {lobby.canManage ? (
          <section className="panel admin-panel">
            <h2>{copy.organizerControls}</h2>
            <form className="form-grid" onSubmit={(event) => void saveSettings(event)}>
              <label>
                {copy.roomId}
                <input value={roomId} maxLength={80} onChange={(event) => setRoomId(event.target.value)} />
              </label>
              <label>
                {copy.roomPassword}
                <input value={roomPassword} maxLength={120} onChange={(event) => setRoomPassword(event.target.value)} />
              </label>
              <label>
                {copy.revealAt}
                <input type="datetime-local" value={roomRevealAt} onChange={(event) => setRoomRevealAt(event.target.value)} />
              </label>
              <label>
                {copy.checkInStartsAt}
                <input type="datetime-local" value={checkInStartsAt} onChange={(event) => setCheckInStartsAt(event.target.value)} />
              </label>
              <label>
                {copy.checkInEndsAt}
                <input type="datetime-local" value={checkInEndsAt} onChange={(event) => setCheckInEndsAt(event.target.value)} />
              </label>
              <button className="button button-primary" type="submit" disabled={busy}>
                {copy.saveSettings}
              </button>
            </form>
          </section>
        ) : null}

        <div className="admin-grid">
          <section className="panel admin-panel">
            <h2>{copy.lobbyChat}</h2>
            <ol aria-live="polite">
              {lobby.messages.map((message) => (
                <li key={message.id}>
                  <strong>{message.author.name ?? copy.unknownUser}</strong>: {message.body}
                </li>
              ))}
            </ol>
            <form onSubmit={(event) => void sendMessage(event)}>
              <label>
                {copy.message}
                <input value={chatBody} maxLength={300} onChange={(event) => setChatBody(event.target.value)} />
              </label>
              <button className="button button-primary" type="submit" disabled={busy || !chatBody.trim()}>
                {copy.sendMessage}
              </button>
            </form>
          </section>

          <section className="panel admin-panel">
            <h2>{copy.evidence}</h2>
            <form onSubmit={(event) => void uploadEvidence(event)}>
              <label>
                {copy.screenshot}
                <input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" />
              </label>
              <button className="button button-primary" type="submit" disabled={busy}>
                {copy.uploadEvidence}
              </button>
            </form>
            <ul>
              {evidence.map((item) => (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {new Date(item.createdAt).toLocaleString(locale)} ·{" "}
                    {Math.ceil(item.sizeBytes / 1024)} KB
                  </a>
                  {item.aiSuggestion ? (
                    <p>
                      {copy.aiSuggestion}: {copy.placement}{" "}
                      {item.aiSuggestion.placement ?? "—"} · {copy.kills}{" "}
                      {item.aiSuggestion.kills ?? "—"} · {copy.score}{" "}
                      {item.aiSuggestion.score ?? "—"}
                    </p>
                  ) : item.visionStatus === "failed" ? (
                    <p>{copy.aiFailed}</p>
                  ) : item.visionStatus === "unconfigured" ? (
                    <p>{copy.aiNotConfigured}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="panel admin-panel">
          <h2>{copy.submitResult}</h2>
          <p>{copy.awaitingOpponent}</p>
          <form className="form-grid" onSubmit={(event) => void submitResult(event)}>
            <label>{copy.scoreA}<input required type="number" min="0" max="999" value={scoreA} onChange={(event) => setScoreA(event.target.value)} /></label>
            <label>{copy.scoreB}<input required type="number" min="0" max="999" value={scoreB} onChange={(event) => setScoreB(event.target.value)} /></label>
            <label>{copy.placementA}<input type="number" min="1" max="1000" value={placementA} onChange={(event) => setPlacementA(event.target.value)} /></label>
            <label>{copy.placementB}<input type="number" min="1" max="1000" value={placementB} onChange={(event) => setPlacementB(event.target.value)} /></label>
            <label>{copy.killsA}<input type="number" min="0" max="1000" value={killsA} onChange={(event) => setKillsA(event.target.value)} /></label>
            <label>{copy.killsB}<input type="number" min="0" max="1000" value={killsB} onChange={(event) => setKillsB(event.target.value)} /></label>
            <label>
              {copy.attachEvidence}
              <select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}>
                <option value="">—</option>
                {evidence.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
              </select>
            </label>
            <button className="button button-primary" type="submit" disabled={busy}>
              {copy.submitResult}
            </button>
          </form>
          <ul>
            {lobby.submissions.map((submission) => (
              <li key={submission.id}>
                {submission.registrationId}: {submission.scoreA}–{submission.scoreB}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel admin-panel">
          <h2>{copy.disputeTitle}</h2>
          {dispute ? (
            <>
              <p>{dispute.reason}</p>
              <p>{copy.disputeDue}: {new Date(dispute.dueAt).toLocaleString(locale)}</p>
              <ol>
                {dispute.messages.map((message) => (
                  <li key={message.id}>
                    <strong>{message.author.name ?? copy.unknownUser}</strong>: {message.body}
                  </li>
                ))}
              </ol>
              <form onSubmit={(event) => void addDisputeMessage(event)}>
                <label>{copy.disputeMessage}<input value={disputeBody} maxLength={2000} onChange={(event) => setDisputeBody(event.target.value)} /></label>
                <button className="button button-primary" type="submit" disabled={busy || !disputeBody.trim()}>{copy.sendReply}</button>
              </form>
              {lobby.canManage ? (
                <form className="form-grid" onSubmit={(event) => void resolveDispute(event)}>
                  <label>{copy.scoreA}<input required type="number" min="0" max="999" value={scoreA} onChange={(event) => setScoreA(event.target.value)} /></label>
                  <label>{copy.scoreB}<input required type="number" min="0" max="999" value={scoreB} onChange={(event) => setScoreB(event.target.value)} /></label>
                  <label>{copy.resolution}<textarea required minLength={10} maxLength={1000} value={resolution} onChange={(event) => setResolution(event.target.value)} /></label>
                  <button className="button button-primary" type="submit" disabled={busy}>{copy.resolveDispute}</button>
                </form>
              ) : null}
            </>
          ) : (
            <>
              <p>{copy.noDispute}</p>
              {lobby.canManage ? (
                <form className="form-grid" onSubmit={(event) => void resolveDispute(event)}>
                  <label>{copy.scoreA}<input required type="number" min="0" max="999" value={scoreA} onChange={(event) => setScoreA(event.target.value)} /></label>
                  <label>{copy.scoreB}<input required type="number" min="0" max="999" value={scoreB} onChange={(event) => setScoreB(event.target.value)} /></label>
                  <label>{copy.resolution}<textarea required minLength={10} maxLength={1000} value={resolution} onChange={(event) => setResolution(event.target.value)} /></label>
                  <button className="button button-primary" type="submit" disabled={busy}>{copy.confirmResult}</button>
                </form>
              ) : (
                <form onSubmit={(event) => void openDispute(event)}>
                  <label>{copy.disputeReason}<textarea required minLength={10} maxLength={1000} value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} /></label>
                  <button className="button button-primary" type="submit" disabled={busy || !disputeReason.trim()}>{copy.openDispute}</button>
                </form>
              )}
            </>
          )}
        </section>

        {lobby.canImportScores && lobby.match.format === "BATTLE_ROYALE" ? (
          <section className="panel admin-panel">
            <h2>{copy.csvImport}</h2>
            <p>{copy.csvHelp}</p>
            <form onSubmit={(event) => void importCsv(event)}>
              <label>
                {copy.csvImport}
                <input name="roundCsv" type="file" accept=".csv,text/csv" />
              </label>
              <button className="button button-primary" type="submit" disabled={busy}>
                {copy.importScores}
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </section>
  );
}
