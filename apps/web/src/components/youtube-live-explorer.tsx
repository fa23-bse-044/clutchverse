"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import type { GameSlug } from "@clutchverse/core";
import type {
  LiveLanguage,
  YoutubeLiveGroup,
  YoutubeLiveStream,
} from "@/lib/youtube-live";
import { applyLocaleToDocument, type Locale } from "@/i18n/locales";
import { StreamPlayerFrame } from "./stream-player-frame";

const games: { slug: GameSlug; name: string; accent: string; channel: string; url: string }[] = [
  {
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    accent: "TACTICAL LIVE",
    channel: "PUBG MOBILE",
    url: "https://www.youtube.com/@PUBGMOBILE",
  },
  {
    slug: "free-fire",
    name: "Free Fire",
    accent: "FIRE LIVE",
    channel: "Garena Free Fire",
    url: "https://www.youtube.com/@GarenaFreeFire",
  },
  {
    slug: "tekken-8",
    name: "Tekken 8",
    accent: "FIGHTER LIVE",
    channel: "Bandai Namco Entertainment",
    url: "https://www.youtube.com/@BandaiNamcoEntertainment",
  },
  {
    slug: "fifa",
    name: "EA FC / FIFA",
    accent: "FOOTBALL LIVE",
    channel: "EA SPORTS FC",
    url: "https://www.youtube.com/@EASPORTSFC",
  },
];

const languages: { code: LiveLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "es", label: "Español" },
];

type ApiResult = YoutubeLiveGroup;

function updatedMinutes(updatedAt?: string): number | null {
  if (!updatedAt) return null;
  const timestamp = Date.parse(updatedAt);
  return Number.isNaN(timestamp) ? null : Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
}

function stateMessage(result: ApiResult): string {
  if (result.status === "missing-key") return "Live search is not configured. Add YOUTUBE_API_KEY to the server environment.";
  if (result.status === "api-restricted") return "YouTube rejected the API key or YouTube Data API access is disabled.";
  if (result.status === "quota-exceeded") return "YouTube search quota is exhausted.";
  if (result.status === "provider-error") return result.diagnosticReason ?? "YouTube live search is temporarily unavailable.";
  if (result.status === "stale") return result.diagnosticReason ?? "Showing the most recently cached results.";
  return "No live stream found for this game and language right now.";
}

export function YoutubeLiveExplorer({ language = "en" }: { language?: Locale }) {
  const [results, setResults] = useState<Partial<Record<GameSlug, ApiResult>>>({});
  const [selected, setSelected] = useState<{ game: GameSlug; stream: YoutubeLiveStream } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(
      games.map(async ({ slug }) => {
        const response = await fetch(
          `/api/live/youtube?game=${encodeURIComponent(slug)}&language=${encodeURIComponent(language)}`,
        );
        if (!response.ok) {
          throw new Error(`Live stream request failed (${response.status}).`);
        }
        return (await response.json()) as ApiResult;
      }),
    )
      .then((groups) => {
        if (!active) return;
        const nextResults: Partial<Record<GameSlug, ApiResult>> = {};
        for (const result of groups) nextResults[result.game] = result;
        setResults(nextResults);
        setSelected(null);
      })
      .catch(() => {
        if (!active) return;
        const fallbackResults: Partial<Record<GameSlug, ApiResult>> = {};
        for (const { slug } of games) {
          fallbackResults[slug] = {
            game: slug,
            streams: [],
            status: "provider-error",
            diagnosticReason: "Unable to contact the live-stream service.",
          };
        }
        setResults(fallbackResults);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language]);

  const selectedGame = selected ? games.find(({ slug }) => slug === selected.game) : undefined;
  return (
    <section className="youtube-live-explorer" aria-labelledby="youtube-live-heading">
      <div className="youtube-live-heading">
        <div>
          <span className="eyebrow"><Radio size={13} /> YOUTUBE LIVE</span>
          <h2 id="youtube-live-heading">Live from every arena.</h2>
          <p className="muted">Official YouTube player embeds · streams are found through YouTube Data API.</p>
        </div>
        <label className="youtube-language">
          Stream language
          <select value={language} onChange={(event) => {
            const nextLanguage = event.target.value as Locale;
            applyLocaleToDocument(nextLanguage);
            window.location.reload();
          }}>
            {languages.map(({ code, label }) => <option value={code} key={code}>{label}</option>)}
          </select>
        </label>
      </div>

      {selected && selectedGame && (
        <StreamPlayerFrame
          title={selected.stream.title}
          className="youtube-player panel"
        >
          <iframe
            src={`https://www.youtube.com/embed/${encodeURIComponent(selected.stream.videoId)}?autoplay=1`}
            title={`${selected.stream.title} — ${selected.stream.channelTitle}`}
            allow="fullscreen; autoplay; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <div className="youtube-player-caption">
            <div><span className="eyebrow">{selectedGame.name}</span><strong>{selected.stream.title}</strong><span className="muted">{selected.stream.channelTitle}</span></div>
            <button type="button" className="button button-ghost" onClick={() => setSelected(null)}>Close player</button>
          </div>
        </StreamPlayerFrame>
      )}

      <div className="youtube-game-grid">
        {games.map((game) => {
          const result = results[game.slug];
          const minutes = updatedMinutes(result?.updatedAt);
          const hasStreams = Boolean(result?.streams.length);
          return (
            <article className="youtube-game-card panel" key={game.slug}>
              <div className="youtube-game-title">
                <div><span className="eyebrow">{game.accent}</span><h3>{game.name}</h3></div>
                {hasStreams && <span className="status-pill status-live"><i className="live-dot" /> LIVE</span>}
              </div>
              {loading && (
                <div
                  className="youtube-loading-skeleton"
                  role="status"
                  aria-label="Searching live broadcasts"
                >
                  {Array.from({ length: 2 }, (_, index) => (
                    <div className="youtube-skeleton-row" key={index} aria-hidden="true">
                      <span className="youtube-skeleton-thumbnail" />
                      <span className="youtube-skeleton-copy">
                        <span />
                        <span />
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!loading && hasStreams && (
                <>
                  {result?.status === "stale" && (
                    <div className="youtube-state youtube-state-stale" role="status">
                      <p>{result.diagnosticReason}</p>
                      {minutes !== null && <span className="muted">Updated {minutes} min ago</span>}
                    </div>
                  )}
                  <ul className="youtube-stream-list">
                    {result?.streams.map((stream) => (
                      <li key={stream.videoId}>
                        {stream.thumbnailUrl && <img src={stream.thumbnailUrl} alt="" loading="lazy" />}
                        <div><strong>{stream.title}</strong><span className="muted">{stream.channelTitle}</span></div>
                        <button type="button" className="button button-primary" onClick={() => setSelected({ game: game.slug, stream })}>Watch</button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!loading && !hasStreams && result && (
                <div className={`youtube-state youtube-state-${result.status}`} role="status">
                  <p>{stateMessage(result)}</p>
                  {result.status === "stale" && minutes !== null && <span className="muted">Updated {minutes} min ago</span>}
                  {result.status === "empty-results" && <span className="muted">Try another language, or visit a featured channel below.</span>}
                </div>
              )}
              {result?.status === "stale" && hasStreams && minutes !== null && <p className="youtube-stale-label">Cached · updated {minutes} min ago</p>}
              <a className="youtube-featured-link" href={game.url} target="_blank" rel="noreferrer">
                Featured channel: {game.channel} <span aria-hidden="true">↗</span>
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
