import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { findGame } from "@clutchverse/core";
import { tournaments } from "@/lib/demo-data";
import { TournamentDetailActions } from "@/components/tournament-detail-actions";
import { prisma } from "@clutchverse/db";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = tournaments.find((item) => item.slug === slug);
  return { title: event?.title ?? "Tournament" };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let event = tournaments.find((item) => item.slug === slug);
  if (!event) {
    try {
      const record = await prisma.tournament.findUnique({
        where: { slug },
        include: { game: true, _count: { select: { registrations: true } } },
      });
      if (record && ["pubg-mobile", "free-fire", "tekken-8", "fifa"].includes(record.game.slug)) {
        const settings = record.settings as { maxEntries?: number };
        event = {
          id: record.id,
          slug: record.slug,
          title: record.title,
          game: record.game.slug as (typeof tournaments)[number]["game"],
          state: record.state,
          format: record.format.replaceAll("_", " "),
          starts: record.state === "LIVE" ? "Live now" : new Date(record.startsAt).toLocaleString(),
          startsAt: record.startsAt.toISOString(),
          prize: `$${(record.prizePool / 100).toLocaleString()}`,
          entries: `${record._count.registrations} / ${settings.maxEntries ?? 128}`,
          region: record.region,
          entryFee: record.entryFee,
        };
      }
    } catch (error) {
      console.error("Tournament detail lookup failed.", error);
    }
  }
  if (!event) notFound();
  const game = findGame(event.game)!;
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">{game.name} / TOURNAMENT DETAIL</div>
    <div className="detail-title-row"><div><span className={`status-pill status-${event.state.toLowerCase()}`}>{event.state === "LIVE" && <i className="live-dot" />}{event.state}</span><h1 className="page-title">{event.title}</h1><p className="page-intro">{event.format} · {event.region}</p></div><div className="detail-prize"><span>PRIZE POOL</span><strong>{event.prize}</strong></div></div>
    <div className="detail-layout"><div className="detail-main">
      <div className="detail-facts panel"><div><CalendarDays size={16} /><span><b>Event time</b>{event.starts} · Your local time</span></div><div><MapPin size={16} /><span><b>Region</b>{event.region}</span></div><div><Users size={16} /><span><b>Entries</b>{event.entries}</span></div><div><Trophy size={16} /><span><b>Format</b>{event.format}</span></div></div>
      <section className="bracket-panel panel"><div className="detail-section-title"><div><span className="eyebrow">LIVE BRACKET</span><h2>Path to the final</h2></div><span className="tag">ROUND 1</span></div><div className="bracket-scroll"><div className="bracket-round"><span>ROUND 1</span><BracketMatch left="NOVA丨Rex" right="Kairo" score="2 — 1" /><BracketMatch left="Vex" right="TBD" score="UPCOMING" /><BracketMatch left="Astra" right="Sable" score="1 — 2" /><BracketMatch left="MØON" right="TBD" score="UPCOMING" /></div><div className="bracket-round"><span>SEMIFINAL</span><BracketMatch left="NOVA丨Rex" right="TBD" score="UPCOMING" /><BracketMatch left="Sable" right="TBD" score="UPCOMING" /></div><div className="bracket-round"><span>GRAND FINAL</span><BracketMatch left="TBD" right="TBD" score="UPCOMING" final /></div></div></section>
      <section className="bracket-panel panel"><div className="detail-section-title"><div><span className="eyebrow">EVENT INFO</span><h2>Rules & scoring</h2></div></div><div className="rules-copy"><p>All competitors must check in before the scheduled start time. Match results should be reported by both competitors; discrepancies are reviewed by the tournament organizer.</p><ul><li>Respect all competitors and tournament staff.</li><li>Use only the registered account or team for each match.</li><li>Submit accurate results; suspected cheating can be reported with evidence.</li><li>Prize distribution is handled by the organizer after final results are verified.</li></ul></div></section>
    </div><aside className="detail-aside panel"><TournamentDetailActions event={event} /><div className="aside-divider" /><span className="eyebrow">ORGANIZER</span><div className="organizer-card"><span className="organizer-avatar">CV</span><span><strong>ClutchVerse Events</strong><small>Verified organizer</small></span></div><div className="aside-divider" /><span className="eyebrow">PARTICIPANTS</span><div className="participant-stack"><span>N</span><span>K</span><span>V</span><span>+{event.entries.split("/")[0].trim()}</span></div><p className="muted">Check in opens 30 minutes before the event starts.</p></aside></div>
  </div></section>;
}

function BracketMatch({ left, right, score, final = false }: { left: string; right: string; score: string; final?: boolean }) {
  return <div className={final ? "bracket-match bracket-final" : "bracket-match"}><div><span>{left}</span><b>{score === "2 — 1" ? "2" : score === "1 — 2" ? "1" : "—"}</b></div><div><span>{right}</span><b>{score === "2 — 1" ? "1" : score === "1 — 2" ? "2" : "—"}</b></div><small>{score}</small></div>;
}
