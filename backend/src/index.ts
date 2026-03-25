import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { startRetryProcessor, stopRetryProcessor } from './services/oracle.service.js';
import { startEventIndexer, stopEventIndexer } from './services/indexer.service.js';
import { startKeeper, stopKeeper } from './services/keeper.service.js';
import { startWebhookProcessor, stopWebhookProcessor } from './services/webhook.service.js';
import { startSolanaKeeper, stopSolanaKeeper } from './services/solana-keeper.js';
import { startSolanaIndexer, stopSolanaIndexer } from './indexer/solana-indexer.js';
import { startCreditScoreJob, stopCreditScoreJob } from './services/credit-score.js';

// ── Startup config sanity checks ──────────────────────────────────────────
if (env.NODE_ENV === 'production') {
  const missingKeys: string[] = [];
  if (!env.SOLANA_ORACLE_PRIVATE_KEY)  missingKeys.push('SOLANA_ORACLE_PRIVATE_KEY');
  if (!env.SOLANA_KEEPER_PRIVATE_KEY)  missingKeys.push('SOLANA_KEEPER_PRIVATE_KEY');
  if (!env.ORACLE_PRIVATE_KEY)         missingKeys.push('ORACLE_PRIVATE_KEY');
  if (missingKeys.length > 0) {
    console.warn(`[Krexa] WARNING: The following signing keys are not set — oracle and keeper operations will fail: ${missingKeys.join(', ')}`);
  }
}

const server = app.listen(env.PORT, () => {
  console.log(`[Krexa] Server running on port ${env.PORT}`);
  console.log(`[Krexa] Environment: ${env.NODE_ENV}`);
  console.log(`[Krexa] Health: http://localhost:${env.PORT}/api/v1/health`);

  // Base chain services
  startRetryProcessor();
  startEventIndexer();
  startKeeper();
  startWebhookProcessor();

  // Solana services (can be disabled via SOLANA_WORKERS_ENABLED=false to save RPC quota)
  if (process.env.SOLANA_WORKERS_ENABLED !== 'false') {
    startSolanaKeeper();
    startSolanaIndexer();
    startCreditScoreJob();
  } else {
    console.log('[Krexa] Solana background workers disabled (SOLANA_WORKERS_ENABLED=false)');
  }
});

function shutdown() {
  console.log('[Krexa] Shutting down...');
  stopRetryProcessor();
  stopEventIndexer();
  stopKeeper();
  stopWebhookProcessor();
  stopSolanaKeeper();
  stopSolanaIndexer();
  stopCreditScoreJob();
  server.close(async () => {
    await prisma.$disconnect();
    console.log('[Krexa] Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
