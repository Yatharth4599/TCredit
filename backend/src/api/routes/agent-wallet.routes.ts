/**
 * Agent Wallet routes — Solana program reads + unsigned tx builders
 *
 * GET  /api/v1/solana/wallets/:agent          — full wallet state
 * GET  /api/v1/solana/wallets/:agent/health   — current health factor
 * GET  /api/v1/solana/wallets/:agent/balance  — USDC balance
 * POST /api/v1/solana/wallets/create          — unsigned create_wallet tx
 * POST /api/v1/solana/wallets/:agent/freeze   — (admin) freeze wallet
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { readAgentWallet, readAgentProfile, readTokenBalance } from '../../chain/solana/reader.js';
import { agentProfilePda, agentWalletPda } from '../../chain/solana/programs.js';
import {
  buildCreateWallet, buildRegisterAgent, buildUpdateKya, instructionToUnsignedTx,
  buildProposeOwnershipTransfer, buildAcceptOwnershipTransfer, buildCancelOwnershipTransfer,
} from '../../chain/solana/builder.js';
import { walletUsdcPda } from '../../chain/solana/programs.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import {
  SolanaWalletCreateSchema, SolanaWalletProposeTransferSchema,
  SolanaWalletAcceptTransferSchema, SolanaWalletCancelTransferSchema,
} from '../schemas.js';

const router = Router();

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

function walletToJson(w: Awaited<ReturnType<typeof readAgentWallet>>) {
  if (!w) return null;
  return {
    agent:            w.agent.toBase58(),
    owner:            w.owner.toBase58(),
    walletUsdc:       w.walletUsdc.toBase58(),
    creditLevel:      w.creditLevel,
    creditLimit:      w.creditLimit.toString(),
    creditDrawn:      w.creditDrawn.toString(),
    totalDebt:        w.totalDebt.toString(),
    collateralShares: w.collateralShares.toString(),
    dailySpendLimit:  w.dailySpendLimit.toString(),
    dailySpent:       w.dailySpent.toString(),
    healthFactorBps:  w.healthFactorBps,
    healthFactorDisplay: (w.healthFactorBps / 10_000).toFixed(4),
    lastHealthCheck:  new Date(Number(w.lastHealthCheck) * 1000).toISOString(),
    isFrozen:         w.isFrozen,
    isLiquidating:    w.isLiquidating,
    totalTrades:      w.totalTrades.toString(),
    totalVolume:      w.totalVolume.toString(),
    totalRepaid:      w.totalRepaid.toString(),
    createdAt:        new Date(Number(w.createdAt) * 1000).toISOString(),
    ownerType:        w.ownerType === 1 ? 'multisig' : 'eoa',
  };
}

// GET /solana/wallets/:agent
router.get('/:agent', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const [wallet, dbRecord] = await Promise.all([
      readAgentWallet(agentPk),
      prisma.solanaAgentWallet.findUnique({ where: { agentPubkey: req.params.agent } }).catch(() => null),
    ]);

    if (!wallet) throw new AppError(404, 'Agent wallet not found on-chain');

    res.json({
      onChain: walletToJson(wallet),
      db: dbRecord ?? null,
    });
  } catch (err) { next(err); }
});

// GET /solana/wallets/:agent/health
router.get('/:agent/health', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const wallet = await readAgentWallet(agentPk);
    if (!wallet) throw new AppError(404, 'Agent wallet not found');

    const hf = wallet.healthFactorBps;
    const status =
      hf < 10_500 ? 'critical' :
      hf < 12_000 ? 'danger' :
      hf < 13_000 ? 'warning' : 'healthy';

    res.json({
      agentPubkey: req.params.agent,
      healthFactorBps: hf,
      healthFactor: (hf / 10_000).toFixed(4),
      status,
      creditDrawn:  wallet.creditDrawn.toString(),
      totalDebt:    wallet.totalDebt.toString(),
      isFrozen:     wallet.isFrozen,
      isLiquidating: wallet.isLiquidating,
      lastHealthCheck: new Date(Number(wallet.lastHealthCheck) * 1000).toISOString(),
    });
  } catch (err) { next(err); }
});

// GET /solana/wallets/:agent/balance
router.get('/:agent/balance', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const wallet = await readAgentWallet(agentPk);
    if (!wallet) throw new AppError(404, 'Agent wallet not found');

    const balance = await readTokenBalance(wallet.walletUsdc);

    res.json({
      agentPubkey: req.params.agent,
      walletUsdc: wallet.walletUsdc.toBase58(),
      balanceBaseUnits: balance.toString(),
      balanceUsdc: (Number(balance) / 1_000_000).toFixed(6),
    });
  } catch (err) { next(err); }
});

// GET /solana/wallets/:agent/trades
router.get('/:agent/trades', async (req, res, next) => {
  try {
    const agentPubkey = req.params.agent;
    parsePubkey(agentPubkey); // validate

    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const trades = await prisma.solanaAgentTrade.findMany({
      where: { agentPubkey },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });

    res.json({
      agentPubkey,
      trades: trades.map((t) => ({
        id: t.id,
        venue: t.venue,
        amount: t.amount.toString(),
        direction: t.direction,
        txSignature: t.txSignature,
        executedAt: t.executedAt.toISOString(),
      })),
      total: trades.length,
    });
  } catch (err) { next(err); }
});

// POST /solana/wallets/create  — returns partially-signed transaction
// Bundles register_agent + update_kya + create_wallet in one atomic tx.
// Oracle signs update_kya server-side; user's wallet signs the rest.
router.post('/create', validate(SolanaWalletCreateSchema), async (req, res, next) => {
  try {
    const { agent, owner, dailySpendLimitUsdc } = req.body;

    const agentPk = parsePubkey(agent);
    const ownerPk = parsePubkey(owner);
    const dailySpendLimit = BigInt(Math.round((dailySpendLimitUsdc ?? 500) * 1_000_000));

    const { solanaConnection, oracleSolanaKeypair } = await import('../../chain/solana/connection.js');
    const { Transaction } = await import('@solana/web3.js');

    // Raw existence checks (no deserialization — avoids stale struct issues)
    const [profileAcct, walletAcct] = await Promise.all([
      solanaConnection.getAccountInfo(agentProfilePda(agentPk)),
      solanaConnection.getAccountInfo(agentWalletPda(agentPk)),
    ]);

    // If wallet already exists, nothing to do
    if (walletAcct) {
      res.json({ transaction: null, description: 'Agent wallet already exists', agentPubkey: agent });
      return;
    }

    const needsRegister = !profileAcct;
    // If profile exists, try to read credit_level; default to needing KYA if read fails
    let needsKya = true;
    if (profileAcct) {
      const profile = await readAgentProfile(agentPk).catch(() => null);
      needsKya = !profile || profile.creditLevel < 1;
    }

    const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: ownerPk });

    // 1. Register agent if needed (user signs as agent + owner)
    if (needsRegister) {
      tx.add(buildRegisterAgent({ agent: agentPk, owner: ownerPk, name: 'krexa-agent' }));
    }

    // 2. Update KYA to tier 1 if needed (oracle signs — sets credit_level to 1)
    if (needsKya && oracleSolanaKeypair) {
      tx.add(buildUpdateKya({ oracle: oracleSolanaKeypair.publicKey, agent: agentPk, newTier: 1 }));
    }

    // 3. Create wallet (user signs as agent + owner, requires credit_level >= 1)
    tx.add(buildCreateWallet({ agent: agentPk, owner: ownerPk, dailySpendLimit }));

    // Partially sign with oracle if KYA instruction was added
    if (needsKya && oracleSolanaKeypair) {
      tx.partialSign(oracleSolanaKeypair);
    }

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

    res.json({
      transaction: serialized,
      encoding: 'base64',
      description: `Register and create krexa agent wallet for ${agent}`,
    });
  } catch (err) { next(err); }
});

// POST /solana/wallets/:agent/propose-transfer
// Body: { owner, newOwner, newOwnerType }
router.post('/:agent/propose-transfer', validate(SolanaWalletProposeTransferSchema), async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);
    const { owner, newOwner, newOwnerType } = req.body;
    const ownerPk = parsePubkey(owner);
    const newOwnerPk = parsePubkey(newOwner);
    const ownerTypeParsed = Number(newOwnerType ?? 0);

    const ixn = buildProposeOwnershipTransfer({
      agent: agentPk,
      owner: ownerPk,
      newOwner: newOwnerPk,
      newOwnerType: ownerTypeParsed,
    });
    const tx = await instructionToUnsignedTx(ixn, ownerPk);

    res.json({
      transaction: tx,
      encoding: 'base64',
      description: `Propose ownership transfer for agent ${req.params.agent} to ${newOwner}`,
    });
  } catch (err) { next(err); }
});

// POST /solana/wallets/:agent/accept-transfer
// Body: { newOwner, rentReceiver? }
router.post('/:agent/accept-transfer', validate(SolanaWalletAcceptTransferSchema), async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);
    const { newOwner, rentReceiver } = req.body;
    const newOwnerPk = parsePubkey(newOwner);
    const rentReceiverPk = rentReceiver ? parsePubkey(rentReceiver) : newOwnerPk;

    const ixn = buildAcceptOwnershipTransfer({
      agent: agentPk,
      newOwner: newOwnerPk,
      rentReceiver: rentReceiverPk,
    });
    const tx = await instructionToUnsignedTx(ixn, newOwnerPk);

    res.json({
      transaction: tx,
      encoding: 'base64',
      description: `Accept ownership transfer for agent ${req.params.agent}`,
    });
  } catch (err) { next(err); }
});

// POST /solana/wallets/:agent/cancel-transfer
// Body: { owner }
router.post('/:agent/cancel-transfer', validate(SolanaWalletCancelTransferSchema), async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent as string);
    const { owner } = req.body;
    const ownerPk = parsePubkey(owner);

    const ixn = buildCancelOwnershipTransfer({ agent: agentPk, owner: ownerPk });
    const tx = await instructionToUnsignedTx(ixn, ownerPk);

    res.json({
      transaction: tx,
      encoding: 'base64',
      description: `Cancel ownership transfer for agent ${req.params.agent}`,
    });
  } catch (err) { next(err); }
});

// GET /solana/wallets — list all wallets from DB (keeper-synced)
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const wallets = await prisma.solanaAgentWallet.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      wallets: wallets.map((w) => ({
        agentPubkey: w.agentPubkey,
        ownerPubkey: w.ownerPubkey,
        ownerType: w.ownerType,
        pendingOwner: w.pendingOwner ?? null,
        creditLevel: w.creditLevel,
        healthFactorBps: w.healthFactorBps,
        isFrozen: w.isFrozen,
        isLiquidating: w.isLiquidating,
        creditDrawn: w.creditDrawn.toString(),
      })),
      total: wallets.length,
    });
  } catch (err) { next(err); }
});

export default router;
