"use client";

import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";

type DirectoryEntry = {
  id: string;
  name: string;
  region: string | null;
  role?: string | null;
  team?: { id: string; name: string } | null;
  sourceName: string;
  sourceUrl: string;
};

export function ProSceneDirectory({
  gameSlug,
  kind,
  entries,
}: {
  gameSlug: string;
  kind: "teams" | "players";
  entries: DirectoryEntry[];
}) {
  const { messages } = useLocale();
  const t = messages.proScene;
  return <>
    <h1 className="page-title">{kind === "teams" ? t.teams : t.players}</h1>
    {!entries.length ? <div className="empty-panel panel">{t.noData}</div> : (
      <div className="tournament-grid">
        {entries.map((entry) => (
          <article className="panel tournament-card" key={entry.id}>
            <h2>
              <Link href={`/games/${gameSlug}/pro-scene/${kind}/${entry.id}`}>{entry.name}</Link>
            </h2>
            <p>
              {entry.region ?? t.dateUnavailable}
              {entry.team ? ` · ${t.teams}: ${entry.team.name}` : ""}
              {entry.role ? ` · ${t.role}: ${entry.role}` : ""}
            </p>
            <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{t.source}: {entry.sourceName}</a>
          </article>
        ))}
      </div>
    )}
  </>;
}

export function ProSceneProfile({
  title,
  region,
  sourceName,
  sourceUrl,
  license,
  groupTitleKey,
  entries,
  wins,
  history,
  team,
}: {
  title: string;
  region: string | null;
  sourceName: string;
  sourceUrl: string;
  license: string;
  groupTitleKey: "roster" | "recentResults";
  entries: Array<{ name: string; detail: string; sourceUrl: string }>;
  wins?: Array<{ eventName: string; count: number; sourceUrl: string }>;
  history?: Array<{ name: string; detail: string; sourceUrl: string }>;
  team?: { id: string; name: string; gameSlug: string } | null;
}) {
  const { messages } = useLocale();
  const t = messages.proScene;
  return <>
    <h1 className="page-title">{title}</h1>
    <p className="page-intro">{region ?? t.dateUnavailable}</p>
    <p>{t.source}: <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceName}</a> · {license}</p>
    {team && <p>{t.teams}: <Link href={`/games/${team.gameSlug}/pro-scene/teams/${team.id}`}>{team.name}</Link></p>}
    {wins && <section className="panel"><h2>{t.titles}</h2>
      {wins.length ? wins.map((win) => <p key={win.eventName}>
        {win.eventName}: {win.count} · <a href={win.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
      </p>) : <p>{t.noResults}</p>}
    </section>}
    <section className="panel">
      <h2>{t[groupTitleKey]}</h2>
      {entries.length ? entries.map((entry, index) => (
        <p key={`${entry.name}-${index}`}>
          {entry.name} · {entry.detail} · <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a>
        </p>
      )) : <p>{t.noResults}</p>}
    </section>
    {history && <section className="panel">
      <h2>{t.history}</h2>
      {history.length ? history.map((entry, index) => (
        <p key={`${entry.name}-${index}`}>{entry.name} · {entry.detail} · <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{t.source}</a></p>
      )) : <p>{t.noResults}</p>}
    </section>}
  </>;
}
