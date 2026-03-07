#!/usr/bin/env tsx
/**
 * Krexa Demo Lifecycle Script
 *
 * Demonstrates the full lifecycle on Base Sepolia:
 *   1. Register agent
 *   2. Set credit score (tier A)
 *   3. Create vault
 *   4. Invest (fund to target)
 *   5. Release tranche
 *   6. Repay via PaymentRouter (oracle-signed)
 *   7. Read vault state
 *   8. Claim returns
 *
 * Uses viem directly — no DB, no service layer imports.
 *
 * Usage:
 *   ORACLE_PRIVATE_KEY=0x... BASE_RPC_URL=https://sepolia.base.org npx tsx src/scripts/demo-lifecycle.ts
 */

import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  toHex,
  erc20Abi,
  type Address,
  type Hex,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  AgentRegistryABI,
  VaultFactoryABI,
  MerchantVaultABI,
  PaymentRouterABI,
  ADDRESSES,
} from '../config/abis.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL = process.env.BASE_RPC_URL || 'https://sepolia.base.org';
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('Error: ORACLE_PRIVATE_KEY env var required');
  process.exit(1);
}

const addrs = ADDRESSES['base-sepolia'];
const USDC_DECIMALS = 6;

// Vault params
const TARGET_AMOUNT = parseUnits('100', USDC_DECIMALS);  // 100 USDC
const INTEREST_RATE_BPS = 1200n;  // 12%
const DURATION_SECONDS = 180n * 24n * 3600n;  // ~6 months
const NUM_TRANCHES = 2n;
const REPAYMENT_RATE_BPS = 3000;  // 30%
const MIN_PAYMENT_INTERVAL = 0n;  // no rate limit for demo
const MAX_SINGLE_PAYMENT = 0n;    // no cap
const LATE_FEE_BPS = 100;
const GRACE_PERIOD = 7n * 86400n;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const account = privateKeyToAccount(
  PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY as `0x${string}` : `0x${PRIVATE_KEY}` as `0x${string}`
);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step: string, msg: string) {
  console.log(`\n[${'='.repeat(3)} ${step} ${'='.repeat(3)}] ${msg}`);
}

async function waitTx(hash: Hex, label: string) {
  console.log(`  tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 60_000 });
  if (receipt.status === 'reverted') throw new Error(`${label} reverted`);
  console.log(`  confirmed in block ${receipt.blockNumber}`);
  return receipt;
}

function fmtUsdc(wei: bigint) {
  return `$${formatUnits(wei, USDC_DECIMALS)}`;
}

// ---------------------------------------------------------------------------
// Oracle signing (inline — matches SignatureLib.sol)
// ---------------------------------------------------------------------------

async function signPayment(payment: {
  from: Address; to: Address; amount: bigint;
  nonce: bigint; deadline: bigint; paymentId: Hex;
}): Promise<Hex> {
  const msgHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, uint256, uint256, uint256, bytes32'),
      [payment.from, payment.to, payment.amount, payment.nonce, payment.deadline, payment.paymentId],
    ),
  );
  return account.signMessage({ message: { raw: msgHash as `0x${string}` } });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const agentAddr = account.address;
  console.log('============================================================');
  console.log('  Krexa Full Lifecycle Demo — Base Sepolia');
  console.log('============================================================');
  console.log(`Agent/Admin: ${agentAddr}`);
  console.log(`RPC: ${RPC_URL}`);

  // -----------------------------------------------------------------------
  // Step 1: Register Agent
  // -----------------------------------------------------------------------
  log('1/8', 'Register Agent');
  try {
    const isReg = await publicClient.readContract({
      address: addrs.AgentRegistry as Address,
      abi: AgentRegistryABI,
      functionName: 'isRegistered',
      args: [agentAddr],
    });
    if (isReg) {
      console.log('  Already registered, skipping...');
    } else {
      const hash = await walletClient.writeContract({
        address: addrs.AgentRegistry as Address,
        abi: AgentRegistryABI,
        functionName: 'registerAgent',
        args: ['ipfs://demo-metadata'],
      });
      await waitTx(hash, 'registerAgent');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already registered') || msg.includes('AlreadyRegistered')) {
      console.log('  Already registered, skipping...');
    } else throw err;
  }

  // -----------------------------------------------------------------------
  // Step 2: Update Credit Score to 750 (Tier A)
  // -----------------------------------------------------------------------
  log('2/8', 'Update Credit Score to 750 (Tier A)');
  const hash2 = await walletClient.writeContract({
    address: addrs.AgentRegistry as Address,
    abi: AgentRegistryABI,
    functionName: 'updateCreditScore',
    args: [agentAddr, 750],
  });
  await waitTx(hash2, 'updateCreditScore');

  // -----------------------------------------------------------------------
  // Step 3: Create Vault
  // -----------------------------------------------------------------------
  log('3/8', `Create Vault (target: ${fmtUsdc(TARGET_AMOUNT)})`);
  const block = await publicClient.getBlock();
  const deadline = block.timestamp + 30n * 86400n; // 30 days from now

  const hash3 = await walletClient.writeContract({
    address: addrs.VaultFactory as Address,
    abi: VaultFactoryABI,
    functionName: 'createVault',
    args: [
      agentAddr,
      TARGET_AMOUNT,
      INTEREST_RATE_BPS,
      DURATION_SECONDS,
      NUM_TRANCHES,
      REPAYMENT_RATE_BPS,
      MIN_PAYMENT_INTERVAL,
      MAX_SINGLE_PAYMENT,
      LATE_FEE_BPS,
      GRACE_PERIOD,
      deadline,
    ],
  });
  const receipt3 = await waitTx(hash3, 'createVault');

  // Parse VaultCreated event to get vault address
  const vaultCreatedTopic = keccak256(toHex('VaultCreated(address,address,uint256,uint256,uint256)'));
  const vaultLog = receipt3.logs.find(l => l.topics[0] === vaultCreatedTopic);
  let vaultAddress: Address;
  if (vaultLog && vaultLog.topics[2]) {
    vaultAddress = `0x${vaultLog.topics[2].slice(26)}` as Address;
  } else {
    // Fallback: read from factory
    const allVaults = await publicClient.readContract({
      address: addrs.VaultFactory as Address,
      abi: VaultFactoryABI,
      functionName: 'getAllVaults',
    }) as Address[];
    vaultAddress = allVaults[allVaults.length - 1];
  }
  console.log(`  Vault: ${vaultAddress}`);

  // -----------------------------------------------------------------------
  // Step 4: Approve USDC + Invest to fully fund vault
  // -----------------------------------------------------------------------
  log('4/8', `Invest ${fmtUsdc(TARGET_AMOUNT)} to fully fund vault`);

  // Approve USDC for vault
  const approveHash = await walletClient.writeContract({
    address: addrs.USDC as Address,
    abi: erc20Abi,
    functionName: 'approve',
    args: [vaultAddress, TARGET_AMOUNT * 10n], // generous approval
  });
  await waitTx(approveHash, 'approve USDC for vault');

  // Invest
  const hash4 = await walletClient.writeContract({
    address: vaultAddress,
    abi: MerchantVaultABI,
    functionName: 'invest',
    args: [TARGET_AMOUNT],
  });
  await waitTx(hash4, 'invest');
  console.log('  Vault should now be active (fully funded)');

  // -----------------------------------------------------------------------
  // Step 5: Release first tranche
  // -----------------------------------------------------------------------
  log('5/8', 'Release Tranche');
  const hash5 = await walletClient.writeContract({
    address: vaultAddress,
    abi: MerchantVaultABI,
    functionName: 'releaseTranche',
  });
  await waitTx(hash5, 'releaseTranche');

  // -----------------------------------------------------------------------
  // Step 6: Make repayment via PaymentRouter
  // -----------------------------------------------------------------------
  log('6/8', 'Repay via PaymentRouter (oracle-signed)');

  // Calculate gross amount for repayment of 30 USDC to vault
  const repayToVault = parseUnits('30', USDC_DECIMALS);
  const grossAmount = (repayToVault * 10000n + BigInt(REPAYMENT_RATE_BPS) - 1n) / BigInt(REPAYMENT_RATE_BPS);
  console.log(`  Repayment to vault: ${fmtUsdc(repayToVault)}`);
  console.log(`  Gross USDC needed: ${fmtUsdc(grossAmount)}`);
  console.log(`  Returned to agent: ${fmtUsdc(grossAmount - repayToVault)}`);

  // Approve PaymentRouter for USDC
  const approveRouterHash = await walletClient.writeContract({
    address: addrs.USDC as Address,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addrs.PaymentRouter as Address, grossAmount * 2n],
  });
  await waitTx(approveRouterHash, 'approve USDC for PaymentRouter');

  // Build and sign payment
  const currentBlock = await publicClient.getBlock();
  const nonce = 1n;
  const paymentDeadline = currentBlock.timestamp + 300n;
  const paymentId = keccak256(toHex(`demo-${agentAddr}-${Date.now()}`));

  const signature = await signPayment({
    from: agentAddr,
    to: agentAddr,
    amount: grossAmount,
    nonce,
    deadline: paymentDeadline,
    paymentId,
  });

  const paymentTuple = {
    from: agentAddr,
    to: agentAddr,
    amount: grossAmount,
    nonce,
    deadline: paymentDeadline,
    paymentId,
  };

  // Simulate first
  await publicClient.simulateContract({
    address: addrs.PaymentRouter as Address,
    abi: PaymentRouterABI,
    functionName: 'executePayment',
    args: [paymentTuple, signature],
    account,
  });

  const hash6 = await walletClient.writeContract({
    address: addrs.PaymentRouter as Address,
    abi: PaymentRouterABI,
    functionName: 'executePayment',
    args: [paymentTuple, signature],
  });
  await waitTx(hash6, 'executePayment');

  // -----------------------------------------------------------------------
  // Step 7: Read vault state
  // -----------------------------------------------------------------------
  log('7/8', 'Read final vault state');

  const [totalRepaid, totalToRepay, tranchesReleased] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: MerchantVaultABI,
      functionName: 'totalRepaid',
    }) as Promise<bigint>,
    publicClient.readContract({
      address: vaultAddress,
      abi: MerchantVaultABI,
      functionName: 'totalToRepay',
    }) as Promise<bigint>,
    publicClient.readContract({
      address: vaultAddress,
      abi: MerchantVaultABI,
      functionName: 'tranchesReleased',
    }) as Promise<bigint>,
  ]);

  console.log(`  Total Repaid:     ${fmtUsdc(totalRepaid)}`);
  console.log(`  Total To Repay:   ${fmtUsdc(totalToRepay)}`);
  console.log(`  Tranches Released: ${tranchesReleased}`);

  // -----------------------------------------------------------------------
  // Step 8: Claim returns (as investor)
  // -----------------------------------------------------------------------
  log('8/8', 'Claim returns');

  const claimable = await publicClient.readContract({
    address: vaultAddress,
    abi: MerchantVaultABI,
    functionName: 'getClaimable',
    args: [agentAddr],
  }) as bigint;

  if (claimable > 0n) {
    console.log(`  Claimable: ${fmtUsdc(claimable)}`);
    const hash8 = await walletClient.writeContract({
      address: vaultAddress,
      abi: MerchantVaultABI,
      functionName: 'claimReturns',
    });
    await waitTx(hash8, 'claimReturns');
    console.log('  Returns claimed!');
  } else {
    console.log('  No claimable returns yet');
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n============================================================');
  console.log('  DEMO COMPLETE');
  console.log('============================================================');
  console.log(`  Agent:       ${agentAddr}`);
  console.log(`  Vault:       ${vaultAddress}`);
  console.log(`  Invested:    ${fmtUsdc(TARGET_AMOUNT)}`);
  console.log(`  Repaid:      ${fmtUsdc(totalRepaid)}`);
  console.log(`  Outstanding: ${fmtUsdc(totalToRepay - totalRepaid)}`);
  console.log(`  Basescan:    https://sepolia.basescan.org/address/${vaultAddress}`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('\nDemo failed:', err);
  process.exit(1);
});
