/**
 * Krexa Demo — Pre-Flight Check
 *
 * Run this 30 minutes before your presentation.
 * Verifies every dependency is live before you touch run-demo.ts.
 *
 * Usage:  npx tsx demo/setup-demo.ts
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { WebSocket } from 'ws';
import chalk from 'chalk';

// ---------------------------------------------------------------------------
// Config helpers (mirrors run-demo.ts)
// ---------------------------------------------------------------------------

function optEnv(key: string): string | undefined {
  return process.env[key];
}

function env(key: string): string {
  const v = optEnv(key);
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))),
  );
}

const RPC_URL   = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const USDC_MINT = new PublicKey(env('SOLANA_USDC_MINT'));

const PROGRAM_IDS = {
  agentRegistry:  new PublicKey(env('REGISTRY_PROGRAM_ID')),
  creditVault:    new PublicKey(env('VAULT_PROGRAM_ID')),
  agentWallet:    new PublicKey(env('WALLET_PROGRAM_ID')),
  venueWhitelist: new PublicKey(env('VENUE_PROGRAM_ID')),
  paymentRouter:  new PublicKey(env('ROUTER_PROGRAM_ID')),
};

const agent = loadKeypair(env('AGENT_KEYPAIR_PATH'));
const owner = loadKeypair(env('OWNER_KEYPAIR_PATH'));

const connection = new Connection(RPC_URL, 'confirmed');

// ---------------------------------------------------------------------------
// PDA helpers
// ---------------------------------------------------------------------------

function findPda(seeds: (Buffer | Uint8Array)[], programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

const pdas = {
  registryConfig: () => findPda([Buffer.from('registry_config')],  PROGRAM_IDS.agentRegistry),
  agentProfile:   (a: PublicKey) => findPda([Buffer.from('agent_profile'), a.toBuffer()], PROGRAM_IDS.agentRegistry),
  vaultConfig:    () => findPda([Buffer.from('vault_config')],      PROGRAM_IDS.creditVault),
  vaultUsdc:      () => findPda([Buffer.from('vault_usdc')],         PROGRAM_IDS.creditVault),
  walletConfig:   () => findPda([Buffer.from('wallet_config')],      PROGRAM_IDS.agentWallet),
  routerConfig:   () => findPda([Buffer.from('router_config')],      PROGRAM_IDS.paymentRouter),
  whitelistConfig:() => findPda([Buffer.from('whitelist_config')],   PROGRAM_IDS.venueWhitelist),
  // venue entry PDA: seeds ["venue", program_id_bytes]
  venueEntry:     (progId: PublicKey) => findPda([Buffer.from('venue'), progId.toBuffer()], PROGRAM_IDS.venueWhitelist),
};

// ---------------------------------------------------------------------------
// Discriminator helper
// ---------------------------------------------------------------------------

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function pass(label: string, detail: string): CheckResult {
  const r = { label, ok: true, detail };
  results.push(r);
  return r;
}

function fail(label: string, detail: string): CheckResult {
  const r = { label, ok: false, detail };
  results.push(r);
  return r;
}

function icon(ok: boolean): string {
  return ok ? chalk.green('✅') : chalk.red('❌');
}

function printResult(r: CheckResult): void {
  const status = icon(r.ok);
  const label  = r.ok ? chalk.white(r.label) : chalk.red(r.label);
  console.log(`  ${status} ${label}: ${chalk.dim(r.detail)}`);
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/** Verify a program account exists and is executable. */
async function checkProgram(name: string, id: PublicKey): Promise<CheckResult> {
  try {
    const info = await connection.getAccountInfo(id);
    if (!info) return fail(name, `not found — ${id.toBase58()}`);
    if (!info.executable) return fail(name, `account exists but is NOT executable`);
    return pass(name, id.toBase58());
  } catch (e) {
    return fail(name, `RPC error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Verify a config PDA is initialized (account has data beyond the 8-byte discriminator). */
async function checkConfigPda(label: string, pda: PublicKey): Promise<CheckResult> {
  try {
    const info = await connection.getAccountInfo(pda);
    if (!info || info.data.length < 9) return fail(label, 'config PDA not initialized');
    return pass(label, `${pda.toBase58().slice(0, 12)}… — ${info.data.length} bytes`);
  } catch (e) {
    return fail(label, `RPC error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Get USDC balance of a token account. Returns null on failure. */
async function getUsdcBalance(ata: PublicKey): Promise<number | null> {
  try {
    const r = await connection.getTokenAccountBalance(ata);
    return Number(r.value.uiAmount ?? 0);
  } catch {
    return null;
  }
}

/** Check vault USDC liquidity. */
async function checkVaultLiquidity(): Promise<CheckResult> {
  try {
    const bal = await getUsdcBalance(pdas.vaultUsdc());
    if (bal === null) return fail('Vault liquidity', 'vault_usdc PDA not found — vault not initialized?');
    if (bal < 50) return fail('Vault liquidity', `only ${bal.toFixed(2)} USDC — need ≥ $50 for demo`);
    return pass('Total deposits', `${bal.toFixed(2)} USDC available`);
  } catch (e) {
    return fail('Vault liquidity', `${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Check owner's USDC ATA. */
async function checkOwnerUsdc(): Promise<CheckResult> {
  try {
    const ata = getAssociatedTokenAddressSync(USDC_MINT, owner.publicKey);
    const bal = await getUsdcBalance(ata);
    if (bal === null) return fail('Owner USDC', 'ATA not found — run airdrop or deposit');
    return pass(`Owner wallet: ${owner.publicKey.toBase58().slice(0, 8)}…`, `${bal.toFixed(2)} USDC`);
  } catch (e) {
    return fail('Owner USDC', `${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Check agent keypair is loadable and show its address. */
async function checkAgentKeypair(): Promise<CheckResult> {
  // Already loaded above; just check its SOL balance
  try {
    const lamports = await connection.getBalance(agent.publicKey);
    const sol = lamports / 1e9;
    if (sol < 0.05) {
      return fail(`Agent keypair: ${agent.publicKey.toBase58().slice(0, 8)}…`,
        `only ${sol.toFixed(4)} SOL — needs more for fees`);
    }
    return pass(`Agent keypair: ${agent.publicKey.toBase58().slice(0, 8)}…`,
      `ready — ${sol.toFixed(4)} SOL for fees`);
  } catch (e) {
    return fail('Agent keypair', `${e instanceof Error ? e.message : String(e)}`);
  }
}

/** HTTP health check on agent service. */
async function checkAgentService(): Promise<CheckResult> {
  const url = 'http://localhost:3001/health';
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return fail('Agent API', `HTTP ${resp.status} from ${url}`);
    const body = await resp.json() as { status?: string };
    if (body.status !== 'ok') return fail('Agent API', `unexpected status: ${JSON.stringify(body)}`);
    return pass('Agent API', `${url} — UP`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch')) {
      return fail('Agent API', 'not running — start with: npx tsx demo/agent-service/src/server.ts');
    }
    return fail('Agent API', msg);
  }
}

/** WebSocket connectivity check. */
async function checkWebSocket(): Promise<CheckResult> {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3002');
    const timer = setTimeout(() => {
      ws.terminate();
      resolve(fail('WebSocket', 'timeout — start run-demo.ts first to open ws://localhost:3002'));
    }, 3000);

    ws.on('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve(pass('WebSocket', 'ws://localhost:3002 — UP'));
    });

    ws.on('error', () => {
      clearTimeout(timer);
      resolve(fail('WebSocket', 'ws://localhost:3002 not reachable — run-demo.ts will start it'));
    });
  });
}

/** Check venue whitelist config PDA and count of registered venues. */
async function checkVenueWhitelist(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  // Check whitelist config PDA
  try {
    const info = await connection.getAccountInfo(pdas.whitelistConfig());
    if (!info || info.data.length < WhitelistConfig.LEN) {
      out.push(fail('Whitelist config', 'not initialized'));
      return out;
    }

    // Parse: disc(8) + admin(32) + total_venues(4) + is_paused(1) + bump(1)
    const totalVenues = info.data.readUInt32LE(8 + 32);
    const isPaused    = info.data[8 + 32 + 4] === 1;

    if (isPaused) {
      out.push(fail('Whitelist config', `PAUSED — ${totalVenues} venues registered`));
    } else {
      out.push(pass('Whitelist config', `active — ${totalVenues} venue(s) registered`));
    }
  } catch (e) {
    out.push(fail('Whitelist config', `${e instanceof Error ? e.message : String(e)}`));
    return out;
  }

  // Check that the payment router program is whitelisted (category 2 = x402)
  try {
    const venuePda = pdas.venueEntry(PROGRAM_IDS.paymentRouter);
    const info = await connection.getAccountInfo(venuePda);
    if (!info || info.data.length < WhitelistedVenue.LEN) {
      out.push(fail('x402 facilitator', 'PaymentRouter not in whitelist — add via whitelist admin'));
    } else {
      // Parse: disc(8) + program_id(32) + name(32) + category(1) + is_active(1)
      const isActive = info.data[8 + 32 + 32 + 1] === 1;
      if (!isActive) {
        out.push(fail('x402 facilitator', 'PaymentRouter whitelisted but INACTIVE'));
      } else {
        out.push(pass('x402 facilitator', 'whitelisted'));
      }
    }
  } catch (e) {
    out.push(fail('x402 facilitator', `${e instanceof Error ? e.message : String(e)}`));
  }

  return out;
}

// Byte-length constants mirroring Rust impl
const WhitelistConfig = { LEN: 8 + 32 + 4 + 1 + 1 };
const WhitelistedVenue = { LEN: 8 + 32 + 32 + 1 + 1 + 8 + 1 };

/** Simulate register_agent without broadcasting. */
async function dryRunRegister(): Promise<CheckResult> {
  try {
    // Build the instruction (same as run-demo.ts)
    const data = Buffer.concat([
      disc('register_agent'),
      encodeString32('krexa-research-agent'),
    ]);

    const ix = new TransactionInstruction({
      programId: PROGRAM_IDS.agentRegistry,
      keys: [
        { pubkey: pdas.registryConfig(), isSigner: false, isWritable: true  },
        { pubkey: pdas.agentProfile(agent.publicKey), isSigner: false, isWritable: true },
        { pubkey: agent.publicKey,        isSigner: true,  isWritable: false },
        { pubkey: owner.publicKey,        isSigner: true,  isWritable: true  },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: owner.publicKey });
    tx.add(ix);
    // Sign so simulation can compute fees
    tx.partialSign(agent, owner);

    const sim = await connection.simulateTransaction(tx, undefined, true);

    if (sim.value.err) {
      // "already in use" means agent already registered — that's fine for a dry run
      const errStr = JSON.stringify(sim.value.err);
      if (errStr.includes('0x0') || errStr.includes('already')) {
        return pass('register_agent (dry-run)', 'agent already registered — good to go');
      }
      return fail('register_agent (dry-run)', `simulation error: ${errStr}`);
    }

    const units = sim.value.unitsConsumed ?? 0;
    return pass('register_agent (dry-run)', `simulation OK — ${units.toLocaleString()} CUs`);
  } catch (e) {
    return fail('register_agent (dry-run)', `${e instanceof Error ? e.message : String(e)}`);
  }
}

function encodeString32(s: string): Buffer {
  const b = Buffer.alloc(32, 0);
  Buffer.from(s, 'utf8').copy(b, 0, 0, 32);
  return b;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('  🔵 KREXA DEMO — PRE-FLIGHT CHECK'));
  console.log(chalk.dim(`  Network: ${RPC_URL}`));
  console.log();

  // ── Programs ──────────────────────────────────────────────────────────────
  console.log(chalk.bold.white('  Programs:'));
  const progChecks = await Promise.all([
    checkProgram('Agent Registry',  PROGRAM_IDS.agentRegistry),
    checkProgram('Credit Vault',    PROGRAM_IDS.creditVault),
    checkProgram('Agent Wallet',    PROGRAM_IDS.agentWallet),
    checkProgram('Venue Whitelist', PROGRAM_IDS.venueWhitelist),
    checkProgram('Payment Router',  PROGRAM_IDS.paymentRouter),
  ]);
  progChecks.forEach(printResult);
  console.log();

  // ── Config PDAs (are the programs initialized?) ───────────────────────────
  console.log(chalk.bold.white('  Config PDAs:'));
  const pdaChecks = await Promise.all([
    checkConfigPda('Registry config',  pdas.registryConfig()),
    checkConfigPda('Vault config',     pdas.vaultConfig()),
    checkConfigPda('Wallet config',    pdas.walletConfig()),
    checkConfigPda('Router config',    pdas.routerConfig()),
  ]);
  pdaChecks.forEach(printResult);
  console.log();

  // ── Vault liquidity ────────────────────────────────────────────────────────
  console.log(chalk.bold.white('  Vault:'));
  const vaultCheck = await checkVaultLiquidity();
  printResult(vaultCheck);
  // Also show available = total (they're the same PDA for this check)
  const vaultBal = await getUsdcBalance(pdas.vaultUsdc());
  if (vaultBal !== null) {
    const avail = pass('Available liquidity', `${vaultBal.toFixed(2)} USDC`);
    printResult(avail);
  }
  console.log();

  // ── Wallets ────────────────────────────────────────────────────────────────
  console.log(chalk.bold.white('  Wallets:'));
  const [ownerCheck, agentCheck] = await Promise.all([
    checkOwnerUsdc(),
    checkAgentKeypair(),
  ]);
  printResult(ownerCheck);
  printResult(agentCheck);
  console.log();

  // ── Services ──────────────────────────────────────────────────────────────
  console.log(chalk.bold.white('  Services:'));
  const [svcCheck, wsCheck] = await Promise.all([
    checkAgentService(),
    checkWebSocket(),
  ]);
  printResult(svcCheck);
  printResult(wsCheck);
  console.log();

  // ── Whitelist ─────────────────────────────────────────────────────────────
  console.log(chalk.bold.white('  Whitelist:'));
  const wlChecks = await checkVenueWhitelist();
  wlChecks.forEach(printResult);
  console.log();

  // ── Dry run ────────────────────────────────────────────────────────────────
  console.log(chalk.bold.white('  Dry Run:'));
  const dryRun = await dryRunRegister();
  printResult(dryRun);
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────
  const allChecks = [
    ...progChecks, ...pdaChecks, vaultCheck,
    ownerCheck, agentCheck,
    svcCheck, wsCheck,
    ...wlChecks,
    dryRun,
  ];

  const failed = allChecks.filter(r => !r.ok);
  const passed = allChecks.filter(r => r.ok);

  console.log(chalk.dim('  ' + '═'.repeat(50)));

  if (failed.length === 0) {
    console.log();
    console.log(chalk.bold.green('  ✅ ALL CHECKS PASSED — READY TO DEMO'));
    console.log();
    console.log(chalk.dim('  ' + '═'.repeat(50)));
    console.log();
    console.log(`  ${chalk.bold('Run:')}       npx tsx demo/run-demo.ts`);
    console.log(`  ${chalk.bold('Dashboard:')} http://localhost:5173/demo`);
    console.log();
  } else {
    console.log();
    console.log(chalk.bold.red(`  ❌ ${failed.length} CHECK(S) FAILED — fix before presenting`));
    console.log();
    console.log(chalk.dim('  ' + '═'.repeat(50)));
    console.log();
    console.log(chalk.bold.white('  Failed checks:'));
    failed.forEach(r => {
      console.log(chalk.red(`  ✗ ${r.label}`) + chalk.dim(` — ${r.detail}`));
    });
    console.log();
    console.log(chalk.dim(`  ${passed.length}/${allChecks.length} checks passed`));
    console.log();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error();
  console.error(chalk.bold.red('  Fatal:'), err instanceof Error ? err.message : err);
  console.error();
  console.error(chalk.dim('  Make sure your .env is populated. Copy from demo/.env.example'));
  console.error();
  process.exit(1);
});
