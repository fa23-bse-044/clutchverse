"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";

type StudioData = {
  profile: { displayName: string; bio: string; slug: string; coStreamEnabled: boolean };
  followerCount: number;
  schedules: { id: string; title: string; scheduledAt: string; streamUrl: string | null }[];
  rewards: { id: string; title: string; cost: number }[];
  overlayToken: string | null;
};

type Clip = { id: string; title: string; _count: { votes: number } };
type Party = { id: string; title: string; startsAt: string; _count: { participants: number } };
const formStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
  gap: "1rem",
  marginBlock: "1rem",
};
const fieldStyle = { display: "grid", gap: ".4rem", minWidth: 0 };

export function CreatorStudio() {
  const { messages } = useLocale();
  const copy = messages.creatorTools;
  const [data, setData] = useState<StudioData | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch("/api/creator/profile", { cache: "no-store" }),
        fetch("/api/creator/clips", { cache: "no-store" }),
        fetch("/api/creator/watch-parties", { cache: "no-store" }),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error(copy.error);
      const [profileData, clipData, partyData] = await Promise.all(
        responses.map((response) => response.json()),
      ) as [
        StudioData,
        { clips: Clip[] },
        { parties: Party[] },
      ];
      setData(profileData);
      setClips(clipData.clips);
      setParties(partyData.parties);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.error);
    }
  }, [copy.error]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function sendJson(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(result.error ?? copy.error);
  }

  async function handleJson(event: FormEvent<HTMLFormElement>, url: string, method = "POST", transform?: (data: FormData) => unknown) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setNotice("");
    try {
      const payload = transform ? transform(formData) : Object.fromEntries(formData.entries());
      if (payload && typeof payload === "object") {
        for (const key of ["scheduledAt", "startsAt"]) {
          const value = (payload as Record<string, FormDataEntryValue | undefined>)[key];
          if (typeof value === "string" && value) {
            (payload as Record<string, unknown>)[key] = new Date(value).toISOString();
          }
        }
      }
      await sendJson(url, method, payload);
      setNotice(copy.saved);
      if (method === "PATCH") await refresh();
      else {
        form.reset();
        await refresh();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function updateOverlay(method: "POST" | "DELETE") {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/creator/overlay-token", { method });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? copy.error);
      await refresh();
      setNotice(copy.saved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function uploadClip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/creator/clips", { method: "POST", body: new FormData(form) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? copy.error);
      form.reset();
      await refresh();
      setNotice(copy.saved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p role="status">{notice || copy.loading}</p>;
  const baseUrl = typeof window === "undefined" ? "" : window.location.origin;
  const overlayUrl = data.overlayToken
    ? `${baseUrl}/creator/overlay/${data.overlayToken}?type=ticker`
    : "";

  return (
    <div className="creator-studio">
      <header className="detail-section-title">
        <div><span className="eyebrow">{copy.profile}</span><h1 className="page-title">{copy.title}</h1><p className="page-intro">{copy.description}</p></div>
        <Link className="button button-secondary" href={`/creator/${encodeURIComponent(data.profile.slug)}`}>{copy.publicProfile}</Link>
      </header>

      <section className="panel profile-section">
        <h2>{copy.profile}</h2>
        <form onSubmit={(event) => void handleJson(event, "/api/creator/profile", "PATCH", (formData) => ({
          displayName: formData.get("displayName"),
          bio: formData.get("bio"),
          coStreamEnabled: formData.get("coStreamEnabled") === "on",
        }))} className="creator-form" style={formStyle}>
          <label style={fieldStyle}>{copy.displayName}<input name="displayName" required minLength={2} maxLength={80} defaultValue={data.profile.displayName} /></label>
          <label style={fieldStyle}>{copy.bio}<textarea name="bio" maxLength={500} defaultValue={data.profile.bio} /></label>
          <label><input name="coStreamEnabled" type="checkbox" defaultChecked={data.profile.coStreamEnabled} /> {copy.coStream}</label>
          <button className="button button-primary" disabled={busy}>{copy.saveProfile}</button>
        </form>
        <p>{data.followerCount} {copy.followers}</p>
      </section>

      <section className="panel profile-section">
        <h2>{copy.schedule}</h2>
        <form onSubmit={(event) => void handleJson(event, "/api/creator/schedules")} className="creator-form" style={formStyle}>
          <label style={fieldStyle}>{copy.scheduleTitle}<input name="title" required minLength={2} maxLength={120} /></label>
          <label style={fieldStyle}>{copy.game}<input name="gameSlug" maxLength={64} /></label>
          <label style={fieldStyle}>{copy.startsAt}<input name="scheduledAt" type="datetime-local" required /></label>
          <label style={fieldStyle}>{copy.streamUrl}<input name="streamUrl" type="url" maxLength={500} /></label>
          <button className="button button-primary" disabled={busy}>{copy.addSchedule}</button>
        </form>
        {data.schedules.length ? data.schedules.map((item) => <p key={item.id}>{item.title} · {new Date(item.scheduledAt).toLocaleString()}{item.streamUrl ? ` · ${item.streamUrl}` : ""}</p>) : <p>{copy.noSchedules}</p>}
      </section>

      <section className="panel profile-section">
        <h2>{copy.overlay}</h2>
        <p>{copy.overlayHint}</p>
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void updateOverlay("POST")}>{copy.createOverlayToken}</button>
        {data.overlayToken && <button className="button button-secondary" type="button" disabled={busy} onClick={() => void updateOverlay("DELETE")}>{copy.revokeOverlayToken}</button>}
        {overlayUrl && <p>        <label style={fieldStyle}>{copy.overlayUrl}<input dir="ltr" readOnly value={overlayUrl} onFocus={(event) => event.currentTarget.select()} /></label></p>}
        <ul>{["scoreboard", "bracket", "ticker", "lower-third", "standings"].map((type) => <li key={type}><a dir="ltr" href={data.overlayToken ? `/creator/overlay/${data.overlayToken}?type=${type}` : undefined}>{type}</a></li>)}</ul>
      </section>

      <section className="panel profile-section">
        <h2>{copy.clips}</h2>
        <form onSubmit={(event) => void uploadClip(event)} encType="multipart/form-data" className="creator-form" style={formStyle}>
          <label style={fieldStyle}>{copy.clipTitle}<input name="title" required minLength={2} maxLength={120} /></label>
          <label style={fieldStyle}>{copy.uploadClip}<input name="file" type="file" required accept="video/mp4,video/webm" /></label>
          <label style={fieldStyle}>{copy.clipDuration}<input name="durationMs" type="number" min="1" max="3600000" /></label>
          <label style={fieldStyle}>{copy.trimStart}<input name="trimStartMs" type="number" min="0" max="3600000" defaultValue="0" /></label>
          <label style={fieldStyle}>{copy.trimEnd}<input name="trimEndMs" type="number" min="1" max="3600000" /></label>
          <button className="button button-primary" disabled={busy}>{copy.uploadClip}</button>
        </form>
        {clips.map((clip) => <p key={clip.id}>{clip.title} · {clip._count.votes} {copy.vote}s</p>)}
      </section>

      <section className="panel profile-section">
        <h2>{copy.rewards}</h2>
        <form onSubmit={(event) => void handleJson(event, "/api/creator/rewards", "POST", (formData) => ({
          title: formData.get("title"),
          description: formData.get("description"),
          cost: Number(formData.get("cost")),
        }))} className="creator-form" style={formStyle}>
          <label style={fieldStyle}>{copy.rewardTitle}<input name="title" required minLength={2} maxLength={80} /></label>
          <label style={fieldStyle}>{copy.rewardDescription}<input name="description" maxLength={240} /></label>
          <label style={fieldStyle}>{copy.rewardCost}<input name="cost" type="number" min="1" max="1000000" required /></label>
          <button className="button button-primary" disabled={busy}>{copy.addReward}</button>
        </form>
        {data.rewards.map((reward) => <p key={reward.id}>{reward.title} · {reward.cost} {copy.points}</p>)}
        <form onSubmit={(event) => void handleJson(event, "/api/creator/points/grant")} className="creator-form" style={formStyle}>
          <label style={fieldStyle}>{copy.viewerEmail}<input name="viewerEmail" type="email" required maxLength={254} /></label>
          <label style={fieldStyle}>{copy.pointsAmount}<input name="amount" type="number" min="1" max="10000" required /></label>
          <label style={fieldStyle}>{copy.reason}<input name="reason" required minLength={2} maxLength={120} /></label>
          <button className="button button-secondary" disabled={busy}>{copy.givePoints}</button>
        </form>
      </section>

      <section className="panel profile-section">
        <h2>{copy.watchParty}</h2>
        <form onSubmit={(event) => void handleJson(event, "/api/creator/watch-parties")} className="creator-form" style={formStyle}>
          <label style={fieldStyle}>{copy.partyTitle}<input name="title" required minLength={2} maxLength={120} /></label>
          <label style={fieldStyle}>{copy.partyDescription}<input name="description" maxLength={500} /></label>
          <label style={fieldStyle}>{copy.startsAt}<input name="startsAt" type="datetime-local" required /></label>
          <label style={fieldStyle}>{copy.streamUrl}<input name="streamUrl" type="url" maxLength={500} /></label>
          <button className="button button-primary" disabled={busy}>{copy.createParty}</button>
        </form>
        {parties.map((party) => <p key={party.id}>{party.title} · {new Date(party.startsAt).toLocaleString()} · {party._count.participants} joined</p>)}
      </section>

      <section className="panel profile-section">
        <h2>{copy.coStream}</h2>
        <form onSubmit={(event) => void handleJson(event, "/api/creator/co-stream")} className="creator-form" style={formStyle}>
          <label style={fieldStyle}>{copy.tournamentId}<input name="tournamentId" required maxLength={64} /></label>
          <label style={fieldStyle}>{copy.coStreamRequest}<textarea name="message" maxLength={500} /></label>
          <button className="button button-primary" disabled={busy}>{copy.coStreamRequest}</button>
        </form>
      </section>
      <p role="status" aria-live="polite">{notice}</p>
    </div>
  );
}
