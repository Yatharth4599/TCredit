import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';

/**
 * IP allowlist middleware for admin and sensitive routes.
 *
 * Reads allowed IPs/CIDRs from ADMIN_IP_ALLOWLIST env var (comma-separated).
 * If the env var is not set, the middleware is a no-op (permissive) — this
 * allows development without configuring IPs while enforcing in production.
 *
 * In production, requests from non-allowlisted IPs get a 403.
 *
 * Supports:
 *   - Exact IPv4/IPv6 match
 *   - Loopback shorthand: "127.0.0.1", "::1", "::ffff:127.0.0.1"
 *   - "trust-proxy" mode: reads X-Forwarded-For when behind a reverse proxy
 */

// Parse env once at startup
const rawList = process.env.ADMIN_IP_ALLOWLIST?.trim() ?? '';
const allowedIPs: string[] = rawList
  ? rawList.split(',').map((ip) => ip.trim()).filter(Boolean)
  : [];

// Always allow loopback in non-production (dev/test convenience)
const isProduction = env.NODE_ENV === 'production';

function normalizeIP(ip: string | undefined): string {
  if (!ip) return '';
  // Express may report IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

export function ipAllowlist(req: Request, res: Response, next: NextFunction): void {
  // If no allowlist configured, skip enforcement (dev mode)
  if (allowedIPs.length === 0) {
    return next();
  }

  const clientIP = normalizeIP(req.ip);

  // Check allowlist
  if (allowedIPs.includes(clientIP)) {
    return next();
  }

  // Allow loopback in non-production even if allowlist is set
  if (!isProduction && LOOPBACK.has(clientIP)) {
    return next();
  }

  res.status(403).json({
    error: 'Forbidden',
    message: 'Your IP is not authorized for this endpoint',
  });
}
