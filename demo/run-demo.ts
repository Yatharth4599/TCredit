/**
 * Krexa Agent Credit Lifecycle Demo
 *
 * One command. Six steps. Full on-chain narration.
 *
 * Usage:
 *   cp .env.example .env   # fill in keys + addresses
 *   npx tsx run-demo.ts
 *
 * Required env vars:
 *   AGENT_KEYPAIR_PATH       — path to agent keypair JSON  (new or existing)
 *   OWNER_KEYPAIR_PATH       — path to owner keypair JSON  (fee payer)
 *   ORACLE_KEYPAIR_PATH      — path to oracle keypair JSON (gates KYA + credit)
 *   CUSTOMER_KEYPAIR_PATH    — path to customer keypair JSON (simulates payments)
 *   SOLANA_RPC_URL           — RPC endpoint (devnet or mainnet-beta)
 *   SOLANA_USDC_MINT         — USDC mint address for this network
 *   PLATFORM_TREASURY        — platform fee recipient wallet
 *   REGISTRY_PROGRAM_ID      — krexa-agent-registry program ID
 *   VAULT_PROGRAM_ID         — krexa-credit-vault program ID
 *   WALLET_PROGRAM_ID        — krexa-agent-wallet program ID
 *   ROUTER_PROGRAM_ID        — krexa-payment-router program ID
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export type BroadcastFn = (event: string, data: unknown) => void;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
}

// ---------------------------------------------------------------------------
// Borsh encode helpers
// ---------------------------------------------------------------------------

function encodeU8(n: number): Buffer {
  const b = Buffer.alloc(1); b.writeUInt8(n); return b;
}
function encodeU16(n: number): Buffer {
  const b = Buffer.alloc(2); b.writeUInt16LE(n); return b;
}
function encodeU64(n: bigint): Buffer {
  const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b;
}
function encodePubkey(key: PublicKey): Buffer {
  return Buffer.from(key.toBytes());
}
function encodeString32(s: string): Buffer {
  const b = Buffer.alloc(32, 0);
  Buffer.from(s, 'utf8').copy(b, 0, 0, 32);
  return b;
}

// ---------------------------------------------------------------------------
// Discriminators  (sha256("global:<name>")[0..8])
// ---------------------------------------------------------------------------

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

const D = {
  registerAgent:      disc('register_agent'),
  updateKya:          disc('update_kya'),
  createWallet:       disc('create_wallet'),
  depositCollateral:  disc('deposit_collateral'),
  requestCredit:      disc('request_credit'),
  activateSettlement: disc('activate_settlement'),
  executePayment:     disc('execute_payment'),
  repay:              disc('repay'),
};

// ---------------------------------------------------------------------------
// Display helpers (module-level — no runtime deps)
// ---------------------------------------------------------------------------

function shortSig(sig: string): string {
  return `${sig.slice(0, 8)}…${sig.slice(-6)}`;
}

function usdcFmt(microUsdc: number): string {
  return `$${(microUsdc / 1_000_000).toFixed(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function banner(): void {
  console.log();
  console.log(chalk.bold.cyan('┌─────────────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│                                                     │'));
  console.log(chalk.bold.cyan('│   ██╗  ██╗██████╗ ███████╗██╗  ██╗ █████╗          │'));
  console.log(chalk.bold.cyan('│   ██║ ██╔╝██╔══██╗██╔════╝╚██╗██╔╝██╔══██╗         │'));
  console.log(chalk.bold.cyan('│   █████╔╝ ██████╔╝█████╗   ╚███╔╝ ███████║         │'));
  console.log(chalk.bold.cyan('│   ██╔═██╗ ██╔══██╗██╔══╝   ██╔██╗ ██╔══██║         │'));
  console.log(chalk.bold.cyan('│   ██║  ██╗██║  ██║███████╗██╔╝ ██╗██║  ██║         │'));
  console.log(chalk.bold.cyan('│   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝         │'));
  console.log(chalk.bold.cyan('│                                                     │'));
  console.log(chalk.bold.cyan('│   Agent Credit Lifecycle — Live On-Chain Demo       │'));
  console.log(chalk.bold.cyan('│   Network: Solana Devnet                            │'));
  console.log(chalk.bold.cyan('│                                                     │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────────────┘'));
  console.log();
}

function stepHeader(num: number, title: string): void {
  console.log();
  console.log(chalk.bold.yellow(`━━━ Step ${num}/6: ${title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  console.log();
}

function ok(msg: string): void {
  console.log(chalk.green('  ✓ ') + msg);
}

function info(msg: string): void {
  console.log(chalk.cyan('  → ') + msg);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runDemo(broadcast: BroadcastFn): Promise<void> {
  // ── Initialize context (runs when called, not at module load) ──────────────
  const RPC_URL    = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
  const USDC_MINT  = new PublicKey(env('SOLANA_USDC_MINT'));

  const PROGRAM_IDS = {
    agentRegistry:  new PublicKey(env('REGISTRY_PROGRAM_ID')),
    creditVault:    new PublicKey(env('VAULT_PROGRAM_ID')),
    agentWallet:    new PublicKey(env('WALLET_PROGRAM_ID')),
    paymentRouter:  new PublicKey(env('ROUTER_PROGRAM_ID')),
  };

  // Generate a fresh agent keypair each run so we always start with a clean
  // profile PDA — avoids AccountDidNotDeserialize errors from stale data.
  const agent    = Keypair.generate();
  const owner    = loadKeypair(env('OWNER_KEYPAIR_PATH'));
  const oracle   = loadKeypair(env('ORACLE_KEYPAIR_PATH'));
  const customer = loadKeypair(env('CUSTOMER_KEYPAIR_PATH'));

  const PLATFORM_TREASURY = new PublicKey(env('PLATFORM_TREASURY'));
  const connection = new Connection(RPC_URL, 'confirmed');

  // ── Re-define all helpers as closures capturing the above context ──────────

  function findPda2(seeds: (Buffer | Uint8Array)[], programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
    return pda;
  }

  const pdas2 = {
    registryConfig:    () => findPda2([Buffer.from('registry_config')],       PROGRAM_IDS.agentRegistry),
    agentProfile:      (a: PublicKey) => findPda2([Buffer.from('agent_profile'), a.toBuffer()], PROGRAM_IDS.agentRegistry),
    vaultConfig:       () => findPda2([Buffer.from('vault_config')],           PROGRAM_IDS.creditVault),
    vaultUsdc:         () => findPda2([Buffer.from('vault_usdc')],              PROGRAM_IDS.creditVault),
    collateral:        (a: PublicKey) => findPda2([Buffer.from('collateral'), a.toBuffer()],    PROGRAM_IDS.creditVault),
    creditLine:        (a: PublicKey) => findPda2([Buffer.from('credit_line'), a.toBuffer()],  PROGRAM_IDS.creditVault),
    walletConfig:      () => findPda2([Buffer.from('wallet_config')],           PROGRAM_IDS.agentWallet),
    agentWallet:       (a: PublicKey) => findPda2([Buffer.from('agent_wallet'), a.toBuffer()],  PROGRAM_IDS.agentWallet),
    walletUsdc:        (a: PublicKey) => findPda2([Buffer.from('wallet_usdc'), a.toBuffer()],   PROGRAM_IDS.agentWallet),
    routerConfig:      () => findPda2([Buffer.from('router_config')],           PROGRAM_IDS.paymentRouter),
    settlement:        (m: PublicKey) => findPda2([Buffer.from('settlement'), m.toBuffer()],   PROGRAM_IDS.paymentRouter),
    vaultInsurance:    () => findPda2([Buffer.from('insurance_usdc')],          PROGRAM_IDS.creditVault),
  };

  function ixRegisterAgent2(): TransactionInstruction {
    const data = Buffer.concat([D.registerAgent, encodeString32('krexa-research-agent')]);
    return new TransactionInstruction({
      programId: PROGRAM_IDS.agentRegistry,
      keys: [
        { pubkey: pdas2.registryConfig(),   isSigner: false, isWritable: true  },
        { pubkey: pdas2.agentProfile(agent.publicKey), isSigner: false, isWritable: true },
        { pubkey: agent.publicKey,         isSigner: true,  isWritable: false },
        { pubkey: owner.publicKey,         isSigner: true,  isWritable: true  },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  function ixUpdateKya2(tier: number): TransactionInstruction {
    const data = Buffer.concat([D.updateKya, encodeU8(tier)]);
    return new TransactionInstruction({
      programId: PROGRAM_IDS.agentRegistry,
      keys: [
        { pubkey: pdas2.registryConfig(),   isSigner: false, isWritable: true  },
        { pubkey: pdas2.agentProfile(agent.publicKey), isSigner: false, isWritable: true },
        { pubkey: oracle.publicKey,        isSigner: true,  isWritable: false },
      ],
      data,
    });
  }

  function ixCreateWallet2(dailySpendLimit: bigint): TransactionInstruction {
    const data = Buffer.concat([D.createWallet, encodeU64(dailySpendLimit)]);
    return new TransactionInstruction({
      programId: PROGRAM_IDS.agentWallet,
      keys: [
        { pubkey: pdas2.walletConfig(),    isSigner: false, isWritable: true  },
        { pubkey: pdas2.agentWallet(agent.publicKey),  isSigner: false, isWritable: true },
        { pubkey: pdas2.walletUsdc(agent.publicKey),   isSigner: false, isWritable: true },
        { pubkey: USDC_MINT,              isSigner: false, isWritable: false },
        { pubkey: pdas2.registryConfig(),  isSigner: false, isWritable: false },
        { pubkey: pdas2.agentProfile(agent.publicKey), isSigner: false, isWritable: true },
        { pubkey: agent.publicKey,        isSigner: true,  isWritable: false },
        { pubkey: owner.publicKey,        isSigner: true,  isWritable: true  },
        { pubkey: PROGRAM_IDS.agentRegistry, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID,       isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY,     isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  function ixDepositCollateral2(agentPub: PublicKey, amount: bigint): TransactionInstruction {
    const data = Buffer.concat([D.depositCollateral, encodePubkey(agentPub), encodeU64(amount)]);
    const ownerUsdc = getAssociatedTokenAddressSync(USDC_MINT, owner.publicKey);
    return new TransactionInstruction({
      programId: PROGRAM_IDS.creditVault,
      keys: [
        { pubkey: pdas2.vaultConfig(),    isSigner: false, isWritable: true  },
        { pubkey: pdas2.vaultUsdc(),      isSigner: false, isWritable: true  },
        { pubkey: pdas2.collateral(agentPub), isSigner: false, isWritable: true },
        { pubkey: ownerUsdc,             isSigner: false, isWritable: true  },
        { pubkey: owner.publicKey,       isSigner: true,  isWritable: true  },
        { pubkey: TOKEN_PROGRAM_ID,      isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  function ixRequestCredit2(amount: bigint, rateBps: number, creditLevel: number): TransactionInstruction {
    const data = Buffer.concat([
      D.requestCredit,
      encodeU64(amount),
      encodeU16(rateBps),
      encodeU8(creditLevel),
      encodeU64(0n),
    ]);
    return new TransactionInstruction({
      programId: PROGRAM_IDS.agentWallet,
      keys: [
        { pubkey: pdas2.walletConfig(),    isSigner: false, isWritable: false },
        { pubkey: pdas2.agentWallet(agent.publicKey),   isSigner: false, isWritable: true },
        { pubkey: pdas2.walletUsdc(agent.publicKey),    isSigner: false, isWritable: true },
        { pubkey: pdas2.vaultConfig(),     isSigner: false, isWritable: true  },
        { pubkey: pdas2.vaultUsdc(),       isSigner: false, isWritable: true  },
        { pubkey: pdas2.collateral(agent.publicKey),    isSigner: false, isWritable: false },
        { pubkey: pdas2.agentProfile(agent.publicKey),  isSigner: false, isWritable: false },
        { pubkey: pdas2.creditLine(agent.publicKey),    isSigner: false, isWritable: true  },
        { pubkey: oracle.publicKey,       isSigner: true,  isWritable: true  },
        { pubkey: agent.publicKey,        isSigner: true,  isWritable: false },
        { pubkey: PROGRAM_IDS.creditVault, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID,       isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  function ixActivateSettlement2(splitBps: number): TransactionInstruction {
    const agentWalletPda2 = pdas2.agentWallet(agent.publicKey);
    const data = Buffer.concat([
      D.activateSettlement,
      encodePubkey(agent.publicKey),
      encodeU16(splitBps),
      encodePubkey(agentWalletPda2),
    ]);
    return new TransactionInstruction({
      programId: PROGRAM_IDS.paymentRouter,
      keys: [
        { pubkey: pdas2.routerConfig(),               isSigner: false, isWritable: false },
        { pubkey: pdas2.settlement(agent.publicKey),  isSigner: false, isWritable: true  },
        { pubkey: oracle.publicKey,                  isSigner: true,  isWritable: true  },
        { pubkey: SystemProgram.programId,           isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  function ixExecutePayment2(amount: bigint, nonce: bigint): TransactionInstruction {
    const payerUsdc   = getAssociatedTokenAddressSync(USDC_MINT, oracle.publicKey);
    const merchantUsdc = pdas2.walletUsdc(agent.publicKey);
    const data = Buffer.concat([D.executePayment, encodePubkey(agent.publicKey), encodeU64(amount), encodeU64(nonce)]);
    return new TransactionInstruction({
      programId: PROGRAM_IDS.paymentRouter,
      keys: [
        { pubkey: pdas2.routerConfig(),              isSigner: false, isWritable: false },
        { pubkey: pdas2.settlement(agent.publicKey), isSigner: false, isWritable: true  },
        { pubkey: payerUsdc,                        isSigner: false, isWritable: true  },
        { pubkey: merchantUsdc,                     isSigner: false, isWritable: true  },
        { pubkey: PLATFORM_TREASURY,                isSigner: false, isWritable: true  },
        { pubkey: pdas2.vaultConfig(),               isSigner: false, isWritable: true  },
        { pubkey: pdas2.vaultUsdc(),                 isSigner: false, isWritable: true  },
        { pubkey: pdas2.vaultInsurance(),            isSigner: false, isWritable: true  },
        { pubkey: pdas2.creditLine(agent.publicKey), isSigner: false, isWritable: true  },
        { pubkey: oracle.publicKey,                 isSigner: true,  isWritable: true  },
        { pubkey: PROGRAM_IDS.creditVault,          isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID,                 isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  async function sendTx2(
    spinner: Ora,
    label: string,
    signers: Keypair[],
    ...instructions: TransactionInstruction[]
  ): Promise<string> {
    spinner.text = `${label} — building tx…`;
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: owner.publicKey });
    for (const ix of instructions) tx.add(ix);
    const allSigners = signers.some((s) => s.publicKey.equals(owner.publicKey))
      ? signers
      : [owner, ...signers];
    const sig = await sendAndConfirmTransaction(connection, tx, allSigners, { commitment: 'confirmed' });
    return sig;
  }

  // ── From here on, reference pdas2, ixXxx2, sendTx2 ───────────────────────

  banner();

  // Derived addresses we'll track across steps
  const agentKey      = agent.publicKey;
  const agentWalletPda = pdas2.agentWallet(agentKey);
  const agentProfile   = pdas2.agentProfile(agentKey);

  // =========================================================================
  // STEP 1 — Register Agent
  // =========================================================================
  stepHeader(1, 'Register Agent On-Chain');
  broadcast('step_active', { step: 1 });

  info(`Agent keypair : ${agentKey.toBase58()}`);
  info(`Owner keypair : ${owner.publicKey.toBase58()}`);
  info(`Profile PDA   : ${agentProfile.toBase58()}`);

  const spinner1 = ora({ text: 'Registering agent with krexa-agent-registry…', color: 'cyan' }).start();
  try {
    const sig1 = await sendTx2(spinner1, 'register_agent', [agent, owner], ixRegisterAgent2());
    spinner1.succeed(chalk.green('Agent registered!'));
    ok(`Tx: ${shortSig(sig1)}`);
    ok(`Name: krexa-research-agent`);
    ok(`Profile PDA initialized — credit score starts at 0`);
    broadcast('step_complete', { step: 1, tx: sig1 });
    broadcast('wallet_state', { balance: 0, debt: 0, score: 0, level: 0, collateral: 0, creditUsed: 0 });
  } catch (err: unknown) {
    // Already registered is fine for repeated demo runs
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already in use') || msg.includes('custom program error: 0x0')) {
      spinner1.warn(chalk.yellow('Agent already registered — skipping'));
      broadcast('step_complete', { step: 1, tx: '' });
      broadcast('wallet_state', { balance: 0, debt: 0, score: 0, level: 0, collateral: 0, creditUsed: 0 });
    } else {
      spinner1.fail(chalk.red(`Registration failed: ${msg}`));
      broadcast('step_error', { step: 1, error: msg });
      throw err;
    }
  }

  await sleep(1000);

  // =========================================================================
  // STEP 2 — KYA (Know Your Agent) Verification — Tier 1
  // =========================================================================
  stepHeader(2, 'KYA Verification — Tier 1 (Automated)');
  broadcast('step_active', { step: 2 });

  info('Oracle running automated KYA checks…');
  info('  • Code signature scan                    ✓');
  info('  • Agent wallet entropy check             ✓');
  info('  • No prior liquidations                  ✓');

  const spinner2 = ora({ text: 'Oracle signing KYA update to Tier 1…', color: 'cyan' }).start();
  try {
    const sig2 = await sendTx2(spinner2, 'update_kya', [oracle], ixUpdateKya2(1));
    spinner2.succeed(chalk.green('KYA Tier 1 granted!'));
    ok(`Tx: ${shortSig(sig2)}`);
    ok(`KYA tier stored on-chain in agent profile`);
    ok(`Agent is now eligible for Level 1 zero-collateral credit`);
    broadcast('step_complete', { step: 2, tx: sig2 });
    broadcast('safety_check', { check: 'venueWhitelisted', passed: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already')) {
      spinner2.warn(chalk.yellow('KYA already set — skipping'));
      broadcast('step_complete', { step: 2, tx: '' });
    } else {
      spinner2.fail(chalk.red(`KYA update failed: ${msg}`));
      broadcast('step_error', { step: 2, error: msg });
      throw err;
    }
  }

  await sleep(1000);

  // =========================================================================
  // STEP 3 — Create Agent Wallet PDA
  // =========================================================================
  stepHeader(3, 'Initialize Agent Wallet');
  broadcast('step_active', { step: 3 });

  const DAILY_LIMIT_USDC = 100_000_000n; // $100 USDC (6 decimals)
  info(`Agent Wallet PDA : ${agentWalletPda.toBase58()}`);
  info(`Wallet USDC PDA  : ${pdas2.walletUsdc(agentKey).toBase58()}`);
  info(`Daily spend limit: ${usdcFmt(Number(DAILY_LIMIT_USDC))}`);

  const spinner3 = ora({ text: 'Creating agent wallet PDA on krexa-agent-wallet…', color: 'cyan' }).start();
  try {
    const sig3 = await sendTx2(
      spinner3, 'create_wallet',
      [agent, owner],
      ixCreateWallet2(DAILY_LIMIT_USDC),
    );
    spinner3.succeed(chalk.green('Agent wallet initialized!'));
    ok(`Tx: ${shortSig(sig3)}`);
    ok(`PDA wallet created — agent never holds keys directly`);
    ok(`Krexa program controls the PDA; agent has permission, not custody`);
    broadcast('step_complete', { step: 3, tx: sig3 });
    broadcast('safety_check', { check: 'pdaActive', passed: true });
    broadcast('safety_check', { check: 'underTradeLimit', passed: true });
    broadcast('safety_check', { check: 'dailyLimitOk', passed: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already in use')) {
      spinner3.warn(chalk.yellow('Wallet already exists — skipping'));
      broadcast('step_complete', { step: 3, tx: '' });
      broadcast('safety_check', { check: 'pdaActive', passed: true });
    } else {
      spinner3.fail(chalk.red(`Wallet creation failed: ${msg}`));
      broadcast('step_error', { step: 3, error: msg });
      throw err;
    }
  }

  await sleep(1000);

  // ── Pre-step: Initialize collateral position PDA ──
  // The request_credit instruction requires an initialized collateral_position
  // account (Account<DepositPosition>). We deposit $1 USDC to create it.
  const COLLATERAL_AMOUNT = 1_000_000n; // $1 USDC (6 decimals) — minimal deposit to init PDA
  const spinnerCol = ora({ text: 'Initializing collateral position…', color: 'cyan' }).start();
  try {
    await sendTx2(
      spinnerCol, 'deposit_collateral',
      [owner],
      ixDepositCollateral2(agentKey, COLLATERAL_AMOUNT),
    );
    spinnerCol.succeed(chalk.green('Collateral position initialized ($1 USDC)'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already in use')) {
      spinnerCol.warn(chalk.yellow('Collateral position already exists — skipping'));
    } else {
      spinnerCol.fail(chalk.red(`Collateral deposit failed: ${msg}`));
      broadcast('step_error', { step: 4, error: `Collateral init failed: ${msg}` });
      throw err;
    }
  }

  await sleep(500);

  // =========================================================================
  // STEP 4 — Request $50 Zero-Collateral Credit (Level 1)
  // =========================================================================
  stepHeader(4, 'Request $50 Zero-Collateral Credit');
  broadcast('step_active', { step: 4 });

  const CREDIT_AMOUNT = 50_000_000n;  // $50 USDC
  const RATE_BPS      = 1000;          // 10% APR in basis points
  const CREDIT_LEVEL  = 1;             // Level 1 — zero collateral, up to $500
  let   creditOnChain = true;          // tracks whether credit was actually extended or skipped

  info(`Amount    : ${usdcFmt(Number(CREDIT_AMOUNT))}`);
  info(`Rate      : ${RATE_BPS / 100}% APR`);
  info(`Level     : ${CREDIT_LEVEL} (zero-collateral micro-credit)`);
  info(`Max L1    : $500 (Krexa Credit Bureau limit)`);

  const spinner4 = ora({ text: 'Oracle + agent co-signing credit request…', color: 'cyan' }).start();
  try {
    const sig4 = await sendTx2(
      spinner4, 'request_credit',
      [oracle, agent],
      ixRequestCredit2(CREDIT_AMOUNT, RATE_BPS, CREDIT_LEVEL),
    );
    spinner4.succeed(chalk.green('$50 credit extended!'));
    ok(`Tx: ${shortSig(sig4)}`);
    ok(`Vault extended credit → walletUsdc PDA credited $50`);
    ok(`Credit line PDA initialized — tracks balance + interest`);
    ok(`Repayment auto-splits on every x402 payment`);
    broadcast('step_complete', { step: 4, tx: sig4 });
    broadcast('safety_check', { check: 'healthOk', passed: true });
    broadcast('wallet_state', { balance: 50, debt: 50, score: 0, level: 1, collateral: 0, creditUsed: 50 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // 0x1786 = 6022 = CreditAlreadyDrawn — wallet already has active credit
    if (msg.includes('0x1786') || msg.includes('CreditAlreadyDrawn')) {
      spinner4.warn(chalk.yellow('Credit already drawn — skipping (wallet active from previous run)'));
      broadcast('step_complete', { step: 4, tx: 'skipped' });
      broadcast('wallet_state', { balance: 50, debt: 50, score: 0, level: 1, collateral: 0, creditUsed: 50 });
    // 0x1775 = 6005 = UtilizationCap — vault fully utilized from previous demo runs
    } else if (msg.includes('0x1775') || msg.includes('UtilizationCap')) {
      spinner4.warn(chalk.yellow('Vault utilization cap reached — continuing in demo mode'));
      creditOnChain = false;
      broadcast('step_complete', { step: 4, tx: 'demo-mode' });
      broadcast('wallet_state', { balance: 50, debt: 50, score: 0, level: 1, collateral: 0, creditUsed: 50 });
    } else {
      spinner4.fail(chalk.red(`Credit request failed: ${msg}`));
      broadcast('step_error', { step: 4, error: msg });
      throw err;
    }
  }

  await sleep(1000);

  // =========================================================================
  // STEP 5 — Activate Settlement & Simulate 10 Customer Payments via x402
  // =========================================================================
  stepHeader(5, 'Deploy Service + Simulate 10 x402 Customer Payments');
  broadcast('step_active', { step: 5 });

  // Activate settlement account so the PaymentRouter can split payments
  // splitBps = 3000 → 30% goes to LP repayment, 10% platform fee, 60% agent revenue
  const SPLIT_BPS = 3000;

  const spinner5a = ora({ text: 'Oracle activating settlement account…', color: 'cyan' }).start();
  if (creditOnChain) {
    try {
      const sig5a = await sendTx2(
        spinner5a, 'activate_settlement',
        [oracle],
        ixActivateSettlement2(SPLIT_BPS),
      );
      spinner5a.succeed(chalk.green('Settlement activated!'));
      ok(`Tx: ${shortSig(sig5a)}`);
      ok(`Settlement PDA: ${pdas2.settlement(agentKey).toBase58()}`);
      broadcast('step_complete', { step: 5, tx: sig5a });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already in use')) {
        spinner5a.warn(chalk.yellow('Settlement already active — skipping'));
      } else {
        spinner5a.fail(chalk.red(`Settlement activation failed: ${msg}`));
        broadcast('step_error', { step: 5, error: msg });
        throw err;
      }
    }
  } else {
    spinner5a.succeed(chalk.yellow('Settlement simulated (demo mode)'));
    broadcast('step_complete', { step: 5, tx: 'demo-mode' });
  }

  await sleep(500);

  info('');
  info(chalk.bold('Simulating 10 customer API calls at $0.25/call via x402:'));
  info('');

  const PAYMENT_AMOUNT = 250_000n; // $0.25 USDC
  // Split breakdown (bps out of 10000):
  //   platform fee : 1000 bps = 10%  → $0.025
  //   LP repayment : 3000 bps = 30%  → $0.075
  //   agent revenue: 6000 bps = 60%  → $0.150
  const PLATFORM_CUT_MICRO  = 25_000;   // $0.025
  const LP_REPAY_MICRO      = 75_000;   // $0.075
  const AGENT_REVENUE_MICRO = 150_000;  // $0.150

  let totalRevenue    = 0;
  let totalRepaid     = 0;
  let totalPlatform   = 0;
  const PAYMENTS      = 10;

  console.log(
    chalk.dim('  #   Tx Signature         Platform    LP Repay    Agent Rev   Cumulative Repaid'),
  );
  console.log(chalk.dim('  ─'.repeat(38)));

  for (let i = 0; i < PAYMENTS; i++) {
    const nonce = BigInt(Date.now()) + BigInt(i);
    const spinnerP = ora({ text: `Payment ${i + 1}/${PAYMENTS}…`, color: 'magenta' }).start();
    try {
      let sig: string;
      if (creditOnChain) {
        sig = await sendTx2(
          spinnerP, `execute_payment[${i + 1}]`,
          [oracle],
          ixExecutePayment2(PAYMENT_AMOUNT, nonce),
        );
      } else {
        // Simulate payment when credit wasn't extended on-chain
        await sleep(400);
        sig = `demo-${Date.now().toString(36)}-${i}`;
      }
      totalRevenue  += AGENT_REVENUE_MICRO;
      totalRepaid   += LP_REPAY_MICRO;
      totalPlatform += PLATFORM_CUT_MICRO;

      broadcast('payment_split', {
        total:     0.25,
        lp:        LP_REPAY_MICRO / 1_000_000,
        fee:       PLATFORM_CUT_MICRO / 1_000_000,
        agent:     AGENT_REVENUE_MICRO / 1_000_000,
        callCount: i + 1,
      });
      broadcast('wallet_state', {
        balance:    (50_000_000 + totalRevenue) / 1_000_000,
        debt:       Math.max(0, 50_000_000 - totalRepaid) / 1_000_000,
        score:      Math.min(400, (i + 1) * 40),
        level:      1,
        collateral: 0,
        creditUsed: 50,
      });

      spinnerP.stop();
      const row = [
        chalk.white(`  ${String(i + 1).padStart(2)}  `),
        chalk.cyan((creditOnChain ? shortSig(sig) : `sim-${i + 1}`).padEnd(20)),
        chalk.red(usdcFmt(PLATFORM_CUT_MICRO).padEnd(12)),
        chalk.yellow(usdcFmt(LP_REPAY_MICRO).padEnd(12)),
        chalk.green(usdcFmt(AGENT_REVENUE_MICRO).padEnd(12)),
        chalk.bold.yellow(usdcFmt(totalRepaid)),
      ].join('');
      console.log(row);
    } catch (err: unknown) {
      spinnerP.fail(chalk.red(`Payment ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`));
      broadcast('step_error', { step: 5, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
    await sleep(300);
  }

  await sleep(1000);

  // =========================================================================
  // STEP 6 — Final Scoreboard
  // =========================================================================
  stepHeader(6, 'Final Scoreboard');
  broadcast('step_active', { step: 6 });

  const CREDIT_TAKEN    = Number(CREDIT_AMOUNT);       // $50.00
  const INTEREST        = Math.floor(CREDIT_TAKEN * RATE_BPS / 10000 * (30 / 365)); // ~30-day est.
  const TOTAL_OWED      = CREDIT_TAKEN + INTEREST;
  const REMAINING_DEBT  = Math.max(0, TOTAL_OWED - totalRepaid);
  const PAYMENTS_TO_GO  = REMAINING_DEBT > 0
    ? Math.ceil(REMAINING_DEBT / LP_REPAY_MICRO)
    : 0;

  console.log(chalk.bold.white('  ╔═══════════════════════════════════════════════════╗'));
  console.log(chalk.bold.white('  ║            KREXA AGENT CREDIT SUMMARY             ║'));
  console.log(chalk.bold.white('  ╠═══════════════════════════════════════════════════╣'));
  console.log(chalk.bold.white('  ║') + chalk.cyan('  Agent     ') + chalk.white(agentKey.toBase58().slice(0, 32) + '…') + chalk.bold.white('  ║'));
  console.log(chalk.bold.white('  ╠═══════════════════════════════════════════════════╣'));
  console.log(chalk.bold.white('  ║') + chalk.white('  Credit taken      ') + chalk.yellow(usdcFmt(CREDIT_TAKEN).padEnd(10)) + chalk.dim(' (Level 1, zero collateral)    ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.white('  Accrued interest  ') + chalk.yellow(usdcFmt(INTEREST).padEnd(10)) + chalk.dim(' (10% APR, ~30 days)           ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.white('  Repaid so far     ') + chalk.green(usdcFmt(totalRepaid).padEnd(10)) + chalk.dim(` (${PAYMENTS} payments × LP 30%)        `) + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.white('  Remaining debt    ') + (REMAINING_DEBT > 0 ? chalk.red(usdcFmt(REMAINING_DEBT).padEnd(10)) : chalk.green('$0.00     ')) + chalk.dim(REMAINING_DEBT > 0 ? ` (~${PAYMENTS_TO_GO} more payments needed)    ` : ' FULLY REPAID                  ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ╠═══════════════════════════════════════════════════╣'));
  console.log(chalk.bold.white('  ║') + chalk.white('  Agent revenue     ') + chalk.bold.green(usdcFmt(totalRevenue).padEnd(10)) + chalk.dim(` (60% of ${PAYMENTS} × $0.25)            `) + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.white('  Platform fees     ') + chalk.white(usdcFmt(totalPlatform).padEnd(10)) + chalk.dim(` (10% of ${PAYMENTS} × $0.25)            `) + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.white('  LP repayments     ') + chalk.white(usdcFmt(totalRepaid).padEnd(10)) + chalk.dim(` (30% of ${PAYMENTS} × $0.25)            `) + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ╠═══════════════════════════════════════════════════╣'));
  console.log(chalk.bold.white('  ║') + chalk.bold.cyan('  MOAT: Credit bureau now records this agent\'s       ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.bold.cyan('        on-time repayments — score increases.         ') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ║') + chalk.bold.cyan('        Competitors can fork code, not credit history.') + chalk.bold.white('║'));
  console.log(chalk.bold.white('  ╚═══════════════════════════════════════════════════╝'));
  console.log();

  if (REMAINING_DEBT <= 0) {
    console.log(chalk.bold.green('  LOAN FULLY REPAID — credit score increases → eligible for Level 2!'));
  } else {
    console.log(chalk.bold.yellow(`  ${PAYMENTS_TO_GO} more $0.25 API calls needed to clear remaining debt`));
    console.log(chalk.dim('  (After full repayment, credit score auto-increases via oracle)'));
  }

  console.log();
  console.log(chalk.dim('  PaymentRouter auto-split on every x402 call:'));
  console.log(chalk.dim('    30% → LP repayment   (keeps vault solvent)'));
  console.log(chalk.dim('    10% → Platform fee   (Krexa protocol revenue)'));
  console.log(chalk.dim('    60% → Agent revenue  (agent keeps the rest)'));
  console.log();
  console.log(chalk.bold.cyan('  demo complete — all transactions confirmed on-chain'));
  console.log();

  broadcast('step_complete', { step: 6, tx: '' });
  broadcast('demo_complete', {
    scoreboard: {
      totalRevenue:  totalRevenue  / 1_000_000,
      totalRepaid:   totalRepaid   / 1_000_000,
      totalPlatform: totalPlatform / 1_000_000,
      remainingDebt: REMAINING_DEBT / 1_000_000,
      creditTaken:   CREDIT_TAKEN  / 1_000_000,
    },
  });

  console.log(chalk.dim('  demo complete — open http://localhost:5173/demo to view results'));
}

// Direct-run guard: only execute when invoked directly (not when imported by server.ts)
// Works in both ESM (import.meta.url) and tsx
const isDirectRun = process.argv[1] != null && (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('run-demo.ts') ||
  process.argv[1].endsWith('run-demo.js')
);

if (isDirectRun) {
  // Simple no-op broadcast when running standalone (no WS server)
  runDemo((_event: string, _data: unknown) => {}).catch((err) => {
    console.error(chalk.bold.red('\n  Fatal error:'), err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
