import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { prisma } from '../../config/prisma.js';

// BUG-097 fix: constant-time key comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
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
    const apiKey = await prisma.apiKey.findUnique({ where: { key: headerKey } });

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
    // If no key was provided, the early return at line 23-25 already called next().
    // If a key WAS provided but DB failed, we must reject — not silently proceed as anonymous.
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
    const apiKey = await prisma.apiKey.findUnique({ where: { key: headerKey } });

    if (!apiKey) { safeCompare(headerKey, headerKey); res.status(401).json({ error: 'Invalid or deactivated API key' }); return; }
    if (!safeCompare(headerKey, apiKey.key) || !apiKey.active) {
      res.status(401).json({ error: 'Invalid or deactivated API key' });
      return;
    }

    req.apiKey = { id: apiKey.id, name: apiKey.name, rateLimit: apiKey.rateLimit, tier: apiKey.tier };
    next();
  } catch {
    res.status(500).json({ error: 'Auth service error' });
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
    const apiKey = await prisma.apiKey.findUnique({ where: { key: headerKey } });

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
  } catch {
    res.status(500).json({ error: 'Auth service error' });
  }
}
