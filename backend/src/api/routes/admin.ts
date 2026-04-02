import { Router } from 'express';
import type { RequestHandler } from 'express';
import { randomBytes } from 'crypto';
import { requireAdmin } from '../middleware/apiKeyAuth.js';
import { ipAllowlist } from '../middleware/ipAllowlist.js';
import { validate } from '../middleware/validate.js';
import {
  AdminCreateKeySchema, AdminUpdateKeySchema,
  AdminCreateWebhookSchema, AdminUpdateWebhookSchema,
} from '../schemas.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
const router = Router();

// BUG-113 fix: prevent CSV injection / DDE attacks in exported fields
function sanitizeCsvField(val: string): string {
  const dangerous = /^[=+\-@\t\r]/;
  const escaped = val.replace(/"/g, '""');
  if (dangerous.test(val) || val.includes(',') || val.includes('\n')) {
    return `"'${escaped}"`;
  }
  return `"${escaped}"`;
}

// BUG-141 fix: enforce IP allowlist BEFORE auth — reject non-allowlisted IPs early
router.use(ipAllowlist);

// All admin routes require an admin-tier API key (BUG-029)
router.use(requireAdmin as never);

// GET /api/v1/admin/keys -- list API keys (paginated, keys redacted)
router.get('/keys', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 100));
    const skip = (page - 1) * limit;

    const [keys, total] = await Promise.all([
      prisma.$queryRaw<Array<{
        id: string;
        name: string;
        key: string;
        tier: string;
        rateLimit: number;
        active: boolean;
        ownerWallet: string | null;
        createdAt: Date;
      }>>`
        SELECT "id", "name", "key", "tier", "rateLimit", "active", "ownerWallet", "createdAt"
        FROM "ApiKey"
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `,
      prisma.apiKey.count(),
    ]);
    res.json({
      keys: keys.map((k: {
        id: string;
        name: string;
        key: string;
        tier: string;
        rateLimit: number;
        active: boolean;
        ownerWallet: string | null;
        createdAt: Date;
      }) => ({
        ...k,
        key: k.key.slice(0, 4) + '…' + k.key.slice(-4),
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/keys -- create a new API key
router.post('/keys', validate(AdminCreateKeySchema), async (req, res, next) => {
  try {
    const { name, rateLimit: rl, ownerWallet } = req.body;

    const key = `tck_${randomBytes(24).toString('hex')}`;
    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        name,
        rateLimit: rl ? Number(rl) : 100,
      },
    });
    if (ownerWallet) {
      await prisma.$executeRaw`
        UPDATE "ApiKey"
        SET "ownerWallet" = ${String(ownerWallet).toLowerCase()}
        WHERE "id" = ${apiKey.id}
      `;
    }
    const ownerWalletRow = await prisma.$queryRaw<Array<{ ownerWallet: string | null }>>`
      SELECT "ownerWallet" FROM "ApiKey" WHERE "id" = ${apiKey.id} LIMIT 1
    `;

    res.status(201).json({
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
      rateLimit: apiKey.rateLimit,
      ownerWallet: ownerWalletRow[0]?.ownerWallet ?? null,
      createdAt: apiKey.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/keys/:id -- update key (name, rateLimit, active)
router.patch('/keys/:id', validate(AdminUpdateKeySchema), async (req, res, next) => {
  try {
    const { name, rateLimit: rl, active, ownerWallet } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (rl !== undefined) data.rateLimit = Number(rl);
    if (active !== undefined) data.active = Boolean(active);

    const apiKey = await prisma.apiKey.update({
      where: { id: req.params.id as string },
      data,
    });
    if (ownerWallet !== undefined) {
      await prisma.$executeRaw`
        UPDATE "ApiKey"
        SET "ownerWallet" = ${ownerWallet === null ? null : String(ownerWallet).toLowerCase()}
        WHERE "id" = ${apiKey.id}
      `;
    }
    const ownerWalletRow = await prisma.$queryRaw<Array<{ ownerWallet: string | null }>>`
      SELECT "ownerWallet" FROM "ApiKey" WHERE "id" = ${apiKey.id} LIMIT 1
    `;

    res.json({
      id: apiKey.id,
      name: apiKey.name,
      rateLimit: apiKey.rateLimit,
      ownerWallet: ownerWalletRow[0]?.ownerWallet ?? null,
      active: apiKey.active,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/keys/:id -- deactivate (soft delete)
router.delete('/keys/:id', async (req, res, next) => {
  try {
    await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// Webhook Endpoints
// =========================================================================

// GET /api/v1/admin/webhooks -- list webhook endpoints (paginated)
router.get('/webhooks', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 100));
    const skip = (page - 1) * limit;

    const [endpoints, total] = await Promise.all([
      prisma.webhookEndpoint.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, url: true, events: true, active: true, createdAt: true,
          _count: { select: { deliveries: true } },
        },
        skip,
        take: limit,
      }),
      prisma.webhookEndpoint.count(),
    ]);
    res.json({
      endpoints: endpoints.map((ep: {
        id: string;
        url: string;
        events: string[];
        active: boolean;
        createdAt: Date;
        _count: { deliveries: number };
      }) => ({
        ...ep,
        deliveryCount: ep._count.deliveries,
        _count: undefined,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

// BUG-040: validate webhook URL to prevent SSRF
function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new AppError(400, 'Invalid URL format'); }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new AppError(400, 'Webhook URL must use HTTPS in production');
  }
  const hostname = parsed.hostname.toLowerCase();
  // BUG-085 fix: normalize IPv6 — Node's URL returns '::1' without brackets
  if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'].includes(hostname)) {
    throw new AppError(400, 'Webhook URL cannot target localhost');
  }
  // BUG-085 fix: block IPv6 private/link-local ranges (fc00::/7, fe80::/10)
  if (hostname.startsWith('fd') || hostname.startsWith('fc') ||
      hostname.startsWith('fe80') || hostname.startsWith('::ffff:')) {
    throw new AppError(400, 'Webhook URL cannot target private IPv6 ranges');
  }
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 169 && b === 254)) {
      throw new AppError(400, 'Webhook URL cannot target private IP ranges');
    }
  }
}

// POST /api/v1/admin/webhooks -- create webhook endpoint
router.post('/webhooks', validate(AdminCreateWebhookSchema), async (req, res, next) => {
  try {
    const { url, events } = req.body;
    if (!url) throw new AppError(400, 'url required');
    validateWebhookUrl(url);
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new AppError(400, 'events array required (e.g. ["VaultCreated", "RepaymentProcessed"])');
    }

    const secret = `whsec_${randomBytes(32).toString('hex')}`;
    const endpoint = await prisma.webhookEndpoint.create({
      data: { url, events, secret },
    });

    // BUG-102: ACCEPTED — The webhook secret is intentionally returned exactly once
    // at creation time. This is industry standard (same pattern as Stripe, GitHub, etc.).
    // The secret is never exposed again in GET /webhooks or PATCH responses.
    // Callers must store it securely at creation time for HMAC signature verification.
    res.status(201).json({
      id: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
      events: endpoint.events,
      active: endpoint.active,
      createdAt: endpoint.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/webhooks/:id -- update webhook endpoint
router.patch('/webhooks/:id', validate(AdminUpdateWebhookSchema), async (req, res, next) => {
  try {
    const { url, events, active } = req.body;
    const data: Record<string, unknown> = {};
    // BUG-082 fix: validate webhook URL on PATCH too (SSRF prevention)
    if (url !== undefined) { validateWebhookUrl(url); data.url = url; }
    if (events !== undefined) data.events = events;
    if (active !== undefined) data.active = Boolean(active);

    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: req.params.id as string },
      data,
    });

    res.json({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      active: endpoint.active,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/webhooks/:id -- deactivate webhook endpoint
router.delete('/webhooks/:id', async (req, res, next) => {
  try {
    await prisma.webhookEndpoint.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/webhooks/:id/deliveries -- list deliveries for endpoint
router.get('/webhooks/:id/deliveries', async (req, res, next) => {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, eventType: true, status: true, statusCode: true,
        attempts: true, lastError: true, createdAt: true, deliveredAt: true,
      },
    });
    res.json({ deliveries, total: deliveries.length });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// Waitlist
// =========================================================================

// GET /api/v1/admin/waitlist — entries (paginated)
router.get('/waitlist', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 100));
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.waitlistEntry.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.waitlistEntry.count(),
    ]);
    res.json({
      entries: entries.map((e: {
        id: string;
        email: string;
        walletAddress: string | null;
        createdAt: Date;
      }) => ({
        id: e.id,
        email: e.email,
        walletAddress: e.walletAddress,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/waitlist/export — download as CSV
router.get('/waitlist/export', async (_req, res, next) => {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const rows = [
      'id,email,walletAddress,joinedAt',
      ...entries.map((e: {
        id: string;
        email: string;
        walletAddress: string | null;
        createdAt: Date;
      }) =>
        [e.id, sanitizeCsvField(e.email), sanitizeCsvField(e.walletAddress ?? ''), e.createdAt.toISOString()].join(',')
      ),
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="waitlist.csv"');
    res.send(rows.join('\n'));
  } catch (err) {
    next(err);
  }
});

export default router;
