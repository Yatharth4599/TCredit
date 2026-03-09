import type { Address, AbiEvent } from 'viem';
import { publicClient, walletClient } from '../chain/client.js';
import {
  AgentRegistryABI,
  PaymentRouterABI,
  VaultFactoryABI,
  MerchantVaultABI,
  LiquidityPoolABI,
  MilestoneRegistryABI,
  addresses,
} from '../config/contracts.js';
import { getAllVaults } from '../chain/vaultFactory.js';
import { dispatchWebhook } from './webhook.service.js';
import { prisma } from '../config/prisma.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Block just before the first contract deployment (Base Sepolia, 2026-03-02)
const DEPLOYMENT_BLOCK = 38_200_000n;
// Max blocks to process per poll — avoids RPC rate limits
const MAX_BLOCKS_PER_POLL = 2000n;
// Poll interval in ms
const POLL_INTERVAL_MS = 15_000;

// Vault state enum → string
const VAULT_STATES: Record<number, string> = {
  0: 'fundraising',
  1: 'active',
  2: 'repaying',
  3: 'completed',
  4: 'defaulted',
  5: 'cancelled',
};

// ---------------------------------------------------------------------------
// Event ABI extraction helpers
// ---------------------------------------------------------------------------

function getEvent(abi: readonly unknown[], name: string): AbiEvent {
  const event = (abi as AbiEvent[]).find((e) => e.type === 'event' && e.name === name);
  if (!event) throw new Error(`Event ${name} not found in ABI`);
  return event;
}

const EVENTS = {
  // VaultFactory
  VaultCreated: getEvent(VaultFactoryABI, 'VaultCreated'),
  // AgentRegistry
  AgentRegistered: getEvent(AgentRegistryABI, 'AgentRegistered'),
  CreditScoreUpdated: getEvent(AgentRegistryABI, 'CreditScoreUpdated'),
  // PaymentRouter
  PaymentExecuted: getEvent(PaymentRouterABI, 'PaymentExecuted'),
  // MilestoneRegistry
  MilestoneSubmitted: getEvent(MilestoneRegistryABI, 'MilestoneSubmitted'),
  MilestoneApproved: getEvent(MilestoneRegistryABI, 'MilestoneApproved'),
  // MerchantVault (watched per-vault)
  Invested: getEvent(MerchantVaultABI, 'Invested'),
  TrancheReleased: getEvent(MerchantVaultABI, 'TrancheReleased'),
  RepaymentProcessed: getEvent(MerchantVaultABI, 'RepaymentProcessed'),
  WaterfallDistributed: getEvent(MerchantVaultABI, 'WaterfallDistributed'),
  VaultDefaulted: getEvent(MerchantVaultABI, 'VaultDefaulted'),
  VaultStateChanged: getEvent(MerchantVaultABI, 'VaultStateChanged'),
  // LiquidityPool
  AllocatedToVault: getEvent(LiquidityPoolABI, 'AllocatedToVault'),
  Deposited: getEvent(LiquidityPoolABI, 'Deposited'),
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v]),
  );
}

async function getBlockTimestamp(blockNumber: bigint): Promise<Date> {
  try {
    const block = await publicClient.getBlock({ blockNumber });
    return new Date(Number(block.timestamp) * 1000);
  } catch {
    return new Date();
  }
}

async function storeEvent(params: {
  vaultAddr: string | null;
  eventType: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}): Promise<void> {
  try {
    await prisma.vaultEvent.upsert({
      where: { txHash_logIndex: { txHash: params.txHash, logIndex: params.logIndex } },
      create: {
        vaultAddr: params.vaultAddr ?? undefined,
        eventType: params.eventType,
        data: serializeArgs(params.args) as never,
        blockNumber: params.blockNumber,
        txHash: params.txHash,
        logIndex: params.logIndex,
        timestamp: await getBlockTimestamp(params.blockNumber),
      },
      update: {}, // no-op if already exists (idempotent)
    });
  } catch (err) {
    // FK violation: vault not in DB yet — store without vault link
    if (err instanceof Error && err.message.includes('foreign key')) {
      await prisma.vaultEvent.upsert({
        where: { txHash_logIndex: { txHash: params.txHash, logIndex: params.logIndex } },
        create: {
          eventType: params.eventType,
          data: serializeArgs(params.args) as never,
          blockNumber: params.blockNumber,
          txHash: params.txHash,
          logIndex: params.logIndex,
          timestamp: await getBlockTimestamp(params.blockNumber),
        },
        update: {},
      });
    }
  }

  // Fire-and-forget webhook dispatch — never block indexing
  dispatchWebhook(params.eventType, {
    vaultAddress: params.vaultAddr,
    blockNumber: params.blockNumber.toString(),
    txHash: params.txHash,
    ...serializeArgs(params.args),
  }).catch((err) => {
    console.error(`[Webhooks] Dispatch error for ${params.eventType}:`, err);
  });
}

// ---------------------------------------------------------------------------
// Event Handlers (update denormalized DB tables)
// ---------------------------------------------------------------------------

async function handleVaultCreated(args: Record<string, unknown>, txHash: string, blockNumber: bigint): Promise<void> {
  const vault = args.vault as string;
  const agent = args.agent as string;
  await prisma.vault.upsert({
    where: { address: vault.toLowerCase() },
    create: {
      address: vault.toLowerCase(),
      merchantAddr: agent.toLowerCase(),
      targetAmount: BigInt(args.targetAmount as string),
      interestRateBps: Number(args.interestRateBps),
      durationSeconds: Number(args.durationSeconds),
      numTranches: 3, // default — will be corrected by chain reads
      state: 'fundraising',
      createdAt: await getBlockTimestamp(blockNumber),
    },
    update: {}, // already exists from chain reads — don't overwrite
  });
  await storeEvent({ vaultAddr: vault.toLowerCase(), eventType: 'VaultCreated', args, blockNumber, txHash, logIndex: 0 });
}

async function handleInvested(vaultAddr: string, args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  await prisma.vault.updateMany({
    where: { address: vaultAddr.toLowerCase() },
    data: { totalRaised: BigInt(args.totalRaised as string) },
  });
  // Upsert Investment record
  const investor = (args.investor as string).toLowerCase();
  const existing = await prisma.investment.findFirst({
    where: { vaultAddr: vaultAddr.toLowerCase(), investor },
  });
  if (!existing) {
    await prisma.investment.create({
      data: {
        vaultAddr: vaultAddr.toLowerCase(),
        investor,
        amount: BigInt(args.amount as string),
        investedAt: await getBlockTimestamp(blockNumber),
      },
    });
  }
  await storeEvent({ vaultAddr: vaultAddr.toLowerCase(), eventType: 'Invested', args, blockNumber, txHash, logIndex });
}

async function handleRepaymentProcessed(vaultAddr: string, args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  await prisma.vault.updateMany({
    where: { address: vaultAddr.toLowerCase() },
    data: {
      totalRepaid: { increment: BigInt(args.amount as string) },
      totalSeniorRepaid: { increment: BigInt(args.seniorPay as string) },
      totalPoolRepaid: { increment: BigInt(args.poolPay as string) },
    },
  });
  await storeEvent({ vaultAddr: vaultAddr.toLowerCase(), eventType: 'RepaymentProcessed', args, blockNumber, txHash, logIndex });
}

async function handleTrancheReleased(vaultAddr: string, args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  await prisma.vault.updateMany({
    where: { address: vaultAddr.toLowerCase() },
    data: { tranchesReleased: { increment: 1 } },
  });
  await storeEvent({ vaultAddr: vaultAddr.toLowerCase(), eventType: 'TrancheReleased', args, blockNumber, txHash, logIndex });
}

async function handleVaultStateChanged(vaultAddr: string, args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  const newStateNum = Number(args.newState);
  const newState = VAULT_STATES[newStateNum] ?? 'unknown';
  await prisma.vault.updateMany({
    where: { address: vaultAddr.toLowerCase() },
    data: { state: newState },
  });
  await storeEvent({ vaultAddr: vaultAddr.toLowerCase(), eventType: 'VaultStateChanged', args: { ...args, newStateStr: newState }, blockNumber, txHash, logIndex });
}

async function handleVaultDefaulted(vaultAddr: string, args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  await prisma.vault.updateMany({
    where: { address: vaultAddr.toLowerCase() },
    data: { state: 'defaulted' },
  });
  await storeEvent({ vaultAddr: vaultAddr.toLowerCase(), eventType: 'VaultDefaulted', args, blockNumber, txHash, logIndex });
}

async function handleCreditScoreUpdated(args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  const wallet = (args.wallet as string).toLowerCase();
  await prisma.merchant.upsert({
    where: { address: wallet },
    create: {
      address: wallet,
      creditScore: Number(args.score),
      creditTier: Number(args.tier),
      scoreUpdated: await getBlockTimestamp(blockNumber),
      registeredAt: await getBlockTimestamp(blockNumber),
    },
    update: {
      creditScore: Number(args.score),
      creditTier: Number(args.tier),
      scoreUpdated: await getBlockTimestamp(blockNumber),
    },
  });
  await storeEvent({ vaultAddr: null, eventType: 'CreditScoreUpdated', args, blockNumber, txHash, logIndex });
}

async function handleAllocatedToVault(poolAddr: string, args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  const vaultAddr = (args.vault as string).toLowerCase();
  const isSenior = poolAddr.toLowerCase() === addresses.seniorPool.toLowerCase();
  await prisma.vault.updateMany({
    where: { address: vaultAddr },
    data: isSenior
      ? { seniorFunded: { increment: BigInt(args.amount as string) } }
      : { poolFunded: { increment: BigInt(args.amount as string) } },
  });
  await storeEvent({ vaultAddr, eventType: 'PoolAllocated', args: { ...args, pool: poolAddr, isSenior }, blockNumber, txHash, logIndex });
}

async function handleMilestoneSubmitted(args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  const vaultAddr = (args.vault as string).toLowerCase();
  const trancheIndex = Number(args.trancheIndex);
  await prisma.milestoneRecord.upsert({
    where: { vaultAddr_milestoneId: { vaultAddr, milestoneId: trancheIndex } },
    create: { vaultAddr, milestoneId: trancheIndex, status: 'submitted', evidenceHash: args.evidenceHash as string, submittedAt: await getBlockTimestamp(blockNumber) },
    update: { status: 'submitted', evidenceHash: args.evidenceHash as string, submittedAt: await getBlockTimestamp(blockNumber) },
  });
  await storeEvent({ vaultAddr, eventType: 'MilestoneSubmitted', args, blockNumber, txHash, logIndex });
}

async function handleMilestoneApproved(args: Record<string, unknown>, txHash: string, blockNumber: bigint, logIndex: number): Promise<void> {
  const vaultAddr = (args.vault as string).toLowerCase();
  const trancheIndex = Number(args.trancheIndex);
  await prisma.milestoneRecord.updateMany({
    where: { vaultAddr, milestoneId: trancheIndex },
    data: { status: 'approved', approvedAt: await getBlockTimestamp(blockNumber) },
  });
  await storeEvent({ vaultAddr, eventType: 'MilestoneApproved', args, blockNumber, txHash, logIndex });
}

// ---------------------------------------------------------------------------
// Poll Cycle
// ---------------------------------------------------------------------------

async function runPollCycle(): Promise<void> {
  // Get or init indexer state
  const state = await prisma.indexerState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', lastBlock: DEPLOYMENT_BLOCK - 1n },
    update: {},
  });

  const fromBlock = state.lastBlock + 1n;
  const latestBlock = await publicClient.getBlockNumber();

  if (fromBlock > latestBlock) return; // already caught up

  const toBlock = fromBlock + MAX_BLOCKS_PER_POLL < latestBlock
    ? fromBlock + MAX_BLOCKS_PER_POLL
    : latestBlock;

  // Get all known vault addresses for per-vault event queries
  let vaultAddresses: Address[] = [];
  try {
    vaultAddresses = (await getAllVaults()) as Address[];
  } catch {
    // VaultFactory might have no vaults yet — continue
  }

  // Fetch all event logs in parallel
  const [
    agentRegisteredLogs,
    vaultCreatedLogs,
    creditScoreLogs,
    milestoneSumittedLogs,
    milestoneApprovedLogs,
    seniorAllocatedLogs,
    generalAllocatedLogs,
    investedLogs,
    trancheReleasedLogs,
    repaymentLogs,
    waterfallLogs,
    defaultedLogs,
    stateChangedLogs,
  ] = await Promise.all([
    publicClient.getLogs({ address: addresses.agentRegistry, event: EVENTS.AgentRegistered, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.vaultFactory, event: EVENTS.VaultCreated, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.agentRegistry, event: EVENTS.CreditScoreUpdated, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.milestoneRegistry, event: EVENTS.MilestoneSubmitted, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.milestoneRegistry, event: EVENTS.MilestoneApproved, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.seniorPool, event: EVENTS.AllocatedToVault, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.generalPool, event: EVENTS.AllocatedToVault, fromBlock, toBlock }),
    // Per-vault events: only query if we have vault addresses
    vaultAddresses.length > 0
      ? publicClient.getLogs({ address: vaultAddresses, event: EVENTS.Invested, fromBlock, toBlock })
      : Promise.resolve([]),
    vaultAddresses.length > 0
      ? publicClient.getLogs({ address: vaultAddresses, event: EVENTS.TrancheReleased, fromBlock, toBlock })
      : Promise.resolve([]),
    vaultAddresses.length > 0
      ? publicClient.getLogs({ address: vaultAddresses, event: EVENTS.RepaymentProcessed, fromBlock, toBlock })
      : Promise.resolve([]),
    vaultAddresses.length > 0
      ? publicClient.getLogs({ address: vaultAddresses, event: EVENTS.WaterfallDistributed, fromBlock, toBlock })
      : Promise.resolve([]),
    vaultAddresses.length > 0
      ? publicClient.getLogs({ address: vaultAddresses, event: EVENTS.VaultDefaulted, fromBlock, toBlock })
      : Promise.resolve([]),
    vaultAddresses.length > 0
      ? publicClient.getLogs({ address: vaultAddresses, event: EVENTS.VaultStateChanged, fromBlock, toBlock })
      : Promise.resolve([]),
  ]);

  // Auto-assign credit score (B tier, 600) to newly registered merchants
  for (const log of agentRegisteredLogs) {
    if (!log.args) continue;
    const agent = (log.args as Record<string, unknown>).wallet as Address;
    if (walletClient && agent) {
      try {
        const hash = await walletClient.writeContract({
          address: addresses.agentRegistry,
          abi: AgentRegistryABI,
          functionName: 'updateCreditScore',
          args: [agent, 600],
        });
        console.log(`[Indexer] Auto-assigned credit score 600 (B tier) to ${agent} — tx: ${hash}`);
      } catch (err) {
        console.error(`[Indexer] Failed to auto-assign credit score to ${agent}:`, err);
      }
    }
  }

  // Process VaultCreated first (ensures vault records exist before other events reference them)
  for (const log of vaultCreatedLogs) {
    if (!log.args || !log.transactionHash) continue;
    await handleVaultCreated(log.args as Record<string, unknown>, log.transactionHash, log.blockNumber);
  }

  // Process all other logs
  for (const log of investedLogs) {
    if (!log.args || !log.address || !log.transactionHash) continue;
    await handleInvested(log.address, log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of repaymentLogs) {
    if (!log.args || !log.address || !log.transactionHash) continue;
    await handleRepaymentProcessed(log.address, log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of trancheReleasedLogs) {
    if (!log.args || !log.address || !log.transactionHash) continue;
    await handleTrancheReleased(log.address, log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of stateChangedLogs) {
    if (!log.args || !log.address || !log.transactionHash) continue;
    await handleVaultStateChanged(log.address, log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of defaultedLogs) {
    if (!log.args || !log.address || !log.transactionHash) continue;
    await handleVaultDefaulted(log.address, log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of waterfallLogs) {
    if (!log.args || !log.address || !log.transactionHash) continue;
    await storeEvent({ vaultAddr: log.address.toLowerCase(), eventType: 'WaterfallDistributed', args: log.args as Record<string, unknown>, blockNumber: log.blockNumber, txHash: log.transactionHash, logIndex: log.logIndex });
  }
  for (const log of creditScoreLogs) {
    if (!log.args || !log.transactionHash) continue;
    await handleCreditScoreUpdated(log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of seniorAllocatedLogs) {
    if (!log.args || !log.transactionHash) continue;
    await handleAllocatedToVault(addresses.seniorPool, log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of generalAllocatedLogs) {
    if (!log.args || !log.transactionHash) continue;
    await handleAllocatedToVault(addresses.generalPool, log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of milestoneSumittedLogs) {
    if (!log.args || !log.transactionHash) continue;
    await handleMilestoneSubmitted(log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }
  for (const log of milestoneApprovedLogs) {
    if (!log.args || !log.transactionHash) continue;
    await handleMilestoneApproved(log.args as Record<string, unknown>, log.transactionHash, log.blockNumber, log.logIndex);
  }

  // Advance lastBlock
  await prisma.indexerState.update({
    where: { id: 'singleton' },
    data: { lastBlock: toBlock },
  });

  const processed = vaultCreatedLogs.length + investedLogs.length + repaymentLogs.length +
    trancheReleasedLogs.length + stateChangedLogs.length + defaultedLogs.length +
    creditScoreLogs.length + seniorAllocatedLogs.length + generalAllocatedLogs.length +
    milestoneSumittedLogs.length + milestoneApprovedLogs.length + waterfallLogs.length;

  if (processed > 0) {
    console.log(`[Indexer] Blocks ${fromBlock}-${toBlock}: ${processed} events processed`);
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getIndexerHealth() {
  const state = await prisma.indexerState.findUnique({ where: { id: 'singleton' } });
  const latestBlock = await publicClient.getBlockNumber();
  const lastBlock = state?.lastBlock ?? 0n;
  const lag = latestBlock - lastBlock;

  const eventCounts = await prisma.vaultEvent.groupBy({
    by: ['eventType'],
    _count: { id: true },
  });

  return {
    running: indexerInterval !== null,
    lastIndexedBlock: lastBlock.toString(),
    latestBlock: latestBlock.toString(),
    lagBlocks: lag.toString(),
    lagSeconds: (Number(lag) * 2).toString(), // ~2s per Base block
    synced: lag < 10n,
    eventCounts: Object.fromEntries(eventCounts.map((e) => [e.eventType, e._count.id])),
    updatedAt: state?.updatedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let indexerInterval: NodeJS.Timeout | null = null;

export function startEventIndexer(): void {
  console.log('[Indexer] Event indexer started');

  // Run immediately on start, then on interval
  runPollCycle().catch((err) => console.error('[Indexer] Initial poll error:', err));

  indexerInterval = setInterval(() => {
    runPollCycle().catch((err) => console.error('[Indexer] Poll error:', err));
  }, POLL_INTERVAL_MS);
}

export function stopEventIndexer(): void {
  if (indexerInterval) {
    clearInterval(indexerInterval);
    indexerInterval = null;
    console.log('[Indexer] Event indexer stopped');
  }
}
