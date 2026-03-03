import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  apiKey?: { id: string; name: string; rateLimit: number };
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

    if (!apiKey || !apiKey.active) {
      res.status(401).json({ error: 'Invalid or deactivated API key' });
      return;
    }

    req.apiKey = { id: apiKey.id, name: apiKey.name, rateLimit: apiKey.rateLimit };
    next();
  } catch {
    next();
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

    if (!apiKey || !apiKey.active) {
      res.status(401).json({ error: 'Invalid or deactivated API key' });
      return;
    }

    req.apiKey = { id: apiKey.id, name: apiKey.name, rateLimit: apiKey.rateLimit };
    next();
  } catch {
    res.status(500).json({ error: 'Auth service error' });
  }
}
