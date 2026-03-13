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
import { readAgentWallet, readTokenBalance } from '../../chain/solana/reader.js';
import {
  buildCreateWallet, instructionToUnsignedTx,
  buildProposeOwnershipTransfer, buildAcceptOwnershipTransfer, buildCancelOwnershipTransfer,
} from '../../chain/solana/builder.js';
import { walletUsdcPda } from '../../chain/solana/programs.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

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

// POST /solana/wallets/create  — returns unsigned transaction
router.post('/create', async (req, res, next) => {
  try {
    const { agent, owner, dailySpendLimitUsdc } = req.body;
    if (!agent || !owner) throw new AppError(400, 'agent and owner required');

    const agentPk = parsePubkey(agent);
    const ownerPk = parsePubkey(owner);
    const dailySpendLimit = BigInt(Math.round((dailySpendLimitUsdc ?? 500) * 1_000_000));

    const ixn = buildCreateWallet({ agent: agentPk, owner: ownerPk, dailySpendLimit });
    const tx = await instructionToUnsignedTx(ixn, ownerPk);

    res.json({
      transaction: tx,
      encoding: 'base64',
      description: `Create krexa agent wallet for ${agent}`,
    });
  } catch (err) { next(err); }
});

// POST /solana/wallets/:agent/propose-transfer
// Body: { owner, newOwner, newOwnerType }
router.post('/:agent/propose-transfer', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const { owner, newOwner, newOwnerType } = req.body;
    if (!owner || !newOwner) throw new AppError(400, 'owner and newOwner required');
    const ownerPk = parsePubkey(owner);
    const newOwnerPk = parsePubkey(newOwner);
    const ownerTypeParsed = Number(newOwnerType ?? 0);
    if (ownerTypeParsed < 0 || ownerTypeParsed > 1) throw new AppError(400, 'newOwnerType must be 0 or 1');

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
router.post('/:agent/accept-transfer', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const { newOwner, rentReceiver } = req.body;
    if (!newOwner) throw new AppError(400, 'newOwner required');
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
router.post('/:agent/cancel-transfer', async (req, res, next) => {
  try {
    const agentPk = parsePubkey(req.params.agent);
    const { owner } = req.body;
    if (!owner) throw new AppError(400, 'owner required');
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
