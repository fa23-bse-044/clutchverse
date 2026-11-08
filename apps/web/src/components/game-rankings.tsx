"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { GameSlug } from "@clutchverse/core";

type Entry = {
  rank: number;
  subjectId: string;
  name: string;
  region: string;
  rating: number;
  points: number;
};

const periods = ["daily", "weekly", "season", "all-time"] as const;
const regions = [
  "Global",
  "South Asia",
  "Southeast Asia",
  "MENA",
  "Europe",
  "North America",
  "East Asia",
];

export function GameRankings({ gameSlug }: { gameSlug: GameSlug }) {
  const [period, setPeriod] = useState<(typeof periods)[number]>("season");
  const [region, setRegion] = useState("Global");
  const [type, setType] = useState<"player" | "team">("player");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const query = new URLSearchParams({ period, region, type });
        const response = await fetch(
          `/api/rankings/${gameSlug}?${query.toString()}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as {
          entries?: Entry[];
          source?: string;
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Rankings are unavailable.");
        if (active) {
          setEntries(result.entries ?? []);
          setSource(
            result.source === "redis" ? "Redis live board" : "Database board",
          );
          setError("");
        }
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Rankings are unavailable.",
          );
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const socket = io(
      process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001",
      { transports: ["websocket", "polling"], reconnectionAttempts: 2 },
    );
    socket.on("connect", () => {
      socket.emit("ranking:subscribe", { gameSlug, period, region });
    });
    socket.on("ranking:update", () => void load());

    return () => {
      active = false;
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, [gameSlug, period, region, type]);

  return (
    <div className="game-ranking-panel">
      <div className="game-ranking-controls">
        <label>
          Competitors
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as "player" | "team")
            }
          >
            <option value="player">Players</option>
            <option value="team">Teams</option>
          </select>
        </label>
        <label>
          Period
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as (typeof periods)[number])
            }
          >
            {periods.map((item) => (
              <option key={item} value={item}>
                {item.replace("-", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            {regions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <span className="rank-live">
          <i className="live-dot" /> {source || "Updating"}
        </span>
      </div>
      {error ? (
        <p className="empty-panel panel" role="status">
          {error}
        </p>
      ) : entries.length ? (
        <div className="hub-player-list panel">
          {entries.map((entry) => (
            <div className="leader-row" key={entry.subjectId}>
              <span className="rank-number">
                {String(entry.rank).padStart(2, "0")}
              </span>
              <span className="player-cell">
                <strong>{entry.name}</strong>
              </span>
              <span className="leader-record">{entry.region}</span>
              <strong className="leader-rating">
                {entry.points.toLocaleString()} pts
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-panel panel">
          No verified rankings are available for this filter yet.
        </p>
      )}
    </div>
  );
}
