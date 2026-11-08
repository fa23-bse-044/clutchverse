"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/locale-context";

type EventRecord = {
  id: string;
  gameSlug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  prizePool: string | null;
  region: string | null;
  stage: string | null;
  format: string | null;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  license: string;
};

const games = ["pubg-mobile", "free-fire", "tekken-8", "fifa"] as const;

export function ProSceneManager({ initialEvents }: { initialEvents: EventRecord[] }) {
  const { messages } = useLocale();
  const [events, setEvents] = useState(initialEvents);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const t = messages.proScene;

  const submit = async (formData: FormData) => {
    setBusy(true);
    setNotice("");
    try {
      const body = Object.fromEntries(formData);
      for (const key of ["startsAt", "endsAt"]) {
        const value = body[key];
        if (typeof value === "string" && value) body[key] = new Date(value).toISOString();
      }
      const response = await fetch("/api/admin/pro-scene", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { event?: EventRecord; error?: string };
      if (!response.ok || !result.event) throw new Error(result.error ?? t.saveError);
      setEvents((current) => [...current, {
        ...result.event!,
        startsAt: result.event!.startsAt ?? "",
        endsAt: result.event!.endsAt ?? "",
        fetchedAt: result.event!.fetchedAt,
      }]);
      setNotice(t.saved);
      (document.querySelector("#pro-scene-event-form") as HTMLFormElement | null)?.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.saveError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/admin/pro-scene/${id}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setNotice(result.error ?? t.saveError);
      return;
    }
    setEvents((current) => current.filter((event) => event.id !== id));
  };

  return (
    <>
      <form
        id="pro-scene-event-form"
        className="panel registration-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <h2>{t.addEvent}</h2>
        <label>{t.game}<select name="gameSlug" required>{games.map((game) => <option key={game}>{game}</option>)}</select></label>
        <label>{t.name}<input name="name" minLength={2} maxLength={120} required /></label>
        <label>{t.status}<select name="status"><option value="upcoming">{t.upcoming}</option><option value="live">{t.live}</option><option value="completed">{t.completed}</option></select></label>
        <label>{t.startsAt}<input name="startsAt" type="datetime-local" /></label>
        <label>{t.endsAt}<input name="endsAt" type="datetime-local" /></label>
        <label>{t.prize}<input name="prizePool" maxLength={80} /></label>
        <label>{t.region}<input name="region" maxLength={80} /></label>
        <label>{t.stage}<input name="stage" maxLength={80} /></label>
        <label>{t.format}<input name="format" maxLength={80} /></label>
        <label>{t.sourceName}<input name="sourceName" minLength={2} maxLength={100} required /></label>
        <label>{t.sourceUrl}<input name="sourceUrl" type="url" pattern="https://.*" required /></label>
        <label>{t.license}<input name="license" minLength={2} maxLength={120} placeholder="e.g. CC-BY-SA or official-source permission" required /></label>
        <button className="button button-primary" disabled={busy}>{busy ? t.loading : t.save}</button>
        {notice && <p role="status">{notice}</p>}
      </form>
      <div className="tournament-grid">
        {events.map((event) => (
          <article className="panel tournament-card" key={event.id}>
            <strong>{event.name}</strong>
            <small>{event.gameSlug} · {event.status} · {event.sourceName}</small>
            <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceUrl}</a>
            <small>{event.license} · {new Date(event.fetchedAt).toLocaleString()}</small>
            <button type="button" className="button button-quiet" onClick={() => void remove(event.id)}>{t.delete}</button>
          </article>
        ))}
      </div>
    </>
  );
}
