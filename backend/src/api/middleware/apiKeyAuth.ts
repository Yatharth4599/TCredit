import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import { prisma } from '../../config/prisma.js';
import { cacheGet, cacheSet } from '../../config/redis.js';

const API_KEY_CACHE_TTL = 300; // 5 minutes

// BUG-097 fix: constant-time key comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

interface CachedApiKey {
  id: string;
  name: string;
  key: string;
  rateLimit: number;
  tier: string;
  active: boolean;
}

function cacheKey(rawKey: string): string {
  // Never store the raw key — hash it for the Redis key
  return `apikey:${createHash('sha256').update(rawKey).digest('hex').slice(0, 32)}`;
}

async function lookupApiKey(headerKey: string): Promise<CachedApiKey | null> {
  const ck = cacheKey(headerKey);

  // Try Redis cache first
  const cached = await cacheGet<CachedApiKey>(ck);
  if (cached) return cached;

  // DB lookup
  const apiKey = await prisma.apiKey.findUnique({ where: { key: headerKey } });
  if (!apiKey) return null;

  const entry: CachedApiKey = {
    id: apiKey.id,
    name: apiKey.name,
    key: apiKey.key,
    rateLimit: apiKey.rateLimit,
    tier: apiKey.tier,
    active: apiKey.active,
  };

  // Cache result (even inactive keys — TTL short enough it's fine)
  await cacheSet(ck, entry, API_KEY_CACHE_TTL);
  return entry;
}

export interface AuthenticatedRequest extends Request {
  apiKey?: { id: string; name: string; rateLimit: number; tier: string };
}

/**
 * Optional API key authentication middleware.
 * If X-API-Key header is present, validates it against the ApiKey table.
 * Sets req.apiKey with key metadata for downstream use (e.g., rate limiting).
 * If no header is provided, the request proceeds as anonymous.
 */
export async function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const headerKey = req.headers['x-api-key'];
  if (!headerKey || typeof headerKey !== 'string') {
    return next();
  }

  try {
    const apiKey = await lookupApiKey(headerKey);

    // BUG-097 fix: constant-time comparison; dummy compare on miss to normalize timing
    if (!apiKey) { safeCompare(headerKey, headerKey); res.status(401).json({ error: 'Invalid or deactivated API key' }); return; }
    if (!safeCompare(headerKey, apiKey.key) || !apiKey.active) {
      res.status(401).json({ error: 'Invalid or deactivated API key' });
      return;
    }

    req.apiKey = { id: apiKey.id, name: apiKey.name, rateLimit: apiKey.rateLimit, tier: apiKey.tier };
    next();
  } catch {
    // EXPLOIT-2 fix: fail closed — don't call next() on DB error when a key WAS provided.
    res.status(503).json({ error: 'Auth service temporarily unavailable' });
  }
}

/**
 * Require a valid API key. Use this for admin-only endpoints.
 */
export async function requireApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const headerKey = req.headers['x-api-key'];
  if (!headerKey || typeof headerKey !== 'string') {
    res.status(401).json({ error: 'API key required (X-API-Key header)' });
    return;
  }

  try {
    const apiKey = await lookupApiKey(headerKey);

    if (!apiKey) { safeCompare(headerKey, headerKey); res.status(401).json({ error: 'Invalid or deactivated API key' }); return; }
    if (!safeCompare(headerKey, apiKey.key) || !apiKey.active) {
      res.status(401).json({ error: 'Invalid or deactivated API key' });
      return;
    }

    req.apiKey = { id: apiKey.id, name: apiKey.name, rateLimit: apiKey.rateLimit, tier: apiKey.tier };
    next();
  } catch (err) {
    console.error('[requireApiKey] DB error during auth lookup:', err);
    res.status(503).json({ error: 'Auth service temporarily unavailable' });
  }
}

/**
 * Require an API key with tier === 'admin'. Use for admin-only endpoints.
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const headerKey = req.headers['x-api-key'];
  if (!headerKey || typeof headerKey !== 'string') {
    res.status(401).json({ error: 'API key required (X-API-Key header)' });
    return;
  }

  try {
    const apiKey = await lookupApiKey(headerKey);

    if (!apiKey) { safeCompare(headerKey, headerKey); res.status(401).json({ error: 'Invalid or deactivated API key' }); return; }
    if (!safeCompare(headerKey, apiKey.key) || !apiKey.active) {
      res.status(401).json({ error: 'Invalid or deactivated API key' });
      return;
    }

    if (apiKey.tier !== 'admin') {
      res.status(403).json({ error: 'Admin API key required' });
      return;
    }

    req.apiKey = { id: apiKey.id, name: apiKey.name, rateLimit: apiKey.rateLimit, tier: apiKey.tier };
    next();
  } catch (err) {
    console.error('[requireAdmin] DB error during auth lookup:', err);
    res.status(503).json({ error: 'Auth service temporarily unavailable' });
  }
}
