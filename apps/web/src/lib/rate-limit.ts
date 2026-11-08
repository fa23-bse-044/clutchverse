import { createHash } from "node:crypto";
import { getRedisClient } from "@/lib/redis";

type Bucket = { count: number; resetAt: number };
type RateLimitGlobal = typeof globalThis & {
  clutchVerseRateBuckets?: Map<string, Bucket>;
};

const globalForRateLimit = globalThis as RateLimitGlobal;
const buckets =
  globalForRateLimit.clutchVerseRateBuckets ?? new Map<string, Bucket>();
globalForRateLimit.clutchVerseRateBuckets = buckets;

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const redisKey = `clutchverse:rate:${createHash("sha256").update(key).digest("hex")}`;
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.pExpire(redisKey, windowMs);
      const ttl = await redis.pTTL(redisKey);
      return {
        allowed: count <= limit,
        retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)),
      };
    }
  } catch (error) {
    console.warn(
      "Distributed rate limit unavailable; using process-local limits.",
      error,
    );
  }

  const now = Date.now();
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function getRequestAddress(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
