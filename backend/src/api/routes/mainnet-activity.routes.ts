import { Router } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../../config/env.js';

const router = Router();

// Deduplicated RPC list — env var first, then public fallbacks
const MAINNET_RPCS = [...new Set([
  env.SOLANA_MAINNET_RPC_URL,
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
])];

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
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

/** Try each RPC in order (sequential fallback) */
async function rpcCallFallback(method: string, params: unknown[]): Promise<unknown> {
  let lastErr: Error | undefined;
  for (const url of MAINNET_RPCS) {
    try {
      return await rpcCall(url, method, params);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error('All RPC endpoints failed');
}

router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!address || address.length < 32) {
      throw new AppError(400, 'Invalid address');
    }
    const detailed = req.query.detailed === 'true';

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
    const solBalance = lamports / 1e9;

    // Detailed mode: sample transactions to extract program IDs
    let programIds: string[] = [];
    let uniquePrograms = 0;
    if (detailed && allSigs.length > 0) {
      // Sample up to 20 recent signatures
      const sampled = allSigs.slice(0, 20);
      const txResults = await Promise.allSettled(
        sampled.map(s =>
          rpcCallFallback('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }])
        )
      );
      const programSet = new Set<string>();
      for (const r of txResults) {
        if (r.status !== 'fulfilled' || !r.value) continue;
        const tx = r.value as {
          transaction?: { message?: { accountKeys?: string[] } };
          meta?: { logMessages?: string[] };
        };
        // Extract program IDs from account keys (programs are typically at the end)
        const keys = tx?.transaction?.message?.accountKeys ?? [];
        // Extract invoked programs from log messages (more reliable)
        const logs = tx?.meta?.logMessages ?? [];
        for (const log of logs) {
          const match = log.match(/^Program (\w{32,}) invoke/);
          if (match) programSet.add(match[1]);
        }
        // Fallback: last few account keys are often programs
        if (programSet.size === 0 && keys.length > 0) {
          // Add last 3 keys as potential programs
          keys.slice(-3).forEach(k => programSet.add(k));
        }
      }
      programIds = [...programSet];
      uniquePrograms = programIds.length;
    }

    const response: Record<string, unknown> = {
      lamports,
      txCount,
      walletAgeDays: Math.round(walletAgeDays * 10) / 10,
      tokenAccounts,
      solBalance,
    };

    if (detailed) {
      response.programIds = programIds;
      response.uniquePrograms = uniquePrograms;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
