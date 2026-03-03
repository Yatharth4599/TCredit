import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './apiKeyAuth.js';

const WINDOW_MS = 60_000; // 1 minute
const ANONYMOUS_LIMIT = 30;

interface BucketEntry {
  count: number;
  resetAt: number;
}

// In-memory sliding window. For production, use Redis.
const buckets = new Map<string, BucketEntry>();

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt < now) buckets.delete(key);
  }
}, 5 * 60_000);

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

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > limit) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfterMs: entry.resetAt - now,
    });
    return;
  }

  next();
}
