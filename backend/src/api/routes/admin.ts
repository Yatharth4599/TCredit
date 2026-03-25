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
const router = Router();

// All admin routes require an admin-tier API key + IP allowlist
router.use(ipAllowlist as RequestHandler);
router.use(requireAdmin as RequestHandler);

// GET /api/v1/admin/keys -- list API keys (paginated, keys redacted)
router.get('/keys', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 100));
    const skip = (page - 1) * limit;

    const [keys, total] = await Promise.all([
      prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, key: true, tier: true, rateLimit: true, active: true, createdAt: true },
        skip,
        take: limit,
      }),
      prisma.apiKey.count(),
    ]);
    res.json({
      keys: keys.map((k) => ({
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
    const { name, rateLimit: rl } = req.body;

    const key = `tck_${randomBytes(24).toString('hex')}`;
    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        name,
        rateLimit: rl ? Number(rl) : 100,
      },
    });

    res.status(201).json({
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
      rateLimit: apiKey.rateLimit,
      createdAt: apiKey.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/keys/:id -- update key (name, rateLimit, active)
router.patch('/keys/:id', validate(AdminUpdateKeySchema), async (req, res, next) => {
  try {
    const { name, rateLimit: rl, active } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (rl !== undefined) data.rateLimit = Number(rl);
    if (active !== undefined) data.active = Boolean(active);

    const apiKey = await prisma.apiKey.update({
      where: { id: req.params.id as string },
      data,
    });

    res.json({
      id: apiKey.id,
      name: apiKey.name,
      rateLimit: apiKey.rateLimit,
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
      endpoints: endpoints.map((ep) => ({
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

// POST /api/v1/admin/webhooks -- create webhook endpoint
router.post('/webhooks', validate(AdminCreateWebhookSchema), async (req, res, next) => {
  try {
    const { url, events } = req.body;

    const secret = `whsec_${randomBytes(32).toString('hex')}`;
    const endpoint = await prisma.webhookEndpoint.create({
      data: { url, events, secret },
    });

    // Return secret only on creation — never exposed again
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
    if (url !== undefined) data.url = url;
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
      entries: entries.map((e) => ({
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
      ...entries.map((e) =>
        [e.id, e.email, e.walletAddress ?? '', e.createdAt.toISOString()].join(',')
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
