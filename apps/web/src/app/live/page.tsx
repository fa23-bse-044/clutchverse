import Link from "next/link";
import { ArrowRight, Video } from "lucide-react";
import { tournaments } from "@/lib/demo-data";
import { StreamViewer } from "@/components/stream-viewer";
import { YoutubeLiveExplorer } from "@/components/youtube-live-explorer";
import { cookies } from "next/headers";
import { isLocale } from "@/i18n/locales";

export const metadata = { title: "Live broadcasts" };

export default async function LivePage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("clutchverse-locale")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "en";
  const active = tournaments.filter((event) => event.state === "LIVE");
  return <section className="section page-top"><div className="container">
    <div className="eyebrow"><span className="live-dot" /> LIVE FROM THE VERSE</div><h1 className="page-title">Watch the plays unfold.</h1><p className="page-intro">Tournament coverage and community streams, together in one place. Connect an approved stream to make your channel live here.</p>
    <YoutubeLiveExplorer language={locale} />
    <div className="live-layout"><div className="live-main"><StreamViewer /><div className="viewer-chat panel"><div className="chat-panel-head"><strong>STREAM CHAT</strong><span className="muted">Select a stream to join chat</span></div><div className="stream-chat-placeholder">Chat appears alongside an active broadcast.</div></div></div>
      <aside className="live-sidebar"><div className="sidebar-heading"><h2>Live now</h2><span className="status-pill status-live"><i className="live-dot" /> {active.length} EVENTS</span></div>{active.map((event) => <Link href={`/tournaments/${event.slug}`} className="live-event-card panel" key={event.slug}><div className="live-thumb"><span className="live-thumb-mark">CV / LIVE</span><i className="live-dot" /></div><div><span className="eyebrow">{event.game.replace("-", " ").toUpperCase()} · {event.region}</span><strong>{event.title}</strong><span className="muted">Official event listing</span></div></Link>)}<div className="creator-card panel"><Video size={20} /><h3>Bring your broadcast.</h3><p className="muted">Connect a Twitch or YouTube channel and publish a scheduled stream to the directory.</p><Link className="button button-primary full-button" href="/register">Creator dashboard <ArrowRight size={14} /></Link></div></aside>
    </div><p className="ranking-note">No broadcaster credentials or video streams are bundled in demo mode. Embeds are rendered only for allow-listed Twitch and YouTube URLs configured by a channel owner.</p>
  </div></section>;
}
