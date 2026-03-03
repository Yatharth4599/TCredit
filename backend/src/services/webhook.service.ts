import { PrismaClient } from '@prisma/client';
import { createHmac } from 'crypto';

const prisma = new PrismaClient();

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 5_000; // 5s, 20s, 80s, 320s, 1280s

/**
 * Dispatch a webhook event to all active endpoints subscribed to this event type.
 */
export async function dispatchWebhook(eventType: string, payload: Record<string, unknown>): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      active: true,
      events: { has: eventType },
    },
  });

  if (endpoints.length === 0) return;

  const deliveries = endpoints.map((ep) => ({
    endpointId: ep.id,
    eventType,
    payload: payload as unknown as Record<string, never>,
    status: 'pending',
    nextRetryAt: new Date(),
  }));

  await prisma.webhookDelivery.createMany({ data: deliveries as never });
}

/**
 * Sign a payload with HMAC-SHA256.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Process pending webhook deliveries.
 */
export async function processWebhookDeliveries(): Promise<number> {
  const pending = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ['pending', 'failed'] },
      attempts: { lt: MAX_ATTEMPTS },
      nextRetryAt: { lte: new Date() },
    },
    include: { endpoint: true },
    take: 20,
    orderBy: { createdAt: 'asc' },
  });

  let delivered = 0;

  for (const delivery of pending) {
    const body = JSON.stringify({
      id: delivery.id,
      event: delivery.eventType,
      data: delivery.payload,
      timestamp: new Date().toISOString(),
    });

    const signature = signPayload(body, delivery.endpoint.secret);
    const attempt = delivery.attempts + 1;

    try {
      const res = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TCredit-Signature': signature,
          'X-TCredit-Event': delivery.eventType,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'delivered',
            statusCode: res.status,
            attempts: attempt,
            deliveredAt: new Date(),
          },
        });
        delivered++;
      } else {
        const nextRetry = new Date(Date.now() + BACKOFF_BASE_MS * Math.pow(4, attempt - 1));
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: attempt >= MAX_ATTEMPTS ? 'failed' : 'pending',
            statusCode: res.status,
            attempts: attempt,
            lastError: `HTTP ${res.status}`,
            nextRetryAt: attempt < MAX_ATTEMPTS ? nextRetry : null,
          },
        });
      }
    } catch (err) {
      const nextRetry = new Date(Date.now() + BACKOFF_BASE_MS * Math.pow(4, attempt - 1));
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: attempt >= MAX_ATTEMPTS ? 'failed' : 'pending',
          attempts: attempt,
          lastError: err instanceof Error ? err.message : 'Unknown error',
          nextRetryAt: attempt < MAX_ATTEMPTS ? nextRetry : null,
        },
      });
    }
  }

  return delivered;
}

let webhookInterval: ReturnType<typeof setInterval> | null = null;

export function startWebhookProcessor(): void {
  if (webhookInterval) return;
  console.log('[Webhooks] Delivery processor started (15s interval)');
  webhookInterval = setInterval(async () => {
    try {
      const count = await processWebhookDeliveries();
      if (count > 0) console.log(`[Webhooks] Delivered ${count} webhooks`);
    } catch (err) {
      console.error('[Webhooks] Processor error:', err);
    }
  }, 15_000);
}

export function stopWebhookProcessor(): void {
  if (webhookInterval) {
    clearInterval(webhookInterval);
    webhookInterval = null;
    console.log('[Webhooks] Delivery processor stopped');
  }
}
