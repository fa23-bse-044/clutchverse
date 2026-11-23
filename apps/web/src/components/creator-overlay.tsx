"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale-context";

type OverlayData = {
  type: string;
  name?: string | null;
  subtitle?: string;
  tournament?: string | null;
  matches?: { round: number; position: number; state: string; entrantA: string | null; entrantB: string | null; scoreA: number | null; scoreB: number | null }[];
  entries?: { rank?: number; name?: string | null; title?: string; game?: string; rating?: number; points?: number; startsAt?: string | null; entrantA?: string | null; entrantB?: string | null; scoreA?: number | null; scoreB?: number | null }[];
};

export function CreatorOverlay({ token }: { token: string }) {
  const { messages } = useLocale();
  const copy = messages.creatorTools;
  const [data, setData] = useState<OverlayData | null>(null);
  const [error, setError] = useState(false);
  const type = typeof window === "undefined" ? "ticker" : new URLSearchParams(window.location.search).get("type") ?? "ticker";

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/creator/overlay/${encodeURIComponent(token)}?type=${encodeURIComponent(type)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("overlay unavailable");
        const result = (await response.json()) as OverlayData;
        if (active) {
          setData(result);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, type]);

  if (error) return <p role="alert" style={{ color: "white" }}>{copy.overlayUnavailable}</p>;
  if (!data) return null;
  const textShadow = "0 2px 6px #000";
  const shell: React.CSSProperties = {
    color: "#fff",
    fontFamily: "system-ui, sans-serif",
    textShadow,
    background: "transparent",
    padding: "1rem",
  };
  if (data.type === "lower-third") return <main style={shell}><strong style={{ fontSize: "2.5rem" }}>{data.name ?? copy.creatorFallback}</strong><p>{data.subtitle}</p></main>;
  if (data.type === "bracket") return <main style={shell}><h1>{data.tournament ?? copy.liveBracket}</h1><div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>{data.matches?.map((match) => <article key={`${match.round}-${match.position}`} style={{ background: "rgba(0,0,0,.68)", padding: "1rem", minWidth: "14rem" }}><small>{copy.round} {match.round} · {match.state}</small><p>{match.entrantA ?? copy.toBeDetermined} <b>{match.scoreA ?? "—"}</b></p><p>{match.entrantB ?? copy.toBeDetermined} <b>{match.scoreB ?? "—"}</b></p></article>)}</div></main>;
  if (data.type === "standings") return <main style={shell}><ol>{data.entries?.map((item, index) => <li key={`${item.game}-${item.rank}-${index}`}>{item.name ?? copy.teamFallback} · {item.game} · {item.rating}</li>)}</ol></main>;
  return <main style={shell} aria-live="polite">{data.entries?.map((item, index) => <div key={`${item.title}-${item.startsAt}-${index}`} style={{ display: "inline-flex", gap: ".5rem", marginInlineEnd: "1rem", background: "rgba(0,0,0,.68)", padding: ".75rem 1rem" }}><strong>{item.title ?? `${item.entrantA ?? copy.toBeDetermined} vs ${item.entrantB ?? copy.toBeDetermined}`}</strong>{item.scoreA !== null && item.scoreA !== undefined && <span>{item.scoreA} - {item.scoreB}</span>}</div>)}</main>;
}
