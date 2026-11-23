"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, Copy, LogIn } from "lucide-react";
import { io } from "socket.io-client";
import type { Tournament } from "@/lib/demo-data";
import { getTournamentRegistrationConfig } from "@/lib/tournament-registration";

type RegistrationStatus = {
  id: string;
  status: string;
  mode: string;
  teamName: string | null;
  teamTag: string | null;
};

type Slots = { registered: number; total: number; waitlist: number };
type Participant = {
  teamName: string;
  region: string;
  tag: string | null;
};

export function TournamentDetailActions({ event }: { event: Tournament }) {
  const gameConfig = getTournamentRegistrationConfig(event.game);
  const submissionKey = useRef<string | null>(null);
  const [registration, setRegistration] = useState<RegistrationStatus | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allowedModes, setAllowedModes] = useState<Array<"solo" | "duo" | "squad">>(
    gameConfig.modes,
  );
  const [slots, setSlots] = useState<Slots>(() => {
    const [registered = 0, total = 128] = event.entries
      .split("/")
      .map((part) => Number.parseInt(part, 10));
    return { registered, total, waitlist: 0 };
  });
  const [mode, setMode] = useState<"solo" | "duo" | "squad">(
    gameConfig.modes.includes("squad") ? "squad" : gameConfig.modes[0] ?? "solo",
  );
  const [substituteCount, setSubstituteCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const modes = allowedModes;
  const rosterSize = gameConfig.sizes[mode];
  const numericIds = event.game === "pubg-mobile" || event.game === "free-fire";

  const calendar = () => {
    const start = (event.startsAt ? new Date(event.startsAt) : new Date(Date.now() + 86400000)).toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}/, "");
    const body = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${event.slug}@clutchverse.gg\nDTSTAMP:${new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}/, "")}\nDTSTART:${start}\nSUMMARY:${event.title}\nDESCRIPTION:${event.format} - ${event.region}\nEND:VEVENT\nEND:VCALENDAR`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    link.download = `${event.slug}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  useEffect(() => {
    if (!event.id) return;
    let active = true;
    const socket = io(
      process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001",
      { transports: ["websocket", "polling"] },
    );
    const load = () => {
      void fetch(`/api/tournaments/${event.id}/register`, { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json() as {
            slots?: Slots;
            registration?: RegistrationStatus | null;
            participants?: Participant[];
            allowedModes?: Array<"solo" | "duo" | "squad">;
          };
          if (!response.ok) throw new Error("Unable to refresh registration.");
          if (active) {
            if (result.slots) setSlots(result.slots);
            setRegistration(result.registration ?? null);
            if (result.participants) setParticipants(result.participants);
            if (result.allowedModes?.length) {
              setAllowedModes(result.allowedModes);
              setMode((current) =>
                result.allowedModes?.includes(current)
                  ? current
                  : result.allowedModes?.[0] ?? "solo",
              );
            }
          }
        })
        .catch((error: unknown) => {
          if (active) setNotice(error instanceof Error ? error.message : "Unable to refresh registration.");
        });
    };
    socket.on("connect", () => {
      socket.emit("tournament:subscribe", { tournamentId: event.id });
      load();
    });
    socket.on("slots:updated", (update: Slots) => {
      if (active) setSlots(update);
    });
    socket.on("registration:created", (update: { registration: Participant }) => {
      if (active) {
        setParticipants((current) => current.some((item) =>
          item.teamName === update.registration.teamName &&
          item.region === update.registration.region &&
          item.tag === update.registration.tag,
        ) ? current : [...current, update.registration]);
      }
    });
    load();
    return () => {
      active = false;
      socket.emit("tournament:unsubscribe", { tournamentId: event.id });
      socket.disconnect();
    };
  }, [event.id]);

  const participantCount = useMemo(
    () => `${slots.registered} / ${slots.total}`,
    [slots.registered, slots.total],
  );

  const register = async (form: FormData) => {
    if (!event.id) {
      setNotice("Sample event only: registration is not submitted to a server.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    const members = Array.from({ length: rosterSize }, (_, index) => ({
      inGameName: String(form.get(`member-name-${index}`) ?? ""),
      inGameId: String(form.get(`member-id-${index}`) ?? ""),
    }));
    const substitutes = Array.from(
      { length: mode === "squad" ? substituteCount : 0 },
      (_, index) => ({
        inGameName: String(form.get(`sub-name-${index}`) ?? ""),
        inGameId: String(form.get(`sub-id-${index}`) ?? ""),
      }),
    );
    submissionKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/tournaments/${event.id}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          teamName: mode === "solo" ? undefined : String(form.get("teamName") ?? ""),
          teamTag: mode === "solo" ? undefined : String(form.get("teamTag") ?? "") || undefined,
          platform: String(form.get("platform") ?? ""),
          region: String(form.get("region") ?? ""),
          members,
          substitutes,
          eligibilityConfirmed: form.get("eligibilityConfirmed") === "on",
          rulesAccepted: form.get("rulesAccepted") === "on",
          idempotencyKey: submissionKey.current,
        }),
      });
      const result = await response.json() as {
        error?: string;
        confirmation?: string;
        registration?: RegistrationStatus;
        slots?: Slots;
      };
      if (!response.ok) throw new Error(result.error ?? "Unable to register for this event.");
      if (result.confirmation !== "confirmed" && result.confirmation !== "waitlisted") {
        throw new Error("The server did not confirm this registration.");
      }
      const savedRegistration = result.registration;
      if (savedRegistration) setRegistration(savedRegistration);
      if (result.slots) setSlots(result.slots);
      submissionKey.current = null;
      if (savedRegistration && result.confirmation !== "waitlisted") {
        const participant = {
              teamName: savedRegistration.teamName ?? "Solo entry",
              region: String(form.get("region") ?? ""),
              tag: savedRegistration.teamTag ?? null,
            };
        setParticipants((current) => current.some((item) =>
          item.teamName === participant.teamName &&
          item.region === participant.region &&
          item.tag === participant.tag,
        ) ? current : [...current, participant]);
      }
      setNotice(result.confirmation === "waitlisted"
        ? "You are confirmed on the tournament waitlist."
        : "Your registration is confirmed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to register for this event.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setNotice("Tournament link copied.");
  };

  const checkIn = async () => {
    if (!event.id) return;
    const response = await fetch(`/api/tournaments/${event.id}/check-in`, { method: "POST" });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? "Check-in confirmed." : result.error ?? "Unable to check in.");
  };

  const payEntryFee = async () => {
    if (!event.id) return;
    const response = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "tournament_entry", tournamentId: event.id }),
    });
    const result = await response.json() as { checkoutUrl?: string; error?: string; status?: string };
    if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    else setNotice(result.error ?? (result.status === "pending_demo" ? "Demo payment remains pending; no charge was made." : "Payment could not be started."));
  };

  return <>
    <span className={`status-pill status-${event.state.toLowerCase()}`}>{event.state}</span>
    <h2>Enter the arena</h2>
    <p className="muted">{participantCount} entries · {slots.waitlist} waitlisted</p>
    {event.id && event.state === "UPCOMING" && !registration && (
      <form className="registration-form" onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        void register(new FormData(submitEvent.currentTarget));
      }}>
        <label>MODE
          <select value={mode} onChange={(changeEvent) => {
            setMode(changeEvent.target.value as typeof mode);
            setSubstituteCount(0);
          }}>
            {modes.map((item) => <option value={item} key={item}>{item.toUpperCase()}</option>)}
          </select>
        </label>
        {mode !== "solo" && <label>TEAM NAME
          <input name="teamName" minLength={3} maxLength={24} required />
        </label>}
        {mode !== "solo" && <label>TEAM TAG (OPTIONAL)
          <input name="teamTag" minLength={2} maxLength={6} pattern="[A-Za-z0-9]{2,6}" />
        </label>}
        <label>PLATFORM
          <select name="platform" defaultValue={gameConfig.platforms[0]} required>
            {gameConfig.platforms.map((platform) => <option value={platform} key={platform}>{platform}</option>)}
          </select>
        </label>
        <label>REGION
          <input name="region" defaultValue={event.region} minLength={2} maxLength={32} required />
        </label>
        {Array.from({ length: rosterSize }, (_, index) => (
          <fieldset className="registration-member" key={`${mode}-${index}`}>
            <legend>{index === 0 ? "CAPTAIN" : `PLAYER ${index + 1}`}</legend>
            <label>IN-GAME NAME
              <input name={`member-name-${index}`} minLength={2} maxLength={40} required />
            </label>
            <label>IN-GAME ID / UID
              <input name={`member-id-${index}`} minLength={2} maxLength={80} inputMode={numericIds ? "numeric" : "text"} required />
            </label>
          </fieldset>
        ))}
        {mode === "squad" && (
          <>
            <label>SUBSTITUTES
              <select value={substituteCount} onChange={(changeEvent) => setSubstituteCount(Number(changeEvent.target.value))}>
                <option value={0}>No substitutes</option>
                <option value={1}>1 substitute</option>
                <option value={2}>2 substitutes</option>
              </select>
            </label>
            {Array.from({ length: substituteCount }, (_, index) => (
              <fieldset className="registration-member" key={`sub-${index}`}>
                <legend>SUBSTITUTE {index + 1}</legend>
                <label>IN-GAME NAME
                  <input name={`sub-name-${index}`} minLength={2} maxLength={40} required />
                </label>
                <label>IN-GAME ID / UID
                  <input name={`sub-id-${index}`} minLength={2} maxLength={80} inputMode={numericIds ? "numeric" : "text"} required />
                </label>
              </fieldset>
            ))}
          </>
        )}
        <label className="registration-check">
          <input type="checkbox" name="eligibilityConfirmed" required />
          I meet the tournament eligibility requirements.
        </label>
        <label className="registration-check">
          <input type="checkbox" name="rulesAccepted" required />
          I have read and accept the tournament rules.
        </label>
        {event.entryFee ? (
          <button type="button" className="button full-button" onClick={payEntryFee}>
            Pay ${(event.entryFee / 100).toFixed(2)} entry fee
          </button>
        ) : null}
        <button className="button button-primary full-button" disabled={submitting}>
          <LogIn size={15} /> {submitting ? "Submitting…" : "Submit registration"}
        </button>
      </form>
    )}
    {registration && (
      <>
        <p role="status"><Check size={15} /> Registration {registration.status}: {registration.mode}{registration.teamName ? ` · ${registration.teamName}${registration.teamTag ? ` [${registration.teamTag}]` : ""}` : ""}</p>
        {registration.status === "registered" && <button className="button full-button" onClick={checkIn}>Check in</button>}
      </>
    )}
    <div className="registration-participants" aria-live="polite">
      {participants.map((participant, index) => (
        <p key={`${participant.teamName}:${participant.region}:${participant.tag ?? ""}:${index}`}>
          <strong>{participant.teamName}</strong>
          {participant.tag ? ` [${participant.tag}]` : ""} · {participant.region}
        </p>
      ))}
    </div>
    {notice && <p className="action-notice" role="status">{notice}</p>}
    <button className="button full-button" onClick={calendar}><CalendarPlus size={15} /> Add to calendar</button>
    <button className="button button-quiet full-button" onClick={copy}><Copy size={15} /> Share event</button>
    <small className="demo-disclaimer">{event.id ? "Registration requires an active account; check-in opens near the event start." : "Sample event: registration is not submitted to a server."}</small>
  </>;
}
