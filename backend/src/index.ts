import app from './app.js';
import { env } from './config/env.js';
import { startRetryProcessor, stopRetryProcessor } from './services/oracle.service.js';
import { startEventIndexer, stopEventIndexer } from './services/indexer.service.js';
import { startKeeper, stopKeeper } from './services/keeper.service.js';
import { startWebhookProcessor, stopWebhookProcessor } from './services/webhook.service.js';

const server = app.listen(env.PORT, () => {
  console.log(`[TCredit] Server running on port ${env.PORT}`);
  console.log(`[TCredit] Environment: ${env.NODE_ENV}`);
  console.log(`[TCredit] Health: http://localhost:${env.PORT}/api/v1/health`);
  startRetryProcessor();
  startEventIndexer();
  startKeeper();
  startWebhookProcessor();
});

function shutdown() {
  console.log('[TCredit] Shutting down...');
  stopRetryProcessor();
  stopEventIndexer();
  stopKeeper();
  stopWebhookProcessor();
  server.close(() => {
    console.log('[TCredit] Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
