import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`[TCredit] Server running on port ${env.PORT}`);
  console.log(`[TCredit] Environment: ${env.NODE_ENV}`);
  console.log(`[TCredit] Health: http://localhost:${env.PORT}/api/v1/health`);
});

function shutdown() {
  console.log('[TCredit] Shutting down...');
  server.close(() => {
    console.log('[TCredit] Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
