/**
 * Trading routes — swap quotes, execution, portfolio, yield scanning.
 *
 * POST /solana/trading/:agent/quote     — get swap quote (no execution)
 * POST /solana/trading/:agent/swap      — build unsigned swap transaction
 * GET  /solana/trading/:agent/portfolio — token balances + USD values
 * GET  /solana/trading/yield            — top yield opportunities on Solana
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { resolveToken, getQuote, buildSwapTx, getTokenPrices } from '../../services/dex-aggregator.js';
import { scanYields } from '../../services/yield-scanner.js';
import { readAgentWallet } from '../../chain/solana/reader.js';
import { agentWalletPda, walletUsdcPda } from '../../chain/solana/programs.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { SolanaQuoteSchema, SolanaSwapSchema } from '../schemas.js';

const router = Router();

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

// ---------------------------------------------------------------------------
// POST /solana/trading/:agent/quote — get swap quote
// ---------------------------------------------------------------------------

router.post('/:agent/quote', validate(SolanaQuoteSchema), async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);

    const fromToken = resolveToken(req.body.from);
    const toToken = resolveToken(req.body.to);
    const amount = req.body.amount as number;
    const slippageBps = req.body.slippageBps as number | undefined;

    // Convert human amount to base units
    const amountBaseUnits = Math.round(amount * Math.pow(10, fromToken.decimals)).toString();

    const quote = await getQuote({
      inputMint: fromToken.mint,
      outputMint: toToken.mint,
      amount: amountBaseUnits,
      slippageBps,
    });

    // Convert output to human-readable
    const outAmountHuman = Number(quote.outAmount) / Math.pow(10, toToken.decimals);

    res.json({
      agentPubkey: agentPk.toBase58(),
      from: { symbol: fromToken.symbol, mint: fromToken.mint, amount: amount.toString(), decimals: fromToken.decimals },
      to: { symbol: toToken.symbol, mint: toToken.mint, amount: outAmountHuman.toString(), decimals: toToken.decimals },
      priceImpactPct: quote.priceImpactPct,
      slippageBps: quote.slippageBps,
      routePlan: quote.routePlan,
      raw: quote,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /solana/trading/:agent/swap — build unsigned swap transaction
// ---------------------------------------------------------------------------

router.post('/:agent/swap', validate(SolanaSwapSchema), async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);
    const ownerPk = parsePubkey(req.body.ownerAddress);

    // Verify wallet exists and is not frozen
    const wallet = await readAgentWallet(agentPk);
    if (!wallet) throw new AppError(404, 'Agent wallet not found on-chain');
    if (wallet.isFrozen) throw new AppError(403, 'Agent wallet is frozen');

    const fromToken = resolveToken(req.body.from);
    const toToken = resolveToken(req.body.to);
    const amount = req.body.amount as number;
    const slippageBps = req.body.slippageBps as number | undefined;

    const amountBaseUnits = Math.round(amount * Math.pow(10, fromToken.decimals)).toString();

    // Get quote
    const quote = await getQuote({
      inputMint: fromToken.mint,
      outputMint: toToken.mint,
      amount: amountBaseUnits,
      slippageBps,
    });

    // Build unsigned transaction
    const swapResult = await buildSwapTx(quote, ownerPk.toBase58());

    // Record trade in DB
    const amountForDb = BigInt(amountBaseUnits);
    const isUsdcInput = fromToken.symbol === 'USDC';
    await prisma.solanaAgentTrade.create({
      data: {
        agentPubkey: agentPk.toBase58(),
        venue: 'jupiter',
        amount: amountForDb,
        direction: isUsdcInput ? 'buy' : 'sell',
        txSignature: `pending-${Date.now()}`,
        executedAt: new Date(),
      },
    });

    const outAmountHuman = Number(quote.outAmount) / Math.pow(10, toToken.decimals);

    res.json({
      transaction: swapResult.swapTransaction,
      encoding: 'base64',
      description: `Swap ${amount} ${fromToken.symbol} → ${outAmountHuman.toFixed(6)} ${toToken.symbol} via Jupiter`,
      quote: {
        from: { symbol: fromToken.symbol, mint: fromToken.mint, amount: amount.toString() },
        to: { symbol: toToken.symbol, mint: toToken.mint, amount: outAmountHuman.toString() },
        priceImpactPct: quote.priceImpactPct,
        slippageBps: quote.slippageBps,
      },
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /solana/trading/:agent/portfolio — token balances + USD values
// ---------------------------------------------------------------------------

router.get('/:agent/portfolio', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);

    const wallet = await readAgentWallet(agentPk);
    if (!wallet) throw new AppError(404, 'Agent wallet not found on-chain');

    const { solanaConnection } = await import('../../chain/solana/connection.js');

    // Get all token accounts owned by the wallet PDA
    const walletPda = agentWalletPda(agentPk);
    const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(walletPda, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    // Also check the dedicated wallet_usdc PDA balance
    const walletUsdcAddr = walletUsdcPda(agentPk);
    const usdcBalance = await solanaConnection.getTokenAccountBalance(walletUsdcAddr).catch(() => null);

    // Build token list
    interface TokenEntry { mint: string; balance: number; decimals: number; symbol: string }
    const tokens: TokenEntry[] = [];

    if (usdcBalance?.value) {
      tokens.push({
        mint: wallet.walletUsdc.toBase58(),
        balance: Number(usdcBalance.value.uiAmount ?? 0),
        decimals: usdcBalance.value.decimals,
        symbol: 'USDC',
      });
    }

    for (const { account } of tokenAccounts.value) {
      const parsed = account.data.parsed?.info;
      if (!parsed) continue;
      const mint = parsed.mint as string;
      const amount = Number(parsed.tokenAmount?.uiAmount ?? 0);
      const decimals = parsed.tokenAmount?.decimals ?? 6;
      if (amount <= 0) continue;
      // Avoid double-counting USDC
      if (usdcBalance?.value && mint === wallet.walletUsdc.toBase58()) continue;
      tokens.push({ mint, balance: amount, decimals, symbol: mint.slice(0, 6) + '...' });
    }

    // Get SOL balance of the wallet PDA
    const solBalance = await solanaConnection.getBalance(walletPda);
    if (solBalance > 0) {
      tokens.unshift({
        mint: 'So11111111111111111111111111111111111111112',
        balance: solBalance / 1e9,
        decimals: 9,
        symbol: 'SOL',
      });
    }

    // Fetch USD prices
    const mints = tokens.map(t => t.mint);
    const prices = await getTokenPrices(mints);

    const enriched = tokens.map(t => {
      const price = prices[t.mint]?.price ?? 0;
      return {
        mint: t.mint,
        symbol: t.symbol,
        balance: t.balance.toString(),
        price: price.toString(),
        balanceUsd: (t.balance * price).toFixed(2),
      };
    });

    const totalValueUsd = enriched.reduce((sum, t) => sum + Number(t.balanceUsd), 0);

    res.json({
      agentPubkey: agentPk.toBase58(),
      tokens: enriched,
      totalValueUsd: totalValueUsd.toFixed(2),
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /solana/trading/yield — top yield opportunities
// ---------------------------------------------------------------------------

router.get('/yield', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const minTvl = req.query.minTvl ? Number(req.query.minTvl) : undefined;
    const token = req.query.token as string | undefined;

    const opportunities = await scanYields({ limit, minTvl, token });

    res.json({
      opportunities,
      count: opportunities.length,
      cachedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

export default router;
