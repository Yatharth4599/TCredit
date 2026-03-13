/**
 * Solana Event Indexer
 *
 * Uses getSignaturesForAddress on each program to discover new transactions,
 * fetches each transaction, parses Anchor event logs (base64-encoded CPI logs),
 * and persists events to the DB.
 *
 * Anchor events are emitted as base64-encoded data in program logs:
 *   "Program data: <base64>"
 * The first 8 bytes of the decoded data are the event discriminator.
 */

import { PublicKey, ConfirmedSignatureInfo } from '@solana/web3.js';
import { createHash } from 'crypto';
import { solanaConnection } from '../chain/solana/connection.js';
import { PROGRAM_IDS } from '../chain/solana/programs.js';
import { prisma } from '../config/prisma.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;   // 5 seconds between polls
const BATCH_SIZE = 20;            // signatures to fetch per poll

// ---------------------------------------------------------------------------
// Event discriminator helpers
// ---------------------------------------------------------------------------

function eventDisc(name: string): string {
  // Anchor event discriminator: sha256("event:<Name>")[0..8] encoded as hex
  return createHash('sha256')
    .update(`event:${name}`)
    .digest()
    .subarray(0, 8)
    .toString('hex');
}

const EVENT_DISCS: Record<string, string> = {
  // krexa-agent-registry
  AgentRegistered:    eventDisc('AgentRegistered'),
  KyaUpdated:         eventDisc('KyaUpdated'),
  CreditScoreUpdated: eventDisc('CreditScoreUpdated'),
  LiquidationRecorded: eventDisc('LiquidationRecorded'),

  // krexa-credit-vault
  CollateralDeposited: eventDisc('CollateralDeposited'),
  CreditExtended:      eventDisc('CreditExtended'),
  RepaymentReceived:   eventDisc('RepaymentReceived'),
  AgentLiquidated:     eventDisc('AgentLiquidated'),

  // krexa-agent-wallet
  WalletCreated:   eventDisc('WalletCreated'),
  TradeExecuted:   eventDisc('TradeExecuted'),
  CreditReceived:  eventDisc('CreditReceived'),
  CreditRepaid:    eventDisc('CreditRepaid'),
  HealthChecked:   eventDisc('HealthChecked'),
  WalletDeleveraged: eventDisc('WalletDeleveraged'),
  WalletLiquidated:  eventDisc('WalletLiquidated'),

  // krexa-payment-router
  RouterInitialized:  eventDisc('RouterInitialized'),
  SettlementActivated: eventDisc('SettlementActivated'),
  PaymentRouted:      eventDisc('PaymentRouted'),
  SplitUpdated:       eventDisc('SplitUpdated'),
  SettlementDeactivated: eventDisc('SettlementDeactivated'),
};

// Reverse map: discriminator hex → event name
const DISC_TO_NAME = Object.fromEntries(
  Object.entries(EVENT_DISCS).map(([name, disc]) => [disc, name]),
);

// ---------------------------------------------------------------------------
// Parse Anchor events from transaction logs
// ---------------------------------------------------------------------------

interface ParsedEvent {
  name: string;
  data: Buffer;
  raw: string;
}

function parseAnchorEvents(logs: string[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  for (const log of logs) {
    // Anchor CPI events are logged as: "Program data: <base64>"
    const match = log.match(/^Program data: (.+)$/);
    if (!match) continue;

    const rawB64 = match[1];
    let decoded: Buffer;
    try {
      decoded = Buffer.from(rawB64, 'base64');
    } catch {
      continue;
    }

    if (decoded.length < 8) continue;
    const disc = decoded.subarray(0, 8).toString('hex');
    const name = DISC_TO_NAME[disc];
    if (!name) continue;

    events.push({ name, data: decoded.subarray(8), raw: rawB64 });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Event handlers — update DB from parsed events
// ---------------------------------------------------------------------------

async function handleAgentRegistered(data: Buffer, txSig: string, slot: number): Promise<void> {
  // AgentRegistered { agent: Pubkey, owner: Pubkey, name: [u8;32] }
  if (data.length < 96) return;
  const agentPubkey = new PublicKey(data.subarray(0, 32)).toBase58();
  const ownerPubkey = new PublicKey(data.subarray(32, 64)).toBase58();
  const nameRaw = data.subarray(64, 96);
  const name = nameRaw.subarray(0, nameRaw.indexOf(0) < 0 ? 32 : nameRaw.indexOf(0)).toString('utf8');

  await storeEvent('AgentRegistered', { agentPubkey, ownerPubkey, name }, txSig, slot);
}

async function handleCreditScoreUpdated(data: Buffer, txSig: string, slot: number): Promise<void> {
  // CreditScoreUpdated { agent, old_score: u16, new_score: u16, old_level: u8, new_level: u8 }
  if (data.length < 36) return;
  const agentPubkey = new PublicKey(data.subarray(0, 32)).toBase58();
  const newScore = data.readUInt16LE(34);
  const newLevel = data.readUInt8(35);

  await prisma.solanaAgentWallet.updateMany({
    where: { agentPubkey },
    data: { creditLevel: newLevel },
  }).catch(() => {});

  await storeEvent('CreditScoreUpdated', { agentPubkey, newScore, newLevel }, txSig, slot);
}

async function handleWalletCreated(data: Buffer, txSig: string, slot: number): Promise<void> {
  // WalletCreated { agent: Pubkey, owner: Pubkey, daily_spend_limit: u64 }
  if (data.length < 72) return;
  const agentPubkey = new PublicKey(data.subarray(0, 32)).toBase58();
  const ownerPubkey = new PublicKey(data.subarray(32, 64)).toBase58();
  const dailySpendLimit = data.readBigUInt64LE(64);

  // Upsert wallet record
  await prisma.solanaAgentWallet.upsert({
    where: { agentPubkey },
    create: {
      agentPubkey,
      ownerPubkey,
      dailySpendLimit,
    },
    update: {},
  }).catch(() => {});

  await storeEvent('WalletCreated', { agentPubkey, ownerPubkey, dailySpendLimit: dailySpendLimit.toString() }, txSig, slot);
}

async function handleTradeExecuted(data: Buffer, txSig: string, slot: number): Promise<void> {
  // TradeExecuted { agent: Pubkey, venue: Pubkey, amount: u64, direction: bool }
  if (data.length < 73) return;
  const agentPubkey = new PublicKey(data.subarray(0, 32)).toBase58();
  const venue = new PublicKey(data.subarray(32, 64)).toBase58();
  const amount = data.readBigUInt64LE(64);
  const isBuy = data.readUInt8(72) !== 0;

  await prisma.solanaAgentTrade.create({
    data: {
      agentPubkey,
      venue,
      amount,
      direction: isBuy ? 'buy' : 'sell',
      txSignature: txSig,
      executedAt: new Date(),
    },
  }).catch(() => {});

  await prisma.solanaAgentWallet.updateMany({
    where: { agentPubkey },
    data: { totalTrades: { increment: 1n }, totalVolume: { increment: amount } },
  }).catch(() => {});

  await storeEvent('TradeExecuted', { agentPubkey, venue, amount: amount.toString(), direction: isBuy ? 'buy' : 'sell' }, txSig, slot);
}

async function handlePaymentRouted(data: Buffer, txSig: string, slot: number): Promise<void> {
  // PaymentRouted { merchant, agent_wallet_pda, amount, platform_fee, repayment, merchant_received, new_nonce }
  if (data.length < 104) return;
  const merchant = new PublicKey(data.subarray(0, 32)).toBase58();
  const agentWalletPda = new PublicKey(data.subarray(32, 64)).toBase58();
  const amount = data.readBigUInt64LE(64);
  const platformFee = data.readBigUInt64LE(72);
  const repayment = data.readBigUInt64LE(80);
  const merchantReceived = data.readBigUInt64LE(88);
  const newNonce = data.readBigUInt64LE(96);

  await storeEvent('PaymentRouted', {
    merchant, agentWalletPda, amount: amount.toString(),
    platformFee: platformFee.toString(), repayment: repayment.toString(),
    merchantReceived: merchantReceived.toString(), newNonce: newNonce.toString(),
  }, txSig, slot);
}

// ---------------------------------------------------------------------------
// Generic event storage
// ---------------------------------------------------------------------------

async function storeEvent(
  eventType: string,
  data: Record<string, unknown>,
  txSignature: string,
  slot: number,
): Promise<void> {
  await prisma.solanaEvent.upsert({
    where: { txSignature_eventType: { txSignature, eventType } },
    create: { eventType, data: data as never, txSignature, slot, indexedAt: new Date() },
    update: {},
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Process a single transaction
// ---------------------------------------------------------------------------

async function processSignature(sig: string): Promise<void> {
  const tx = await solanaConnection.getTransaction(sig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx?.meta?.logMessages) return;
  const events = parseAnchorEvents(tx.meta.logMessages);

  for (const event of events) {
    const slot = tx.slot;
    try {
      switch (event.name) {
        case 'AgentRegistered':    await handleAgentRegistered(event.data, sig, slot); break;
        case 'CreditScoreUpdated': await handleCreditScoreUpdated(event.data, sig, slot); break;
        case 'WalletCreated':      await handleWalletCreated(event.data, sig, slot); break;
        case 'TradeExecuted':      await handleTradeExecuted(event.data, sig, slot); break;
        case 'PaymentRouted':      await handlePaymentRouted(event.data, sig, slot); break;
        default:
          await storeEvent(event.name, { raw: event.raw }, sig, slot);
      }
    } catch (err) {
      console.error(`[SolanaIndexer] Handler error for ${event.name}:`, err instanceof Error ? err.message : err);
    }
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function pollProgram(programId: PublicKey, lastSig: string | null): Promise<string | null> {
  const opts: { limit: number; before?: undefined; until?: string } = { limit: BATCH_SIZE };
  if (lastSig) opts.until = lastSig;

  let sigs: ConfirmedSignatureInfo[];
  try {
    sigs = await solanaConnection.getSignaturesForAddress(programId, opts, 'confirmed');
  } catch {
    return lastSig;
  }

  if (sigs.length === 0) return lastSig;

  // Process oldest-first (sigs come back newest-first)
  const ordered = [...sigs].reverse();
  for (const { signature, err } of ordered) {
    if (err) continue; // skip failed transactions
    try {
      await processSignature(signature);
    } catch (e) {
      console.error(`[SolanaIndexer] processSignature(${signature}) error:`, e instanceof Error ? e.message : e);
    }
  }

  return sigs[0].signature; // newest signature processed
}

async function runPollCycle(): Promise<void> {
  const state = await prisma.solanaIndexerState.upsert({
    where: { id: 'solana-singleton' },
    create: { id: 'solana-singleton' },
    update: {},
  });

  const lastSig = state.lastSignature;

  // Poll all 5 programs in parallel
  const [regSig, vaultSig, walletSig, venueSig, routerSig] = await Promise.all([
    pollProgram(PROGRAM_IDS.agentRegistry,  lastSig),
    pollProgram(PROGRAM_IDS.creditVault,    lastSig),
    pollProgram(PROGRAM_IDS.agentWallet,    lastSig),
    pollProgram(PROGRAM_IDS.venueWhitelist, lastSig),
    pollProgram(PROGRAM_IDS.paymentRouter,  lastSig),
  ]);

  // Persist the most recently-seen signature (wallet program is most active)
  const newest = walletSig ?? vaultSig ?? regSig ?? routerSig ?? venueSig;
  if (newest && newest !== lastSig) {
    await prisma.solanaIndexerState.update({
      where: { id: 'solana-singleton' },
      data: { lastSignature: newest },
    });
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let indexerInterval: NodeJS.Timeout | null = null;

export function startSolanaIndexer(): void {
  if (indexerInterval) return;
  console.log('[SolanaIndexer] Started (poll interval: 5s)');

  runPollCycle().catch((err) => console.error('[SolanaIndexer] Initial poll error:', err));
  indexerInterval = setInterval(() => {
    runPollCycle().catch((err) => console.error('[SolanaIndexer] Poll error:', err));
  }, POLL_INTERVAL_MS);
}

export function stopSolanaIndexer(): void {
  if (indexerInterval) {
    clearInterval(indexerInterval);
    indexerInterval = null;
    console.log('[SolanaIndexer] Stopped');
  }
}

export async function getSolanaIndexerHealth() {
  const state = await prisma.solanaIndexerState.findUnique({ where: { id: 'solana-singleton' } }).catch(() => null);
  const eventCount = await prisma.solanaEvent.count().catch(() => 0);
  return {
    running: indexerInterval !== null,
    lastSignature: state?.lastSignature ?? null,
    totalEvents: eventCount,
    updatedAt: state?.updatedAt?.toISOString() ?? null,
  };
}
