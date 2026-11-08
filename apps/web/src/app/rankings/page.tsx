"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import { games } from "@clutchverse/core";
import { topPlayers } from "@/lib/demo-data";

export default function RankingsPage() {
  const [game, setGame] = useState("all");
  const [period, setPeriod] = useState("Season");
  const [region, setRegion] = useState("Global");
  const rows = useMemo(() => {
    const data = game === "all" ? topPlayers : topPlayers.filter((player) => player.game.toLowerCase().includes(game === "fifa" ? "fc" : game.replace("-", " ")));
    return [...data].sort((a, b) => b.rating - a.rating);
  }, [game]);
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">THE CLIMB NEVER STOPS</div><h1 className="page-title">Prove your place.</h1><p className="page-intro">Ratings are built on verified results. Every win moves the board — and every season starts a new story.</p>
    <div className="rank-controls panel"><label>GAME<select value={game} onChange={(e) => setGame(e.target.value)}><option value="all">All games</option>{games.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select><ChevronDown size={13} /></label><label>PERIOD<select value={period} onChange={(e) => setPeriod(e.target.value)}>{["Daily", "Weekly", "Season", "All time"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label><label>REGION<select value={region} onChange={(e) => setRegion(e.target.value)}>{["Global", "South Asia", "Europe", "North America", "East Asia"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label><span className="rank-live"><i className="live-dot" /> UPDATED LIVE</span></div>
    <div className="rank-stats-grid"><div className="rank-stat panel"><span className="eyebrow">RANKED PLAYERS</span><strong>248,392</strong><span className="muted">Across all games</span></div><div className="rank-stat panel"><span className="eyebrow">TOP RATING</span><strong>2,840</strong><span className="muted">Vex · Tekken 8</span></div><div className="rank-stat panel"><span className="eyebrow">RATING CHANGE</span><strong className="rank-positive">+12.4%</strong><span className="muted">This season</span></div></div>
    <div className="rank-table panel"><div className="rank-table-head"><span>RANK</span><span>COMPETITOR</span><span>GAME</span><span>REGION</span><span>W / L</span><span><ArrowDownUp size={12} /> RATING</span></div>
      {rows.map((player, index) => <Link className="rank-table-row" href={`/players/${player.handle}`} key={player.handle}><span className={index < 3 ? `rank-medal medal-${index + 1}` : "rank-number"}>{String(index + 1).padStart(2, "0")}</span><span className="player-cell"><span className={`player-avatar avatar-${index % 5}`}>{player.handle.slice(0, 1)}</span><strong>{player.handle}</strong><span className="verified">✦</span></span><span className="leader-game">{player.game}</span><span className="rank-region">{region}</span><span className="leader-record">{player.record}</span><strong className="leader-rating">{player.rating.toLocaleString()}</strong></Link>)}
      {!rows.length && <div className="empty-panel">No ratings for this game yet.</div>}
    </div>
    <p className="ranking-note">Demo leaderboard dataset. Production rankings are calculated from verified match reports and updated through the realtime service.</p>
  </div></section>;
}
