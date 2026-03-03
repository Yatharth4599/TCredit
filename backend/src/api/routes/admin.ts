import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { requireApiKey } from '../middleware/apiKeyAuth.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();
const router = Router();

// All admin routes require a valid API key
router.use(requireApiKey as never);

// GET /api/v1/admin/keys -- list all API keys
router.get('/keys', async (_req, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, key: true, rateLimit: true, active: true, createdAt: true },
    });
    res.json({ keys, total: keys.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/keys -- create a new API key
router.post('/keys', async (req, res, next) => {
  try {
    const { name, rateLimit: rl } = req.body;
    if (!name) throw new AppError(400, 'name required');

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
router.patch('/keys/:id', async (req, res, next) => {
  try {
    const { name, rateLimit: rl, active } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (rl !== undefined) data.rateLimit = Number(rl);
    if (active !== undefined) data.active = Boolean(active);

    if (Object.keys(data).length === 0) throw new AppError(400, 'No fields to update');

    const apiKey = await prisma.apiKey.update({
      where: { id: req.params.id },
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

// GET /api/v1/admin/webhooks -- list webhook endpoints
router.get('/webhooks', async (_req, res, next) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, url: true, events: true, active: true, createdAt: true,
        _count: { select: { deliveries: true } },
      },
    });
    res.json({
      endpoints: endpoints.map((ep) => ({
        ...ep,
        deliveryCount: ep._count.deliveries,
        _count: undefined,
      })),
      total: endpoints.length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/webhooks -- create webhook endpoint
router.post('/webhooks', async (req, res, next) => {
  try {
    const { url, events } = req.body;
    if (!url) throw new AppError(400, 'url required');
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new AppError(400, 'events array required (e.g. ["VaultCreated", "RepaymentProcessed"])');
    }

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
router.patch('/webhooks/:id', async (req, res, next) => {
  try {
    const { url, events, active } = req.body;
    const data: Record<string, unknown> = {};
    if (url !== undefined) data.url = url;
    if (events !== undefined) data.events = events;
    if (active !== undefined) data.active = Boolean(active);

    if (Object.keys(data).length === 0) throw new AppError(400, 'No fields to update');

    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: req.params.id },
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

export default router;
