/**
 * Krexa Demo Server — on-demand trigger for krexa.xyz/demo
 *
 * Runs on Render. Exposes:
 *   POST /trigger  — start the 6-step lifecycle demo
 *   GET  /status   — current demo state (idle | running | done | error)
 *   GET  /health   — Render health check
 *   ws://…         — broadcasts step events to connected dashboards
 *
 * Deploy keypairs as base64 env vars (AGENT_KEYPAIR, OWNER_KEYPAIR, etc.)
 */

import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, type WebSocket as WsClient } from 'ws';
import { writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { BroadcastFn } from './run-demo.ts';

// ── Keypair bootstrap (BUG-033: restricted permissions) ──────────────────
function bootstrapKeypairs(): void {
  const dir = join(tmpdir(), `krexa-keys-${process.pid}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const pairs: Array<[string, string]> = [
    ['AGENT_KEYPAIR',    'AGENT_KEYPAIR_PATH'],
    ['OWNER_KEYPAIR',    'OWNER_KEYPAIR_PATH'],
    ['ORACLE_KEYPAIR',   'ORACLE_KEYPAIR_PATH'],
    ['CUSTOMER_KEYPAIR', 'CUSTOMER_KEYPAIR_PATH'],
  ];

  for (const [envBase64, envPath] of pairs) {
    if (process.env[envBase64] && !process.env[envPath]) {
      const json = Buffer.from(process.env[envBase64]!, 'base64').toString('utf8');
      const filePath = join(dir, `${envBase64.toLowerCase()}.json`);
      writeFileSync(filePath, json, { encoding: 'utf8', mode: 0o600 });
      process.env[envPath] = filePath;
    }
  }

  process.on('exit', () => {
    try { const { rmSync } = require('fs'); rmSync(dir, { recursive: true, force: true }); } catch {}
  });
}

bootstrapKeypairs();

// ── Dynamic import of run-demo (after dotenv + keypair bootstrap) ──────────
// Using dynamic import ensures run-demo's module-level code (dotenv/config)
// runs AFTER we've set everything up above.
const { runDemo } = await import('./run-demo.ts') as { runDemo: (broadcast: BroadcastFn) => Promise<void> };

// ── State ─────────────────────────────────────────────────────────────────

type DemoStatus = 'idle' | 'running' | 'done' | 'error';

let demoStatus: DemoStatus = 'idle';
let demoError: string | null = null;
let lastRunAt: string | null = null;

// ── WebSocket server ───────────────────────────────────────────────────────

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
  origin: [
    'https://krexa.xyz',
    'https://www.krexa.xyz',
    /\.krexa\.xyz$/,
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST'],
}));
app.use(express.json());

function broadcast(event: string, data: unknown): void {
  const msg = JSON.stringify({ event, data });
  wss.clients.forEach((client: WsClient) => {
    if (client.readyState === 1 /* OPEN */) client.send(msg);
  });
}

wss.on('connection', (ws: WsClient) => {
  // Send current state to new connection
  ws.send(JSON.stringify({
    event: 'demo_status',
    data: { status: demoStatus, lastRunAt },
  }));
});

// ── Routes ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: demoStatus });
});

app.get('/status', (_req, res) => {
  res.json({ status: demoStatus, lastRunAt, error: demoError });
});

app.post('/trigger', (_req, res) => {
  if (demoStatus === 'running') {
    res.status(409).json({ error: 'Demo already running' });
    return;
  }

  demoStatus = 'running';
  demoError = null;
  lastRunAt = new Date().toISOString();

  broadcast('demo_status', { status: 'running', lastRunAt });
  res.json({ ok: true, message: 'Demo started' });

  // Run demo in background — don't await here
  runDemo(broadcast)
    .then(() => {
      demoStatus = 'done';
      broadcast('demo_status', { status: 'done', lastRunAt });
    })
    .catch((err: unknown) => {
      demoStatus = 'error';
      demoError = err instanceof Error ? err.message : String(err);
      broadcast('demo_status', { status: 'error', error: demoError });
      console.error('[demo-server] runDemo failed:', demoError);
    });
});

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3002', 10);

server.listen(PORT, () => {
  console.log(`[demo-server] listening on port ${PORT}`);
  console.log(`[demo-server] WebSocket ready — connect from krexa.xyz/demo`);
});
