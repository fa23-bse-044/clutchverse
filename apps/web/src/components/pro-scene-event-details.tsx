"use client";

import Link from "next/link";
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
  const t = messages.proScene;
  return <>
    <h1 className="page-title">{event.name}</h1>
    <p className="page-intro">{event.status} · {event.region ?? t.dateUnavailable} · {event.stage ?? t.dateUnavailable}</p>
    <p>{t.source}: <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName}</a>
      {" · "}{t.updated} {new Date(event.fetchedAt).toLocaleString()} · {event.license}</p>
    <section className="panel">
      <h2>{t.standings}</h2>
      {event.standings.length ? event.standings.map((standing) => {
        const entrant = standing.team ?? standing.player;
        return <p key={standing.id}>
          {standing.rank ?? "—"}. {entrant ? (standing.team
            ? <Link href={`/games/${event.gameSlug}/pro-scene/teams/${entrant.id}`}>{entrant.name}</Link>
            : <Link href={`/games/${event.gameSlug}/pro-scene/players/${entrant.id}`}>{entrant.name}</Link>) : t.unknownEntrant}
          {standing.points !== null ? ` · ${standing.points} pts` : ""}
          {" · "}<a href={standing.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
        </p>;
      }) : <p>{t.noResults}</p>}
    </section>
    <section className="panel">
      <h2>{t.participatingTeams}</h2>
      {event.teams.length ? event.teams.map((team) => (
        <p key={team.id}>
          <Link href={`/games/${event.gameSlug}/pro-scene/teams/${team.id}`}>{team.name}</Link>
          {" · "}<a href={team.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
        </p>
      )) : <p>{t.noResults}</p>}
    </section>
    <section className="panel">
      <h2>{t.results}</h2>
      {event.results.length ? event.results.map((result) => (
        <p key={result.id}>
          {result.title ?? `${result.placement ?? "—"} place`} · {
            result.team
              ? <Link href={`/games/${event.gameSlug}/pro-scene/teams/${result.team.id}`}>{result.team.name}</Link>
              : result.player
                ? <Link href={`/games/${event.gameSlug}/pro-scene/players/${result.player.id}`}>{result.player.name}</Link>
                : t.unknownEntrant
          }
          {" · "}<a href={result.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
        </p>
      )) : <p>{t.noResults}</p>}
    </section>
  </>;
}
