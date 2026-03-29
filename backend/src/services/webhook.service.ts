import { createHmac } from 'crypto';
import { prisma } from '../config/prisma.js';

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

    // BUG-031: Secret stored plaintext — industry standard for webhook HMAC (same as Stripe/GitHub)
    const signature = signPayload(body, delivery.endpoint.secret);
    const attempt = delivery.attempts + 1;

    try {
      // BUG-112 fix: re-validate URL at delivery time to prevent DNS rebinding SSRF
      const deliveryUrl = new URL(delivery.endpoint.url);
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
      const hn = deliveryUrl.hostname.toLowerCase();
      if (blockedHosts.includes(hn) || hn.startsWith('fd') || hn.startsWith('fc') || hn.startsWith('fe80') || hn.startsWith('169.254')) {
        throw new Error('Webhook URL resolves to blocked address');
      }
      if (process.env.NODE_ENV === 'production' && deliveryUrl.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS in production');
      }

      const res = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Krexa-Signature': signature,
          'X-Krexa-Event': delivery.eventType,
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
