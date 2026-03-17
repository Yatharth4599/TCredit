import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requirePayment } from './x402-middleware.js';
import { analyzeToken, analyzeTrending } from './analyzer.js';

const app = express();
app.use(cors());
app.use(express.json());

const startTime = Date.now();

// ---------------------------------------------------------------------------
// GET /health — no payment required
// ---------------------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agent: 'Krexa Research Agent',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    merchantWallet: config.merchantWallet,
    network: 'solana',
  });
});

// ---------------------------------------------------------------------------
// GET /api/analyze/:tokenAddress — $0.25 USDC via x402
// ---------------------------------------------------------------------------

app.get(
  '/api/analyze/:tokenAddress',
  requirePayment(config.prices.analyze),
  async (req: Request, res: Response): Promise<void> => {
    const { tokenAddress } = req.params;
    const paymentTx = (req as Request & { paymentTx: string }).paymentTx;

    // BUG-037 fix: validate base58 format, not just length (prevents prompt injection)
    const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!tokenAddress || !SOLANA_ADDR_RE.test(tokenAddress)) {
      res.status(400).json({ error: 'Invalid Solana token address format' });
      return;
    }

    try {
      const result = await analyzeToken(tokenAddress, paymentTx);
      res.json(result);
    } catch (err) {
      console.error('[analyze] error:', err);
      res.status(500).json({ error: 'Analysis failed — please retry' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/trending — $0.50 USDC via x402
// ---------------------------------------------------------------------------

app.get(
  '/api/trending',
  requirePayment(config.prices.trending),
  async (req: Request, res: Response): Promise<void> => {
    const paymentTx = (req as Request & { paymentTx: string }).paymentTx;

    try {
      const result = await analyzeTrending(paymentTx);
      res.json(result);
    } catch (err) {
      console.error('[trending] error:', err);
      res.status(500).json({ error: 'Analysis failed — please retry' });
    }
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(config.port, () => {
  console.log(`
┌─────────────────────────────────────────────────┐
│          Krexa Research Agent — Live             │
│                                                  │
│  Port:    ${config.port}                                │
│  Network: Solana                                 │
│  Wallet:  ${config.merchantWallet.slice(0, 8)}...                    │
│                                                  │
│  Endpoints:                                      │
│  GET /health           — free                    │
│  GET /api/analyze/:id  — $0.25 USDC (x402)      │
│  GET /api/trending     — $0.50 USDC (x402)      │
│                                                  │
│  Credit repaid via Krexa Revenue Router          │
└─────────────────────────────────────────────────┘
  `);
});
