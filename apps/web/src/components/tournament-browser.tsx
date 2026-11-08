"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { games } from "@clutchverse/core";
import type { Tournament } from "@/lib/demo-data";
import { TournamentCard } from "./tournament-card";

const states = ["ALL", "UPCOMING", "LIVE", "COMPLETED"] as const;

export function TournamentBrowser({ events }: { events: Tournament[] }) {
  const [state, setState] = useState<(typeof states)[number]>("ALL");
  const [game, setGame] = useState("all");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => events.filter((event) =>
    (state === "ALL" || event.state === state) &&
    (game === "all" || event.game === game) &&
    event.title.toLowerCase().includes(query.toLowerCase()),
  ), [events, game, query, state]);

  return <>
    <div className="tournament-filters panel">
      <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" aria-label="Search events" /></label>
      <label className="filter-select"><span className="sr-only">Filter by game</span><select value={game} onChange={(event) => setGame(event.target.value)}><option value="all">All games</option>{games.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
      <div className="filter-tabs" role="group" aria-label="Filter by event status">{states.map((item) => <button key={item} onClick={() => setState(item)} className={state === item ? "filter-active" : ""}>{item}</button>)}</div>
    </div>
    <div className="tournament-grid">{filtered.map((event) => <TournamentCard key={event.slug} tournament={event} />)}</div>
    {filtered.length === 0 && <div className="empty-panel panel">No tournaments match those filters. Try another game or status.</div>}
  </>;
}
