import { loadEnvConfig } from "@next/env";
import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import type { GameSlug } from "@clutchverse/core";

export type LiveLanguage = "en" | "ur" | "ar" | "zh" | "hi" | "es";
export type YoutubeLiveStatus =
  | "ok"
  | "empty-results"
  | "missing-key"
  | "api-restricted"
  | "quota-exceeded"
  | "provider-error"
  | "stale";

export type YoutubeLiveStream = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
};

export type YoutubeLiveGroup = {
  game: GameSlug;
  streams: YoutubeLiveStream[];
  status: YoutubeLiveStatus;
  diagnosticReason?: string;
  updatedAt?: string;
};

type CachedGroup = {
  streams: YoutubeLiveStream[];
  updatedAt: number;
  expiresAt: number;
};

const cacheDurationMs = 7 * 60 * 1000;
const cache = new Map<string, CachedGroup>();
const gameQueries: Record<GameSlug, string> = {
  "pubg-mobile": "PUBG Mobile esports tournament",
  "free-fire": "Garena Free Fire esports tournament",
  "tekken-8": "Tekken 8 esports tournament",
  fifa: "EA Sports FC FIFA esports tournament",
};
const languageQueries: Record<LiveLanguage, string> = {
  en: "English",
  ur: "Urdu",
  ar: "Arabic",
  zh: "Chinese",
  hi: "Hindi",
  es: "Spanish",
};
const regionByLanguage: Record<LiveLanguage, string> = {
  en: "US",
  ur: "PK",
  ar: "SA",
  zh: "CN",
  hi: "IN",
  es: "ES",
};

export function buildYoutubeLiveSearchUrl(
  game: GameSlug,
  language: LiveLanguage,
  key: string,
): URL {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    eventType: "live",
    type: "video",
    maxResults: "8",
    q: `${gameQueries[game]} ${languageQueries[language]} live`,
    relevanceLanguage: language,
    regionCode: regionByLanguage[language],
    key,
  }).toString();
  return url;
}

function loadWorkspaceEnvIfNeeded() {
  if (process.env.YOUTUBE_API_KEY) return;
  let directory = process.cwd();
  const filesystemRoot = parse(directory).root;
  while (directory !== filesystemRoot) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) {
      loadEnvConfig(directory);
      return;
    }
    directory = dirname(directory);
  }
  loadEnvConfig(process.cwd());
}

function readProviderError(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return "unknown";
  }
  const error = body.error;
  if (typeof error !== "object" || error === null) return "unknown";
  if ("errors" in error && Array.isArray(error.errors)) {
    const first = error.errors[0];
    if (
      typeof first === "object" &&
      first !== null &&
      "reason" in first &&
      typeof first.reason === "string"
    ) {
      return first.reason;
    }
  }
  if ("status" in error && typeof error.status === "string") {
    return error.status;
  }
  return "unknown";
}

export function classifyYoutubeFailure(reason: string): YoutubeLiveStatus {
  if (["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(reason)) {
    return "quota-exceeded";
  }
  if (
    [
      "accessNotConfigured",
      "forbidden",
      "keyInvalid",
      "ipRefererBlocked",
      "youtubeSignupRequired",
    ].includes(reason)
  ) {
    return "api-restricted";
  }
  return "provider-error";
}

function errorText(status: YoutubeLiveStatus, reason: string): string {
  if (status === "missing-key") return "Live search is not configured on this server.";
  if (status === "api-restricted") {
    return "YouTube rejected this API key or the YouTube Data API is not enabled.";
  }
  if (status === "quota-exceeded") {
    return "YouTube search quota is exhausted. Showing the most recent cached results.";
  }
  return `YouTube live search failed (${reason}).`;
}

function cachedOrFailure(
  game: GameSlug,
  language: LiveLanguage,
  status: YoutubeLiveStatus,
  reason: string,
): YoutubeLiveGroup {
  const previous = cache.get(`${game}:${language}`);
  if (previous) {
    return {
      game,
      streams: previous.streams,
      status: "stale",
      diagnosticReason: `${reason}: ${errorText(status, reason)}`,
      updatedAt: new Date(previous.updatedAt).toISOString(),
    };
  }
  return {
    game,
    streams: [],
    status,
    diagnosticReason: errorText(status, reason),
  };
}

export async function fetchYoutubeLiveGroup(
  game: GameSlug,
  language: LiveLanguage,
): Promise<YoutubeLiveGroup> {
  loadWorkspaceEnvIfNeeded();
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    console.error("YouTube live search unavailable.", {
      status: "not-requested",
      reason: "missing-key",
      game,
      language,
    });
    return cachedOrFailure(game, language, "missing-key", "missing-key");
  }

  const cacheKey = `${game}:${language}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      game,
      streams: cached.streams,
      status: cached.streams.length ? "ok" : "empty-results",
      updatedAt: new Date(cached.updatedAt).toISOString(),
    };
  }

  const url = buildYoutubeLiveSearchUrl(game, language, key);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const responseText = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const reason = body ? readProviderError(body) : "invalid-error-response";
      const status = classifyYoutubeFailure(reason);
      console.error("YouTube live search failed.", {
        status: response.status,
        reason: reason.replaceAll(key, "[redacted]"),
        game,
        language,
      });
      return cachedOrFailure(game, language, status, reason);
    }
    if (body === null) {
      console.error("YouTube live search returned invalid JSON.", {
        status: response.status,
        reason: "invalid-response",
        game,
        language,
      });
      return cachedOrFailure(game, language, "provider-error", "invalid-response");
    }

    const items =
      typeof body === "object" && body !== null && "items" in body && Array.isArray(body.items)
        ? body.items
        : [];
    const streams = items.flatMap((item): YoutubeLiveStream[] => {
      if (typeof item !== "object" || item === null) return [];
      const id = "id" in item && typeof item.id === "object" && item.id !== null
        ? item.id
        : null;
      const snippet =
        "snippet" in item && typeof item.snippet === "object" && item.snippet !== null
          ? item.snippet
          : null;
      const videoId = id && "videoId" in id && typeof id.videoId === "string" ? id.videoId : "";
      const title = snippet && "title" in snippet && typeof snippet.title === "string"
        ? snippet.title
        : "";
      const channelTitle =
        snippet && "channelTitle" in snippet && typeof snippet.channelTitle === "string"
          ? snippet.channelTitle
          : "";
      const thumbnails =
        snippet && "thumbnails" in snippet && typeof snippet.thumbnails === "object" && snippet.thumbnails !== null
          ? snippet.thumbnails
          : null;
      const high = thumbnails && "high" in thumbnails && typeof thumbnails.high === "object" && thumbnails.high !== null
        ? thumbnails.high
        : null;
      const thumbnailUrl = high && "url" in high && typeof high.url === "string" ? high.url : null;
      return videoId && title && channelTitle
        ? [{ videoId, title, channelTitle, thumbnailUrl }]
        : [];
    });

    const now = Date.now();
    cache.set(cacheKey, { streams, updatedAt: now, expiresAt: now + cacheDurationMs });
    if (streams.length === 0) {
      console.info("YouTube live search returned no live streams.", {
        status: response.status,
        reason: "empty-results",
        game,
        language,
      });
      return {
        game,
        streams,
        status: "empty-results",
        updatedAt: new Date(now).toISOString(),
      };
    }
    console.info("YouTube live search succeeded.", {
      status: response.status,
      reason: "results",
      game,
      language,
      count: streams.length,
    });
    return { game, streams, status: "ok", updatedAt: new Date(now).toISOString() };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "network-error";
    console.error("YouTube live search request failed.", {
      status: "network-error",
      reason,
      game,
      language,
    });
    return cachedOrFailure(game, language, "provider-error", reason);
  }
}
