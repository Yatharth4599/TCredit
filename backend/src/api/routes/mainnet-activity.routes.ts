import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const MAINNET_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-rpc.publicnode.com',
];

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { result?: unknown; error?: unknown };
    if (json.error) throw new Error(JSON.stringify(json.error));
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCallBest(method: string, params: unknown[]): Promise<unknown> {
  const results = await Promise.allSettled(
    MAINNET_RPCS.map(url => rpcCall(url, method, params))
  );
  let best: unknown = undefined;
  for (const r of results) {
    if (r.status !== 'fulfilled' || r.value == null) continue;
    if (best === undefined) { best = r.value; continue; }
    if (Array.isArray(r.value) && Array.isArray(best) && r.value.length > best.length) {
      best = r.value;
    }
  }
  if (best !== undefined) return best;
  throw new Error('All RPC endpoints failed');
}

router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!address || address.length < 32) {
      throw new AppError(400, 'Invalid address');
    }

    const [acctResult, sigsResult] = await Promise.allSettled([
      rpcCallBest('getAccountInfo', [address, { encoding: 'base64' }]),
      rpcCallBest('getSignaturesForAddress', [address, { limit: 200 }]),
    ]);

    let lamports = 0;
    if (acctResult.status === 'fulfilled' && acctResult.value) {
      const v = acctResult.value as { value?: { lamports?: number } };
      lamports = v?.value?.lamports ?? 0;
    }

    type Sig = { blockTime?: number | null; signature: string };
    let allSigs: Sig[] = [];
    if (sigsResult.status === 'fulfilled' && Array.isArray(sigsResult.value)) {
      allSigs = sigsResult.value as Sig[];

      // Paginate to find true wallet age (up to 10 pages x 200 = 2,000 txs)
      let page = 0;
      while (allSigs.length === (page + 1) * 200 && page < 9) {
        const cursor = allSigs[allSigs.length - 1].signature;
        try {
          const older = await rpcCallBest('getSignaturesForAddress', [
            address,
            { limit: 200, before: cursor },
          ]);
          if (!Array.isArray(older) || older.length === 0) break;
          allSigs = [...allSigs, ...(older as Sig[])];
        } catch { break; }
        page++;
      }
    }

    const txCount = allSigs.length;

    let walletAgeDays = 0;
    for (let i = allSigs.length - 1; i >= 0; i--) {
      if (allSigs[i].blockTime) {
        walletAgeDays = (Date.now() / 1000 - allSigs[i].blockTime!) / 86400;
        break;
      }
    }

    const tokenAccounts = Math.min(10, Math.floor(txCount / 5));
    res.json({ lamports, txCount, walletAgeDays: Math.round(walletAgeDays * 10) / 10, tokenAccounts });
  } catch (err) {
    next(err);
  }
});

export default router;
