import { createClient, type RedisClientType } from "redis";

type RedisGlobal = typeof globalThis & { clutchVerseRedis?: RedisClientType };

export async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const global = globalThis as RedisGlobal;
  const client = global.clutchVerseRedis ?? createClient({ url });
  if (!global.clutchVerseRedis) {
    client.on("error", (error: unknown) =>
      console.error("Redis client error.", error),
    );
    global.clutchVerseRedis = client;
  }
  if (!client.isOpen) await client.connect();
  return client;
}
