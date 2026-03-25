import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './apiKeyAuth.js';

const WINDOW_MS = 60_000; // 1 minute
const ANONYMOUS_LIMIT = 30;

interface BucketEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding window rate limiter.
 *
 * For horizontal scaling, replace with a Redis-backed implementation:
 *   - Use INCR + EXPIRE on key `rl:<bucketKey>` with TTL = WINDOW_MS/1000
 *   - Fall back to this in-memory implementation if Redis is unavailable
 *
 * Current implementation is suitable for single-instance deployments.
 */
const buckets = new Map<string, BucketEntry>();

// Clean stale entries periodically to prevent memory growth
const CLEANUP_INTERVAL_MS = 5 * 60_000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt < now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref(); // Don't prevent process exit

export function rateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const now = Date.now();

  // Key: API key id or IP address
  const bucketKey = req.apiKey ? `key:${req.apiKey.id}` : `ip:${req.ip}`;
  const limit = req.apiKey ? req.apiKey.rateLimit : ANONYMOUS_LIMIT;

  let entry = buckets.get(bucketKey);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(bucketKey, entry);
  }

  entry.count++;

  // Standard rate limit headers (RFC draft)
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > limit) {
    const retryAfterMs = entry.resetAt - now;
    res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfterMs,
    });
    return;
  }

  next();
}
