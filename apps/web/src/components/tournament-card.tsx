import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight, Users } from "lucide-react";
import { findGame } from "@clutchverse/core";
import type { Tournament } from "@/lib/demo-data";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const game = findGame(tournament.game)!;
  return <article className="tournament-card panel" style={{ "--game-accent": game.accent } as CSSProperties}>
    <div className="tournament-card-top"><span className={`status-pill status-${tournament.state.toLowerCase()}`}>{tournament.state === "LIVE" && <i className="live-dot" />}{tournament.state}</span><span className="tag">{tournament.region}</span></div>
    <div className="tournament-game">{game.name} <span>·</span> {tournament.format}</div>
    <h3>{tournament.title}</h3>
    <div className="tournament-meta"><span className="muted">{tournament.starts}</span><span><Users size={13} /> {tournament.entries}</span></div>
    <div className="tournament-card-bottom"><div><span className="muted">PRIZE POOL</span><strong>{tournament.prize}</strong></div><Link href={`/tournaments/${tournament.slug}`} aria-label={`View ${tournament.title}`}><ArrowUpRight size={17} /></Link></div>
  </article>;
}
