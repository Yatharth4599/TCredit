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
import { initIdleCapitalManager, getIdleCapitalManager, stopIdleCapitalManager } from './services/idle-capital-manager.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('Krexa');

// ── Startup config sanity checks ──────────────────────────────────────────
if (env.NODE_ENV === 'production') {
  const missingKeys: string[] = [];
  if (!env.SOLANA_ORACLE_PRIVATE_KEY)  missingKeys.push('SOLANA_ORACLE_PRIVATE_KEY');
  if (!env.SOLANA_KEEPER_PRIVATE_KEY)  missingKeys.push('SOLANA_KEEPER_PRIVATE_KEY');
  if (!env.ORACLE_PRIVATE_KEY)         missingKeys.push('ORACLE_PRIVATE_KEY');
  if (missingKeys.length > 0) {
    log.warn(`Signing keys not set — oracle and keeper operations will fail`, { missingKeys });
  }
}

// ── Unhandled error handlers ──────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception — shutting down', {
    error: err.message,
    stack: err.stack,
  });
  shutdown();
});

const server = app.listen(env.PORT, () => {
  log.info('Server started', { port: env.PORT, env: env.NODE_ENV });

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
    log.info('Solana background workers disabled', { reason: 'SOLANA_WORKERS_ENABLED=false' });
  }

  // Idle capital manager — routes unused vault USDC to Meteora for yield
  if (env.METEORA_VAULT_ADDRESS) {
    initIdleCapitalManager().then(() => {
      const mgr = getIdleCapitalManager();
      if (mgr) mgr.start();
    }).catch((err) => {
      log.warn('Idle capital manager failed to start', { error: err instanceof Error ? err.message : String(err) });
    });
  }
});

const SHUTDOWN_TIMEOUT_MS = 30_000;
let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info('Shutting down...');

  // Stop all background services
  stopRetryProcessor();
  stopEventIndexer();
  stopKeeper();
  stopWebhookProcessor();
  stopSolanaKeeper();
  stopSolanaIndexer();
  stopCreditScoreJob();
  stopIdleCapitalManager();

  // Force exit after timeout to prevent hanging
  const forceTimer = setTimeout(() => {
    log.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore disconnect errors during shutdown
    }
    log.info('Server closed');
    clearTimeout(forceTimer);
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
