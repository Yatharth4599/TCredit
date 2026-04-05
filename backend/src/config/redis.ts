import { Redis } from 'ioredis';
import { env } from './env.js';

// ---------------------------------------------------------------------------
// Redis client — optional. If REDIS_URL is unset or connection fails, all
// cache helpers become no-ops and the backend runs without Redis.
// ---------------------------------------------------------------------------

let redis: Redis | null = null;
let redisAvailable = false;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
  });

  redis.on('ready', () => {
    redisAvailable = true;
    console.log('[redis] connected');
  });

  redis.on('error', (err: Error) => {
    if (redisAvailable) {
      console.warn('[redis] connection lost — falling back to in-memory:', err.message);
    }
    redisAvailable = false;
  });

  redis.connect().catch((err: Error) => {
    console.warn('[redis] could not connect — running without Redis:', err.message);
  });
}

// ---------------------------------------------------------------------------
// Cache helpers — safe to call even when Redis is unavailable
// ---------------------------------------------------------------------------

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis || !redisAvailable) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis || !redisAvailable) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // silently skip
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis || !redisAvailable) return;
  try {
    await redis.del(key);
  } catch {
    // silently skip
  }
}

// Raw redis client for rate limiting (INCR + EXPIRE pipeline)
export { redis, redisAvailable };
