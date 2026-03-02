import { PrismaClient } from '@prisma/client';
import type { Address, Hex } from 'viem';
import { keccak256, encodeAbiParameters, parseAbiParameters, toHex } from 'viem';
import { publicClient, walletClient, oracleAccount } from '../chain/client.js';
import { PaymentRouterABI, addresses } from '../config/contracts.js';
import { getSettlement, isNonceUsed } from '../chain/paymentRouter.js';
import { AppError } from '../api/middleware/errorHandler.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface X402PaymentParams {
  from: Address;
  to: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  paymentId: Hex;
}

export interface WebhookPaymentRequest {
  from: Address;
  to: Address;
  amount: string; // numeric string for BigInt safety
  paymentId?: string;
}

export interface OraclePaymentResult {
  id: string;
  status: 'confirmed' | 'submitted' | 'failed';
  txHash: string | null;
  nonce: string;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function ensureOracleReady() {
  if (!oracleAccount || !walletClient) {
    throw new AppError(503, 'Oracle service not configured: ORACLE_PRIVATE_KEY missing');
  }
}

// ---------------------------------------------------------------------------
// Nonce Management
// ---------------------------------------------------------------------------

export async function getNextNonce(from: Address): Promise<bigint> {
  // Find highest nonce we've used for this sender (excluding permanent failures)
  const lastPayment = await prisma.oraclePayment.findFirst({
    where: { from: from.toLowerCase(), status: { notIn: ['failed', 'expired'] } },
    orderBy: { nonce: 'desc' },
  });

  let candidate = lastPayment ? lastPayment.nonce + 1n : 1n;

  // Verify on-chain — skip nonces already consumed externally
  while (await isNonceUsed(from, candidate)) {
    candidate += 1n;
    if (candidate > 10000n) {
      throw new AppError(500, `Nonce scan exceeded limit for sender ${from}`);
    }
  }

  return candidate;
}

// ---------------------------------------------------------------------------
// ECDSA Signing (matches SignatureLib.sol exactly)
// ---------------------------------------------------------------------------

export async function signPaymentHash(payment: X402PaymentParams): Promise<Hex> {
  ensureOracleReady();

  // Step 1: keccak256(abi.encode(from, to, amount, nonce, deadline, paymentId))
  const msgHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, uint256, uint256, uint256, bytes32'),
      [payment.from, payment.to, payment.amount, payment.nonce, payment.deadline, payment.paymentId],
    ),
  );

  // Step 2: signMessage with raw hash — viem applies EIP-191 prefix internally
  // This matches SignatureLib.verifyPaymentProof which calls toEthSignedMessageHash()
  const signature = await oracleAccount!.signMessage({
    message: { raw: msgHash as `0x${string}` },
  });

  return signature;
}

// ---------------------------------------------------------------------------
// Sign + Submit Transaction
// ---------------------------------------------------------------------------

async function signAndSubmit(
  recordId: string,
  payment: X402PaymentParams,
): Promise<OraclePaymentResult> {
  ensureOracleReady();

  const signature = await signPaymentHash(payment);

  // Mark submitted + increment attempts
  await prisma.oraclePayment.update({
    where: { id: recordId },
    data: { status: 'submitted', attempts: { increment: 1 } },
  });

  const paymentTuple = {
    from: payment.from,
    to: payment.to,
    amount: payment.amount,
    nonce: payment.nonce,
    deadline: payment.deadline,
    paymentId: payment.paymentId,
  };

  // Simulate first — catch reverts before spending gas
  await publicClient.simulateContract({
    address: addresses.paymentRouter,
    abi: PaymentRouterABI,
    functionName: 'executePayment',
    args: [paymentTuple, signature],
    account: oracleAccount!,
  });

  // Submit the transaction
  const txHash = await walletClient!.writeContract({
    address: addresses.paymentRouter,
    abi: PaymentRouterABI,
    functionName: 'executePayment',
    args: [paymentTuple, signature],
  });

  // Wait for 3 block confirmations
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 3,
    timeout: 60_000,
  });

  if (receipt.status === 'reverted') {
    await prisma.oraclePayment.update({
      where: { id: recordId },
      data: { status: 'failed', error: 'Transaction reverted on-chain', txHash },
    });
    return { id: recordId, status: 'failed', txHash, nonce: payment.nonce.toString(), error: 'Transaction reverted on-chain' };
  }

  // Confirmed
  await prisma.oraclePayment.update({
    where: { id: recordId },
    data: { status: 'confirmed', txHash, processedAt: new Date() },
  });

  return { id: recordId, status: 'confirmed', txHash, nonce: payment.nonce.toString(), error: null };
}

// ---------------------------------------------------------------------------
// Main Entry: Process Payment Webhook
// ---------------------------------------------------------------------------

export async function processPayment(params: WebhookPaymentRequest): Promise<OraclePaymentResult> {
  ensureOracleReady();

  const amount = BigInt(params.amount);
  if (amount <= 0n) throw new AppError(400, 'Amount must be positive');

  // 1. Validate settlement on-chain
  const settlement = await getSettlement(params.to);
  if (!settlement.active) {
    throw new AppError(400, `No active settlement for agent ${params.to}`);
  }

  // 2. Check max payment cap
  if (settlement.maxSinglePayment > 0n && amount > settlement.maxSinglePayment) {
    throw new AppError(400, `Amount exceeds max single payment of ${settlement.maxSinglePayment}`);
  }

  // 3. Check rate limit
  if (settlement.minPaymentInterval > 0n) {
    const block = await publicClient.getBlock();
    const nextAllowed = settlement.lastPaymentAt + BigInt(settlement.minPaymentInterval);
    if (block.timestamp < nextAllowed) {
      throw new AppError(429, `Rate limited: next payment allowed at timestamp ${nextAllowed}`);
    }
  }

  // 4. Get next nonce for this sender
  const nonce = await getNextNonce(params.from);

  // 5. Build deadline (5 minutes from current block)
  const block = await publicClient.getBlock();
  const deadline = block.timestamp + 300n;

  // 6. Generate paymentId if not provided
  const paymentId = (params.paymentId
    ? params.paymentId as Hex
    : keccak256(toHex(`${params.from}-${params.to}-${amount}-${nonce}-${Date.now()}`))
  );

  // 7. Create DB record (reserve nonce)
  const record = await prisma.oraclePayment.create({
    data: {
      from: params.from.toLowerCase(),
      to: params.to.toLowerCase(),
      vault: settlement.vault.toLowerCase(),
      amount,
      nonce,
      deadline,
      paymentId,
      status: 'pending',
      attempts: 0,
    },
  });

  // 8. Sign + submit
  try {
    return await signAndSubmit(record.id, {
      from: params.from,
      to: params.to,
      amount,
      nonce,
      deadline,
      paymentId,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await markFailed(record.id, errMsg);
    scheduleRetry(record.id);
    throw new AppError(502, `Payment submission failed: ${errMsg}`);
  }
}

// ---------------------------------------------------------------------------
// Retry Queue
// ---------------------------------------------------------------------------

const RETRY_DELAYS = [30_000, 60_000, 120_000, 240_000, 480_000]; // ms
const MAX_ATTEMPTS = 5;
const retryTimers = new Map<string, NodeJS.Timeout>();

async function markFailed(recordId: string, error: string): Promise<void> {
  const record = await prisma.oraclePayment.findUnique({ where: { id: recordId } });
  if (!record) return;

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.oraclePayment.update({
      where: { id: recordId },
      data: { status: 'failed', error, processedAt: new Date() },
    });
    console.error(`[Oracle] Payment ${recordId} permanently failed after ${record.attempts} attempts: ${error}`);
    await checkConsecutiveFailures(record.vault);
    return;
  }

  const delayIndex = Math.min(record.attempts, RETRY_DELAYS.length - 1);
  const nextRetryAt = new Date(Date.now() + RETRY_DELAYS[delayIndex]);

  await prisma.oraclePayment.update({
    where: { id: recordId },
    data: { status: 'pending', error, nextRetryAt },
  });
}

function scheduleRetry(recordId: string): void {
  const existing = retryTimers.get(recordId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    retryTimers.delete(recordId);
    try {
      const record = await prisma.oraclePayment.findUnique({ where: { id: recordId } });
      if (!record || record.status !== 'pending') return;

      // Check if deadline has passed
      const block = await publicClient.getBlock();
      if (block.timestamp > record.deadline) {
        await prisma.oraclePayment.update({
          where: { id: recordId },
          data: { status: 'expired', error: 'Deadline passed before confirmation' },
        });
        return;
      }

      await signAndSubmit(recordId, {
        from: record.from as Address,
        to: record.to as Address,
        amount: record.amount,
        nonce: record.nonce,
        deadline: record.deadline,
        paymentId: record.paymentId as Hex,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await markFailed(recordId, errMsg);
      // If still under max attempts, schedule another retry
      const record = await prisma.oraclePayment.findUnique({ where: { id: recordId } });
      if (record && record.status === 'pending' && record.attempts < MAX_ATTEMPTS) {
        scheduleRetry(recordId);
      }
    }
  }, RETRY_DELAYS[0]);

  retryTimers.set(recordId, timer);
}

// ---------------------------------------------------------------------------
// Consecutive Failure Alert
// ---------------------------------------------------------------------------

async function checkConsecutiveFailures(vault: string): Promise<void> {
  const recent = await prisma.oraclePayment.findMany({
    where: { vault },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  const allFailed = recent.length >= 3 && recent.every((p) => p.status === 'failed');
  if (allFailed) {
    console.error(`[ALERT] 3+ consecutive payment failures for vault ${vault}`);
  }
}

// ---------------------------------------------------------------------------
// Background Retry Processor (catches orphaned retries after restart)
// ---------------------------------------------------------------------------

let retryInterval: NodeJS.Timeout | null = null;

export function startRetryProcessor(): void {
  if (!oracleAccount) {
    console.log('[Oracle] Retry processor not started: oracle not configured');
    return;
  }

  console.log(`[Oracle] Retry processor started (address: ${oracleAccount.address})`);

  retryInterval = setInterval(async () => {
    try {
      const stale = await prisma.oraclePayment.findMany({
        where: {
          status: 'pending',
          attempts: { gt: 0 },
          nextRetryAt: { lte: new Date() },
        },
        take: 5,
      });

      for (const payment of stale) {
        try {
          const block = await publicClient.getBlock();
          if (block.timestamp > payment.deadline) {
            await prisma.oraclePayment.update({
              where: { id: payment.id },
              data: { status: 'expired', error: 'Deadline passed before confirmation' },
            });
            continue;
          }

          await signAndSubmit(payment.id, {
            from: payment.from as Address,
            to: payment.to as Address,
            amount: payment.amount,
            nonce: payment.nonce,
            deadline: payment.deadline,
            paymentId: payment.paymentId as Hex,
          });
        } catch (err) {
          await markFailed(payment.id, err instanceof Error ? err.message : String(err));
        }
      }
    } catch (err) {
      console.error('[Oracle] Retry processor error:', err);
    }
  }, 15_000);
}

export function stopRetryProcessor(): void {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
  for (const timer of retryTimers.values()) {
    clearTimeout(timer);
  }
  retryTimers.clear();
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getOracleHealth() {
  const [pending, submitted, failed, total] = await Promise.all([
    prisma.oraclePayment.count({ where: { status: 'pending' } }),
    prisma.oraclePayment.count({ where: { status: 'submitted' } }),
    prisma.oraclePayment.count({ where: { status: 'failed' } }),
    prisma.oraclePayment.count(),
  ]);

  const recentPayments = await prisma.oraclePayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Last payment per vault
  const vaultEntries = await prisma.oraclePayment.findMany({
    distinct: ['vault'],
    orderBy: { createdAt: 'desc' },
    select: { vault: true, createdAt: true, status: true, txHash: true },
  });

  const lastPaymentPerVault: Record<string, { lastPaymentAt: string; status: string; txHash: string | null }> = {};
  for (const v of vaultEntries) {
    lastPaymentPerVault[v.vault] = {
      lastPaymentAt: v.createdAt.toISOString(),
      status: v.status,
      txHash: v.txHash,
    };
  }

  // Consecutive failures per vault
  const consecutiveFailures: Record<string, number> = {};
  for (const v of vaultEntries) {
    const recent = await prisma.oraclePayment.findMany({
      where: { vault: v.vault },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    let count = 0;
    for (const p of recent) {
      if (p.status === 'failed') count++;
      else break;
    }
    if (count > 0) consecutiveFailures[v.vault] = count;
  }

  const oracleConfigured = !!oracleAccount;
  const queueDepth = pending + submitted;
  const status = !oracleConfigured
    ? 'down'
    : queueDepth > 10 || Object.values(consecutiveFailures).some((c) => c >= 3)
      ? 'degraded'
      : 'ok';

  return {
    status,
    oracleAddress: oracleAccount?.address ?? null,
    oracleConfigured,
    queue: { pending, submitted, failed, total },
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      vault: p.vault,
      from: p.from,
      to: p.to,
      amount: p.amount.toString(),
      nonce: p.nonce.toString(),
      status: p.status,
      txHash: p.txHash,
      createdAt: p.createdAt.toISOString(),
    })),
    lastPaymentPerVault,
    consecutiveFailures,
  };
}
