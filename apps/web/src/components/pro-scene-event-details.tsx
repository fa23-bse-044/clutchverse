"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useLocale } from "@/i18n/locale-context";

type Entrant = { id: string; name: string };
type EventDetail = {
  id: string;
  gameSlug: string;
  name: string;
  status: string;
  region: string | null;
  stage: string | null;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  license: string;
  standings: Array<{
    id: string;
    rank: number | null;
    points: number | null;
    sourceUrl: string;
    team: Entrant | null;
    player: Entrant | null;
  }>;
  teams: Array<{ id: string; name: string; sourceUrl: string }>;
  results: Array<{
    id: string;
    placement: number | null;
    title: string | null;
    sourceUrl: string;
    team: Entrant | null;
    player: Entrant | null;
  }>;
};

export function ProSceneEventDetails({ event }: { event: EventDetail }) {
  const { messages } = useLocale();
  const [currentEvent, setCurrentEvent] = useState(event);
  const [refreshError, setRefreshError] = useState("");
  const t = messages.proScene;
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/pro-scene/events/${event.id}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          event?: EventDetail;
          error?: string;
        };
        if (!response.ok || !payload.event) {
          throw new Error(payload.error ?? "Pro Scene event is unavailable.");
        }
        if (active) {
          setCurrentEvent(payload.event);
          setRefreshError("");
        }
      } catch (error) {
        if (!active) return;
        console.error("Could not refresh Pro Scene event details.", error);
        setRefreshError("Live data refresh failed. Showing the last loaded record.");
      }
    };
    const socket = io(
      process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001",
      { transports: ["websocket", "polling"], reconnectionAttempts: 3 },
    );
    socket.on("connect", () => {
      socket.emit("proscene:subscribe", { gameSlug: event.gameSlug });
      void refresh();
    });
    socket.on("proscene:updated", () => void refresh());
    return () => {
      active = false;
      socket.disconnect();
    };
  }, [event.gameSlug, event.id]);
  const record = currentEvent;
  return <>
    <h1 className="page-title">{record.name}</h1>
    <p className="page-intro">{record.status} · {record.region ?? t.dateUnavailable} · {record.stage ?? t.dateUnavailable}</p>
    {refreshError && <p className="search-error" role="status">{refreshError}</p>}
    <p>{t.source}: <a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceName}</a>
      {" · "}{t.updated} {new Date(record.fetchedAt).toLocaleString()} · {record.license}</p>
    <section className="panel">
      <h2>{t.standings}</h2>
      {record.standings.length ? record.standings.map((standing) => {
        const entrant = standing.team ?? standing.player;
        return <p key={standing.id}>
          {standing.rank ?? "—"}. {entrant ? (standing.team
            ? <Link href={`/games/${record.gameSlug}/pro-scene/teams/${entrant.id}`}>{entrant.name}</Link>
            : <Link href={`/games/${record.gameSlug}/pro-scene/players/${entrant.id}`}>{entrant.name}</Link>) : t.unknownEntrant}
          {standing.points !== null ? ` · ${standing.points} pts` : ""}
          {" · "}<a href={standing.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
        </p>;
      }) : <p>{t.noResults}</p>}
    </section>
    <section className="panel">
      <h2>{t.participatingTeams}</h2>
      {record.teams.length ? record.teams.map((team) => (
        <p key={team.id}>
          <Link href={`/games/${record.gameSlug}/pro-scene/teams/${team.id}`}>{team.name}</Link>
          {" · "}<a href={team.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
        </p>
      )) : <p>{t.noResults}</p>}
    </section>
    <section className="panel">
      <h2>{t.results}</h2>
      {record.results.length ? record.results.map((result) => (
        <p key={result.id}>
          {result.title ?? `${result.placement ?? "—"} place`} · {
            result.team
              ? <Link href={`/games/${record.gameSlug}/pro-scene/teams/${result.team.id}`}>{result.team.name}</Link>
              : result.player
                ? <Link href={`/games/${record.gameSlug}/pro-scene/players/${result.player.id}`}>{result.player.name}</Link>
                : t.unknownEntrant
          }
          {" · "}<a href={result.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
        </p>
      )) : <p>{t.noResults}</p>}
    </section>
  </>;
}
