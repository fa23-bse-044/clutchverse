"use client";

import { useEffect, useState } from "react";

type Stats = { players: number; liveEvents: number; prizePool: number };

const fallbackStats: Stats = {
  players: 8,
  liveEvents: 1,
  prizePool: 4_550_000,
};

function isStats(value: unknown): value is Stats {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.players === "number" &&
    Number.isFinite(candidate.players) &&
    typeof candidate.liveEvents === "number" &&
    Number.isFinite(candidate.liveEvents) &&
    typeof candidate.prizePool === "number" &&
    Number.isFinite(candidate.prizePool)
  );
}

function formatPrizePool(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

export function LiveCounters() {
  const [stats, setStats] = useState<Stats>(fallbackStats);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!isStats(result)) return;
        if (active) setStats(result);
      } catch {
        return;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const players = stats.players.toLocaleString();
  const liveEvents = stats.liveEvents.toLocaleString();
  const prizePool = formatPrizePool(stats.prizePool);

  return (
    <div className="hero-stats" aria-label="Live platform statistics">
      <div>
        <strong>{players}</strong>
        <span>PLAYERS</span>
      </div>
      <i />
      <div>
        <strong>{liveEvents}</strong>
        <span>LIVE EVENTS</span>
      </div>
      <i />
      <div>
        <strong>{prizePool}</strong>
        <span>OPEN PRIZE POOL</span>
      </div>
    </div>
  );
}
