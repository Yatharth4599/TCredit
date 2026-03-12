import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { startRetryProcessor, stopRetryProcessor } from './services/oracle.service.js';
import { startEventIndexer, stopEventIndexer } from './services/indexer.service.js';
import { startKeeper, stopKeeper } from './services/keeper.service.js';
import { startWebhookProcessor, stopWebhookProcessor } from './services/webhook.service.js';

const server = app.listen(env.PORT, () => {
  console.log(`[Krexa] Server running on port ${env.PORT}`);
  console.log(`[Krexa] Environment: ${env.NODE_ENV}`);
  console.log(`[Krexa] Health: http://localhost:${env.PORT}/api/v1/health`);
  startRetryProcessor();
  startEventIndexer();
  startKeeper();
  startWebhookProcessor();
});

function shutdown() {
  console.log('[Krexa] Shutting down...');
  stopRetryProcessor();
  stopEventIndexer();
  stopKeeper();
  stopWebhookProcessor();
  server.close(async () => {
    await prisma.$disconnect();
    console.log('[Krexa] Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
