import type { GameSlug } from "@clutchverse/core";
import { getRedisClient } from "@/lib/redis";

const cachePrefix = "clutchverse:proscene:";

export async function publishProSceneUpdate(
  gameSlug: GameSlug,
  eventId?: string,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    const invalidations = [
      redis.del(`${cachePrefix}events:${gameSlug}`),
      redis.del(`${cachePrefix}events:all`),
    ];
    if (eventId) {
      invalidations.push(
        redis.del([
          `${cachePrefix}event:${eventId}`,
          `${cachePrefix}standings:${eventId}`,
          `${cachePrefix}results:${eventId}`,
        ]),
      );
    }
    await Promise.all([
      ...invalidations,
      redis.publish(
        "proscene-events",
        JSON.stringify({ gameSlug, updatedAt: new Date().toISOString() }),
      ),
    ]);
  } catch (error) {
    console.error("Could not publish Pro Scene update.", {
      reason: error instanceof Error ? error.name : "redis-error",
    });
  }
}
