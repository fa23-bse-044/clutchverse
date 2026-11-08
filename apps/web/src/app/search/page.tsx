"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { games } from "@clutchverse/core";
import { tournaments, topPlayers } from "@/lib/demo-data";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const results = useMemo(() => ({
    games: games.filter((game) => `${game.name} ${game.category}`.toLowerCase().includes(term)),
    players: topPlayers.filter((player) => player.handle.toLowerCase().includes(term)),
    events: tournaments.filter((event) => event.title.toLowerCase().includes(term)),
  }), [term]);
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">FIND YOUR NEXT MATCHUP</div><h1 className="page-title">Search the verse.</h1>
    <label className="global-search panel"><Search size={20} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Games, players, tournaments..." aria-label="Search games, players, and tournaments" /></label>
    {!term && <p className="muted search-prompt">Search across game hubs, player profiles, and tournaments.</p>}
    {term && <div className="search-results">
      {results.games.length > 0 && <section><h2>GAMES <span>{results.games.length}</span></h2>{results.games.map((game) => <Link className="search-result panel" href={`/games/${game.slug}`} key={game.slug}><span className="search-result-icon" style={{ "--game-accent": game.accent } as CSSProperties}>{game.shortName[0]}</span><span><strong>{game.name}</strong><small>{game.category} · Game hub</small></span></Link>)}</section>}
      {results.players.length > 0 && <section><h2>PLAYERS <span>{results.players.length}</span></h2>{results.players.map((player) => <Link className="search-result panel" href={`/players/${player.handle}`} key={player.handle}><span className="player-avatar">{player.handle[0]}</span><span><strong>{player.handle}</strong><small>{player.game} · {player.rating} rating</small></span></Link>)}</section>}
      {results.events.length > 0 && <section><h2>TOURNAMENTS <span>{results.events.length}</span></h2>{results.events.map((event) => <Link className="search-result panel" href={`/tournaments/${event.slug}`} key={event.slug}><span className="search-result-icon"><TrophyGlyph /></span><span><strong>{event.title}</strong><small>{event.game.toUpperCase()} · {event.state}</small></span></Link>)}</section>}
      {!results.games.length && !results.players.length && !results.events.length && <div className="empty-panel panel">No matches found. Try a game name, player handle, or event title.</div>}
    </div>}
  </div></section>;
}

function TrophyGlyph() {
  return <span aria-hidden="true">✦</span>;
}
