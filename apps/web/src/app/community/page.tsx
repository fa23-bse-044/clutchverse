import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { games } from "@clutchverse/core";
import { ChatPanel } from "@/components/chat-panel";

export const metadata = { title: "Community" };

export default function CommunityPage() {
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">THE PEOPLE MAKE THE VERSE</div><h1 className="page-title">Find your people.</h1><p className="page-intro">Talk strategy, find your next team, and celebrate the plays that bring the whole lobby together.</p>
    <div className="community-stats"><div><Users size={18} /><strong>4.2M</strong><span>PLAYERS</span></div><div><span className="live-dot" /><strong>12,842</strong><span>ONLINE NOW</span></div><div><ShieldCheck size={18} /><strong>24/7</strong><span>MODERATION</span></div></div>
    <div className="community-layout"><div><div className="hub-heading"><div><h2>Global lounge</h2><p className="muted">The whole community, one room.</p></div><span className="tag"><i className="live-dot" /> 1,284 ONLINE</span></div><ChatPanel room="global" /></div>
      <aside className="community-side"><div className="panel community-side-panel"><span className="eyebrow">GAME ROOMS</span>{games.map((game) => <Link key={game.slug} href={`/games/${game.slug}`} className="room-link" style={{ "--game-accent": game.accent } as CSSProperties}><span className="room-icon">{game.shortName.slice(0, 1)}</span><span><strong>{game.shortName}</strong><small>{game.live} online · Open room</small></span><ArrowRight size={14} /></Link>)}</div><div className="panel community-side-panel guidelines-card"><ShieldCheck size={20} /><h3>Good games start with respect.</h3><p className="muted">Our community rules keep competition intense and people safe.</p><Link className="text-link" href="/fair-play">READ THE CODE <ArrowRight size={13} /></Link></div></aside>
    </div><p className="ranking-note">This interactive preview stores messages only in your current browser session. Persistent rooms, DMs, presence, media uploads, and moderation require the configured realtime and storage services.</p>
  </div></section>;
}
