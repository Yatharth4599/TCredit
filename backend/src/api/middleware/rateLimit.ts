import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './apiKeyAuth.js';
import { redis, redisAvailable } from '../../config/redis.js';

const WINDOW_SEC = 60;
const WINDOW_MS = WINDOW_SEC * 1000;
const ANONYMOUS_LIMIT = 30;

// ---------------------------------------------------------------------------
// In-memory fallback — used when Redis is unavailable
// ---------------------------------------------------------------------------

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt < now) buckets.delete(key);
  }
}, 5 * 60_000);
cleanupTimer.unref();

function inMemoryLimit(bucketKey: string, limit: number, res: Response, next: NextFunction): void {
  const now = Date.now();
  let entry = buckets.get(bucketKey);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(bucketKey, entry);
  }
  entry.count++;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  if (entry.count > limit) {
    const retryAfterMs = entry.resetAt - now;
    res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Redis-backed rate limiter — INCR + EXPIRE pipeline
// ---------------------------------------------------------------------------

async function redisLimit(bucketKey: string, limit: number, res: Response, next: NextFunction): Promise<void> {
  const redisKey = `rl:${bucketKey}`;
  const pipeline = redis!.pipeline();
  pipeline.incr(redisKey);
  pipeline.ttl(redisKey);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) ?? 1;
  const ttl = (results?.[1]?.[1] as number) ?? -1;

  // Set expiry only on first increment (ttl === -1 means no expiry set yet)
  if (ttl === -1) {
    await redis!.expire(redisKey, WINDOW_SEC);
  }

  const resetAt = Date.now() + (ttl === -1 ? WINDOW_SEC : ttl) * 1000;

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

  if (count > limit) {
    const retryAfterSec = ttl === -1 ? WINDOW_SEC : ttl;
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: retryAfterSec * 1000 });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Exported middleware
// ---------------------------------------------------------------------------

export function rateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const bucketKey = req.apiKey ? `key:${req.apiKey.id}` : `ip:${req.ip}`;
  const limit = req.apiKey ? req.apiKey.rateLimit : ANONYMOUS_LIMIT;

  if (redis && redisAvailable) {
    redisLimit(bucketKey, limit, res, next).catch(() => {
      // Redis error mid-request — fall back to in-memory
      inMemoryLimit(bucketKey, limit, res, next);
    });
  } else {
    inMemoryLimit(bucketKey, limit, res, next);
  }
}
