"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale } from "@/i18n/locale-context";

type Entrant = { id: string; name: string };
type EventOption = {
  key: string;
  type: "match" | "pro-scene";
  id: string;
  title: string;
  startsAt: string | null;
  choices: Entrant[];
};
type Dashboard = {
  season: { key: string; title: string; startsAt: string; endsAt: string };
  wallet: { xp: number; points: number; streak: number; level: number };
  quests: {
    dailyCheckIn: { claimed: boolean; xp: number; points: number };
    weeklyPredictions: { claimed: boolean; eligible: boolean; picks: number; xp: number; points: number };
  };
  rewards: Array<{ level: number; title: string; kind: "badge" | "frame" | "title"; unlocked: boolean }>;
  achievements: Array<{ key: string; unlocked: boolean }>;
  leaderboard: Array<{ rank: number; userId: string; name: string; xp: number; points: number }>;
  leagues: Array<{
    id: string;
    name: string;
    inviteCode: string;
    members: Array<{ userId: string; name: string; score: number }>;
  }>;
  matches: Array<{ id: string; title: string; startsAt: string | null; entrants: Entrant[] }>;
  proSceneEvents: Array<{ id: string; title: string; startsAt: string | null; teams: Entrant[] }>;
};

export function SeasonalPlayDashboard() {
  const { messages } = useLocale();
  const copy = messages.seasonalPlay;
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [eventKey, setEventKey] = useState("");
  const [selectionRefId, setSelectionRefId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/seasonal-play", { cache: "no-store" });
      const body = await response.json() as Dashboard | { error?: string };
      if (!response.ok || !("season" in body)) throw new Error("error" in body ? body.error : copy.loadError);
      setData(body);
      setLeagueId((current) => current || body.leagues[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.loadError);
    }
  }, [copy.loadError]);

  useEffect(() => { void load(); }, [load]);

  const eventOptions = useMemo<EventOption[]>(() => data ? [
    ...data.matches.map((match) => ({
      key: `match:${match.id}`,
      type: "match" as const,
      id: match.id,
      title: `${copy.matchEvents}: ${match.title}`,
      startsAt: match.startsAt,
      choices: match.entrants,
    })),
    ...data.proSceneEvents.map((event) => ({
      key: `pro-scene:${event.id}`,
      type: "pro-scene" as const,
      id: event.id,
      title: `${copy.proEvents}: ${event.title}`,
      startsAt: event.startsAt,
      choices: event.teams,
    })),
  ] : [], [copy.matchEvents, copy.proEvents, data]);
  const selectedEvent = eventOptions.find((event) => event.key === eventKey);
  const achievementLabels: Record<string, string> = {
    "first-check-in": copy.firstCheckInAchievement,
    "week-streak": copy.weekStreakAchievement,
    "first-pick": copy.firstPickAchievement,
    "prediction-winner": copy.predictionWinnerAchievement,
  };

  async function submitAction(path: string, payload: object, successMessage = copy.saved) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? copy.actionError);
      setNotice(successMessage);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.actionError);
    } finally {
      setBusy(false);
    }
  }

  async function createLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("/api/seasonal-play/leagues", { name: leagueName });
    setLeagueName("");
  }

  async function joinLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction("/api/seasonal-play/leagues/join", { inviteCode });
    setInviteCode("");
  }

  async function savePick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [eventType, eventRefId] = eventKey.split(":");
    if (!leagueId || !eventType || !eventRefId || !selectionRefId) {
      setError(copy.actionError);
      return;
    }
    await submitAction("/api/seasonal-play/picks", {
      leagueId,
      eventType,
      eventRefId,
      selectionRefId,
    });
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(copy.copySuccess);
    } catch {
      setError(copy.actionError);
    }
  }

  if (!data && !error) return <p role="status">{copy.loading}</p>;
  if (!data) return <p role="alert">{error}</p>;

  return (
    <div className="seasonal-play">
      <header className="panel">
        <p className="eyebrow">{copy.season}: {data.season.key}</p>
        <h1 className="page-title">{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="seasonal-stats">
          <span>{copy.level}: {data.wallet.level}</span>
          <span>{copy.xp}: {data.wallet.xp}</span>
          <span>{copy.virtualPoints}: {data.wallet.points}</span>
          <span>{copy.streak}: {data.wallet.streak}</span>
        </div>
      </header>

      <section className="panel" aria-labelledby="season-quests">
        <h2 id="season-quests">{copy.dailyQuest} &amp; {copy.weeklyQuest}</h2>
        <p>{copy.dailyQuestDescription}</p>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || data.quests.dailyCheckIn.claimed}
          onClick={() => void submitAction("/api/seasonal-play/quests", { quest: "daily-check-in" })}
        >
          {data.quests.dailyCheckIn.claimed ? copy.claimed : copy.claim}
        </button>
        <p>{copy.weeklyQuestDescription} ({data.quests.weeklyPredictions.picks}/3)</p>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || data.quests.weeklyPredictions.claimed || !data.quests.weeklyPredictions.eligible}
          onClick={() => void submitAction("/api/seasonal-play/quests", { quest: "weekly-predictions" })}
        >
          {data.quests.weeklyPredictions.claimed
            ? copy.claimed
            : data.quests.weeklyPredictions.eligible ? copy.claim : copy.notEligible}
        </button>
      </section>

      <section className="panel">
        <h2>{copy.rewards}</h2>
        <ul className="seasonal-list">
          {data.rewards.map((reward) => (
            <li key={reward.level} aria-label={`${copy.level} ${reward.level}`}>
              <strong>{copy.level} {reward.level}:</strong> {reward.title} · {copy[reward.kind === "title" ? "playerTitle" : reward.kind]}
              {" — "}{reward.unlocked ? copy.claimed : `${Math.max(0, reward.level * 100 - data.wallet.xp)} ${copy.xp}`}
            </li>
          ))}
        </ul>
        <h3>{copy.achievements}</h3>
        <ul className="seasonal-list">
          {data.achievements.map((achievement) => (
            <li key={achievement.key}>{achievementLabels[achievement.key] ?? achievement.key}: {achievement.unlocked ? copy.claimed : copy.notEligible}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>{copy.leaderboard}</h2>
        <ol className="seasonal-list">
          {data.leaderboard.map((entry) => (
            <li key={entry.userId}>#{entry.rank} {entry.name} · {entry.xp} {copy.xp} · {entry.points} {copy.virtualPoints}</li>
          ))}
        </ol>
      </section>

      <section className="panel" aria-labelledby="season-leagues">
        <h2 id="season-leagues">{copy.privateLeagues}</h2>
        <form className="seasonal-form" onSubmit={(event) => void createLeague(event)}>
          <label>{copy.leagueName}<input maxLength={64} minLength={3} required value={leagueName} onChange={(event) => setLeagueName(event.target.value)} /></label>
          <button className="button button-primary" type="submit" disabled={busy}>{copy.createLeague}</button>
        </form>
        <form className="seasonal-form" onSubmit={(event) => void joinLeague(event)}>
          <label>{copy.inviteCode}<input maxLength={16} minLength={6} required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} /></label>
          <button className="button" type="submit" disabled={busy}>{copy.joinLeague}</button>
        </form>
        {data.leagues.length === 0 ? <p>{copy.noLeagues}</p> : data.leagues.map((league) => (
          <article className="seasonal-league" key={league.id}>
            <h3>{league.name}</h3>
            <p>{copy.inviteCode}: <code>{league.inviteCode}</code>{" "}
              <button className="button" type="button" onClick={() => void copyCode(league.inviteCode)}>{copy.copyInvite}</button>
            </p>
            <h4>{copy.members}</h4>
            <ol>
              {league.members.map((member) => (
                <li key={member.userId}>{member.name} · {member.score} {copy.score}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>{copy.picks}</h2>
        {eventOptions.length === 0 ? <p>{copy.noEvents}</p> : (
          <form className="seasonal-form" onSubmit={(event) => void savePick(event)}>
            <label>{copy.privateLeagues}
              <select required value={leagueId} onChange={(event) => setLeagueId(event.target.value)}>
                <option value="">{copy.chooseSelection}</option>
                {data.leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
              </select>
            </label>
            <label>{copy.pickEvent}
              <select required value={eventKey} onChange={(event) => { setEventKey(event.target.value); setSelectionRefId(""); }}>
                <option value="">{copy.chooseSelection}</option>
                {eventOptions.map((option) => <option key={option.key} value={option.key}>{option.title}</option>)}
              </select>
            </label>
            <label>{copy.chooseSelection}
              <select required value={selectionRefId} onChange={(event) => setSelectionRefId(event.target.value)}>
                <option value="">{copy.chooseSelection}</option>
                {selectedEvent?.choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
              </select>
            </label>
            <button className="button button-primary" type="submit" disabled={busy || !data.leagues.length}>{copy.submitPick}</button>
          </form>
        )}
      </section>
      <p role="status" aria-live="polite">{notice}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
