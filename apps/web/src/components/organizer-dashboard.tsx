"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";

type Event = { id: string; slug: string; title: string; state: string; startsAt: string; game: { name: string }; _count: { registrations: number } };

export function OrganizerDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/tournaments")
      .then(async (response) => {
        const data = await response.json() as { tournaments?: Event[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load tournaments.");
        if (active) setEvents(data.tournaments ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load tournaments.");
      });
    return () => { active = false; };
  }, [refresh]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startsAt = new Date(String(form.get("startsAt"))).toISOString();
    const response = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        gameSlug: form.get("gameSlug"),
        format: form.get("format"),
        startsAt,
        region: form.get("region"),
        prizePool: Number(form.get("prizePool")) * 100,
        entryFee: 0,
      }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Tournament creation failed.");
      return;
    }
    formElement.reset();
    setRefresh((value) => value + 1);
  }

  return <div className="organizer-layout">
    <form className="organizer-form panel" onSubmit={createEvent}>
      <div className="detail-section-title"><div><span className="eyebrow">CREATE AN EVENT</span><h2>New tournament</h2></div><Plus size={18} /></div>
      <label>EVENT NAME<input name="title" minLength={5} maxLength={100} required placeholder="e.g. Season Open Championship" /></label>
      <div className="form-columns"><label>GAME<select name="gameSlug" required><option value="pubg-mobile">PUBG MOBILE</option><option value="free-fire">FREE FIRE</option><option value="tekken-8">TEKKEN 8</option><option value="fifa">EA SPORTS FC</option></select></label><label>FORMAT<select name="format" required><option value="SINGLE_ELIMINATION">Single elimination</option><option value="DOUBLE_ELIMINATION">Double elimination</option><option value="ROUND_ROBIN">Round robin</option><option value="SWISS">Swiss</option><option value="BATTLE_ROYALE">Battle royale points</option></select></label></div>
      <div className="form-columns"><label>START TIME<input type="datetime-local" name="startsAt" min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} required /></label><label>REGION<input name="region" defaultValue="Global" maxLength={40} required /></label></div>
      <label>PRIZE POOL (USD)<input type="number" name="prizePool" min="0" max="1000000" step="0.01" defaultValue="0" required /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="button button-primary full-button" disabled={busy}>{busy ? "CREATING..." : "CREATE TOURNAMENT"} <ArrowUpRight size={14} /></button>
      <small className="demo-disclaimer">Entry fees remain disabled until a payment provider is configured.</small>
    </form>
    <section className="organizer-events"><div className="hub-heading"><div><h2>Your event schedule</h2><p className="muted">Tournaments in the configured database.</p></div><button className="button" onClick={() => setRefresh((value) => value + 1)}>Refresh</button></div>
      {events.length ? events.map((item) => <Link className="organizer-event panel" key={item.id} href={`/tournaments/${item.slug}`}><span className={`status-pill status-${item.state.toLowerCase()}`}>{item.state}</span><span><strong>{item.title}</strong><small>{item.game.name} · {new Date(item.startsAt).toLocaleString()}</small></span><span className="muted">{item._count.registrations} entries</span></Link>) : <div className="empty-panel panel">{error || "No events have been created in the database yet. Seed sample data or create an event."}</div>}
    </section>
  </div>;
}
