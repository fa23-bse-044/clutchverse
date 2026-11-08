"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale } from "@/i18n/locale-context";

type EventRecord = {
  id: string;
  gameSlug: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  prizePool: string | null;
  region: string | null;
  stage: string | null;
  format: string | null;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  license: string;
};

export function ProSceneExplorer({
  gameSlug,
  gameName,
  events,
}: {
  gameSlug: string;
  gameName: string;
  events: EventRecord[];
}) {
  const { messages } = useLocale();
  const [filter, setFilter] = useState("all");
  const visible = useMemo(
    () => events.filter((event) => filter === "all" || event.status === filter),
    [events, filter],
  );
  const t = messages.proScene;
  return (
    <>
      <h1 className="page-title">{t.title}: {gameName}</h1>
      <p className="page-intro">{t.intro}</p>
      <div className="filter-row" role="group" aria-label={t.events}>
        {(["all", "live", "upcoming", "completed"] as const).map((item) => (
          <button
            type="button"
            className={filter === item ? "filter-chip active" : "filter-chip"}
            key={item}
            onClick={() => setFilter(item)}
          >
            {t[item]}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <Link className="button button-quiet" href={`/games/${gameSlug}/pro-scene/teams`}>{t.teams}</Link>
        <Link className="button button-quiet" href={`/games/${gameSlug}/pro-scene/players`}>{t.players}</Link>
      </div>
      {!visible.length ? (
        <div className="empty-panel panel">
          <strong>{t.noData}</strong>
          <p>{t.adminFallback}</p>
        </div>
      ) : (
        <div className="tournament-grid">
          {visible.map((event) => (
            <article className="panel tournament-card" key={event.id}>
              <span className={`status-pill status-${event.status}`}>{event.status}</span>
              <h2><Link href={`/games/${event.gameSlug}/pro-scene/${event.id}`}>{event.name}</Link></h2>
              <p>{[event.stage, event.format, event.region].filter(Boolean).join(" · ")}</p>
              <p>{event.startsAt ? new Date(event.startsAt).toLocaleString() : t.dateUnavailable}</p>
              {event.prizePool && <p>{t.prize}: {event.prizePool}</p>}
              <a href={event.sourceUrl} target="_blank" rel="noreferrer">
                {t.source}: {event.sourceName}
              </a>
              <small>{t.updated} {new Date(event.fetchedAt).toLocaleString()} · {event.license}</small>
            </article>
          ))}
        </div>
      )}
      <p className="muted">{t.attribution}</p>
    </>
  );
}
