import { getRedisClient } from "./redis";

export type SpotlightSource = {
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
};

export type SpotlightProvider<TEvent, TTeam, TStanding, TMatch, TPlayer> = {
  sourceName: string;
  event(eventId: string): Promise<{ data: TEvent; source: SpotlightSource } | null>;
  participants(eventId: string): Promise<{ data: TTeam[]; source: SpotlightSource }>;
  standings(eventId: string): Promise<{ data: TStanding[]; source: SpotlightSource }>;
  matches(eventId: string): Promise<{ data: TMatch[]; source: SpotlightSource }>;
  roster(teamId: string): Promise<{ data: TPlayer[]; source: SpotlightSource }>;
};

export type ProviderHealth = {
  name: "Liquipedia LPDB" | "PandaScore";
  configured: boolean;
  enabled: boolean;
  coverageConfirmed?: boolean;
  budgetUsed?: number | null;
  budgetLimit?: number;
  reason: string;
  checkedAt: string | null;
};

const pandaCoverageCache = new Map<string, { expiresAt: number; covered: boolean }>();
const breakerState = new Map<string, { failures: number; openUntil: number }>();
const MAX_FAILURES = 5;

export function isWithinProviderBudget(
  consumedRequests: number,
  maxPerHour: number,
): boolean {
  return Number.isInteger(consumedRequests) &&
    Number.isInteger(maxPerHour) &&
    consumedRequests >= 0 &&
    maxPerHour > 0 &&
    consumedRequests <= Math.min(maxPerHour, 60);
}

function hourlyBudgetKey(provider: string) {
  return `clutchverse:spotlight:budget:${provider}:${new Date()
    .toISOString()
    .slice(0, 13)}`;
}

export async function getProviderBudgetUsed(provider: string): Promise<number | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  const value = await redis.get(hourlyBudgetKey(provider));
  if (value === null) return 0;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

export async function consumeProviderBudget(
  provider: string,
  maxPerHour: number,
): Promise<boolean> {
  if (!Number.isInteger(maxPerHour) || maxPerHour < 1) return false;
  const redis = await getRedisClient();
  if (!redis) return false;
  const key = hourlyBudgetKey(provider);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3_600);
  return isWithinProviderBudget(count, maxPerHour);
}

export async function checkPandaScoreCoverage(): Promise<ProviderHealth> {
  const token = process.env.PANDASCORE_TOKEN;
  const now = new Date().toISOString();
  if (!token) {
    return {
      name: "PandaScore",
      configured: false,
      enabled: false,
      reason: "PANDASCORE_TOKEN is not configured.",
      checkedAt: null,
    };
  }
  const cached = pandaCoverageCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      name: "PandaScore",
      configured: true,
      enabled: false,
      coverageConfirmed: cached.covered,
      reason: cached.covered
        ? "PUBG Mobile coverage is confirmed. Event endpoint mappings remain unverified; sync remains disabled."
        : "PUBG Mobile was not found in the videogames list; this provider remains disabled.",
      checkedAt: now,
    };
  }
  const budget = Number(process.env.PANDASCORE_MAX_REQUESTS_PER_HOUR ?? 60);
  if (!(await consumeProviderBudget("pandascore", budget))) {
    return {
      name: "PandaScore",
      configured: true,
      enabled: false,
      coverageConfirmed: false,
      reason: "Coverage check not run: Redis request budget is unavailable or exhausted.",
      checkedAt: null,
    };
  }
  try {
    const response = await fetch(
      "https://api.pandascore.co/videogames?per_page=100",
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return {
        name: "PandaScore",
        configured: true,
        enabled: false,
        reason: `Coverage check failed with HTTP ${response.status}.`,
        checkedAt: now,
      };
    }
    const body: unknown = await response.json();
    const covered =
      Array.isArray(body) &&
      body.some((entry) => {
        if (typeof entry !== "object" || entry === null) return false;
        const slug = "slug" in entry && typeof entry.slug === "string" ? entry.slug : "";
        const name = "name" in entry && typeof entry.name === "string" ? entry.name : "";
        return slug === "pubg-mobile" || name.trim().toLowerCase() === "pubg mobile";
      });
    pandaCoverageCache.set(token, { covered, expiresAt: Date.now() + 60 * 60_000 });
    return {
      name: "PandaScore",
      configured: true,
      enabled: false,
      coverageConfirmed: covered,
      reason: covered
        ? "PUBG Mobile coverage is confirmed. Event endpoint mappings remain unverified; sync remains disabled."
        : "PUBG Mobile was not found in the videogames list; this provider remains disabled.",
      checkedAt: now,
    };
  } catch (error) {
    return {
      name: "PandaScore",
      configured: true,
      enabled: false,
      reason: `Coverage check unavailable (${error instanceof Error ? error.name : "network-error"}).`,
      checkedAt: now,
    };
  }
}

export async function getProviderHealth(): Promise<ProviderHealth[]> {
  const liquipediaConfigured = Boolean(
    process.env.LIQUIPEDIA_API_KEY && process.env.LIQUIPEDIA_USER_AGENT,
  );
  const maxRequests = Number(process.env.LIQUIPEDIA_MAX_REQUESTS_PER_HOUR ?? 60);
  const pandaScoreMax = Number(process.env.PANDASCORE_MAX_REQUESTS_PER_HOUR ?? 60);
  const pandaScoreLimit =
    Number.isInteger(pandaScoreMax) && pandaScoreMax > 0
      ? Math.min(pandaScoreMax, 60)
      : 60;
  const pandaScore = await checkPandaScoreCoverage();
  const [liquipediaBudgetUsed, pandaScoreBudgetUsed] = await Promise.all([
    getProviderBudgetUsed("liquipedia"),
    getProviderBudgetUsed("pandascore"),
  ]);
  return [
    {
      name: "Liquipedia LPDB",
      configured: liquipediaConfigured,
      enabled: false,
      budgetUsed: liquipediaBudgetUsed,
      budgetLimit: Number.isInteger(maxRequests) && maxRequests > 0 ? Math.min(maxRequests, 60) : 60,
      reason: liquipediaConfigured
        ? `Credentials are present. Endpoint mapping is unverified; no requests are made. Configured budget: ${Number.isInteger(maxRequests) && maxRequests > 0 ? Math.min(maxRequests, 60) : 60}/hour.`
        : "Liquipedia access is approval-gated; configure the server-only key and contact User-Agent after approval.",
      checkedAt: null,
    },
    {
      ...pandaScore,
      budgetUsed: pandaScoreBudgetUsed,
      budgetLimit: pandaScoreLimit,
    },
  ];
}

export async function cachedProviderJson<T>(
  key: string,
  ttlSeconds: number,
): Promise<T | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  const value = await redis.get(`clutchverse:spotlight:provider:${key}`);
  if (!value) return null;
  await redis.expire(`clutchverse:spotlight:provider:${key}`, ttlSeconds);
  return JSON.parse(value) as T;
}

export async function storeProviderJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.setEx(
    `clutchverse:spotlight:provider:${key}`,
    ttlSeconds,
    JSON.stringify(value),
  );
}

export function providerCircuitAllowsRequest(name: string): boolean {
  const state = breakerState.get(name);
  return !state || state.openUntil <= Date.now();
}

export function recordProviderFailure(name: string): void {
  const state = breakerState.get(name) ?? { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= MAX_FAILURES) {
    state.openUntil = Date.now() + Math.min(60 * 60_000, 2 ** (state.failures - MAX_FAILURES) * 30_000);
  }
  breakerState.set(name, state);
}

export function recordProviderSuccess(name: string): void {
  breakerState.delete(name);
}

export async function requestVerifiedProviderJson<T>(
  provider: string,
  url: URL,
  headers: Record<string, string>,
  maxPerHour: number,
): Promise<{ data: T | null; etag?: string; lastModified?: string; notModified: boolean }> {
  if (!providerCircuitAllowsRequest(provider))
    throw new Error(`${provider} circuit breaker is open.`);

  const cacheKey = `${provider}:${url.toString()}`;
  const conditional = await cachedProviderJson<{
    data: T;
    etag?: string;
    lastModified?: string;
  }>(cacheKey, 3600);
  const requestHeaders = new Headers(headers);
  requestHeaders.set("accept-encoding", "gzip");
  if (conditional?.etag) requestHeaders.set("if-none-match", conditional.etag);
  if (conditional?.lastModified)
    requestHeaders.set("if-modified-since", conditional.lastModified);
  let delay = 250;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await consumeProviderBudget(provider, maxPerHour)))
      throw new Error(`${provider} request budget unavailable or exhausted.`);
    try {
      const response = await fetch(url, {
        headers: requestHeaders,
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 304 && conditional) {
        recordProviderSuccess(provider);
        return { ...conditional, notModified: true };
      }
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
      const result = {
        data: (await response.json()) as T,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
      };
      await storeProviderJson(cacheKey, result, 3600);
      recordProviderSuccess(provider);
      return { ...result, notModified: false };
    } catch (error) {
      recordProviderFailure(provider);
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error(`${provider} request failed.`);
}
