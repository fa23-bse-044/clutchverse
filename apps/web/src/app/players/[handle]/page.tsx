import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BadgeCheck, Swords, Trophy } from "lucide-react";
import { topPlayers } from "@/lib/demo-data";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `${handle} — Player profile` };
}

export default async function PlayerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const player = topPlayers.find((item) => item.handle.toLowerCase() === handle.toLowerCase());
  if (!player) notFound();
  return <section className="section page-top"><div className="container">
    <div className="profile-cover"><span className="eyebrow">PLAYER PROFILE / VERIFIED RESULTS</span></div>
    <div className="profile-heading"><div className="profile-avatar">{player.handle.slice(0, 1)}</div><div><div className="profile-name">{player.handle} <BadgeCheck size={18} /></div><div className="muted">{player.game} · Global · Joined this season</div></div><Link className="button button-primary" href="/register">Follow player</Link></div>
    <div className="profile-stats"><div><span className="eyebrow">RATING</span><strong>{player.rating.toLocaleString()}</strong><small>Diamond tier</small></div><div><span className="eyebrow">MATCH RECORD</span><strong>{player.record}</strong><small>Verified matches</small></div><div><span className="eyebrow">WIN RATE</span><strong>82.4%</strong><small>Season to date</small></div><div><span className="eyebrow">CURRENT STREAK</span><strong>W 7</strong><small>Personal best: 11</small></div></div>
    <div className="profile-grid"><section className="panel profile-section"><div className="detail-section-title"><div><span className="eyebrow">RECENT FORM</span><h2>Rating history</h2></div><span className="tag">LAST 30 DAYS</span></div><div className="rating-chart" aria-label="Rating chart"><div className="chart-y"><span>2,900</span><span>2,700</span><span>2,500</span><span>2,300</span></div><svg viewBox="0 0 640 190" role="img" aria-label="Player rating rose over the last 30 days"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--accent)" stopOpacity=".25"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs><path d="M0 150 C40 130 50 145 80 114 S130 130 160 102 S210 90 240 104 S280 76 320 79 S370 51 400 74 S450 64 485 49 S540 62 565 30 S610 25 640 14 V190 H0Z" fill="url(#chartFill)"/><path d="M0 150 C40 130 50 145 80 114 S130 130 160 102 S210 90 240 104 S280 76 320 79 S370 51 400 74 S450 64 485 49 S540 62 565 30 S610 25 640 14" fill="none" stroke="var(--accent)" strokeWidth="3"/></svg></div><div className="chart-x"><span>30 days ago</span><span>Today</span></div></section>
      <aside className="panel profile-section"><span className="eyebrow">ACHIEVEMENTS</span><div className="achievement"><span><Trophy size={18} /></span><div><strong>Top 1% Climber</strong><small>Reached Diamond tier this season</small></div></div><div className="achievement"><span><Swords size={18} /></span><div><strong>Seven straight</strong><small>Won 7 verified matches in a row</small></div></div></aside></div>
    <section className="panel profile-section profile-matches"><div className="detail-section-title"><div><span className="eyebrow">COMPETITIVE RECORD</span><h2>Recent matches</h2></div></div>{["Season 04 weekly open", "ClutchVerse community cup", "Ranked ladder — match 48"].map((match, index) => <div className="match-row" key={match}><span className={index === 1 ? "match-result loss" : "match-result"}>{index === 1 ? "L" : "W"}</span><span><strong>{match}</strong><small>{index === 0 ? "Today · Round of 16" : `${index + 1} days ago · ${index ? "Final" : "Quarterfinal"}`}</small></span><span className="match-score">{index === 1 ? "1 — 2" : "2 — 0"}</span><span className={index === 1 ? "match-delta negative" : "match-delta"}>{index === 1 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{index === 1 ? "-14" : "+22"} RATING</span></div>)}</section>
    <p className="ranking-note">Profile data shown is a sample dataset for the local product preview.</p>
  </div></section>;
}
