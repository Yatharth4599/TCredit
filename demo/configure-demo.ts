/**
 * configure-demo.ts
 *
 * One-time setup script. Run this once before your first demo (or to reset keys).
 *
 * What it does:
 *   1. Generates fresh agent / owner / customer keypairs → demo/keys/
 *   2. Funds all wallets with SOL (from your admin wallet at ~/.config/solana/id.json)
 *   3. Creates USDC ATAs and mints $100 USDC to owner + customer
 *   4. Calls deposit_collateral ($2 USDC) to create the collateral_position PDA
 *      that request_credit (Step 4 of run-demo.ts) requires
 *   5. Writes demo/.env with all correct devnet addresses
 *   6. Writes demo/agent-service/.env template
 *
 * Prerequisites:
 *   - solana-programs/scripts/init-devnet.ts has already been run
 *   - Admin wallet (~/.config/solana/id.json) has SOL + USDC on devnet
 *   - solana-programs/scripts/oracle-keypair.json exists
 *   - solana-programs/scripts/usdc-mint.json exists
 *
 * Usage:
 *   cd demo && npx tsx configure-demo.ts
 */

import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, mintTo,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DEMO_DIR    = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(DEMO_DIR, '../solana-programs/scripts');
const KEYS_DIR    = path.join(DEMO_DIR, 'keys');

// ---------------------------------------------------------------------------
// Devnet constants (from .env.devnet)
// ---------------------------------------------------------------------------

const RPC_URL = 'https://api.devnet.solana.com';

const USDC_MINT     = new PublicKey('H2SYsnzdRXrXpHpcDkedARksoxiQLGXjtAvkJg158ETP');
const TREASURY_ATA  = new PublicKey('5v86BdV1SS23TKdsp9tdVcm8sGj1UdhefxnJGTgJeWBi');

const PROGRAM_IDS = {
  agentRegistry: new PublicKey('ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG'),
  creditVault:   new PublicKey('26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N'),
  agentWallet:   new PublicKey('35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6'),
  venueWhitelist: new PublicKey('HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua'),
  paymentRouter:  new PublicKey('2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8'),
};

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string)    { process.stdout.write(`[configure] ${msg}\n`); }
function ok(msg: string)     { process.stdout.write(`[configure] ✓ ${msg}\n`); }
function warn(msg: string)   { process.stdout.write(`[configure] ⚠ ${msg}\n`); }
function fail(msg: string)   { process.stderr.write(`[configure] ✗ ${msg}\n`); }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function encodeU64(n: bigint): Buffer {
  const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b;
}

function findPda(seeds: (Buffer | Uint8Array)[], programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

function loadKeypair(filePath: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(filePath, 'utf-8'))),
  );
}

function saveKeypair(kp: Keypair, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// PDA helpers
// ---------------------------------------------------------------------------

const pdas = {
  vaultConfig:   () => findPda([Buffer.from('vault_config')],          PROGRAM_IDS.creditVault),
  vaultUsdc:          () => findPda([Buffer.from('vault_usdc')],                    PROGRAM_IDS.creditVault),
  depositPosition:    (d: PublicKey) => findPda([Buffer.from('deposit'), d.toBuffer()], PROGRAM_IDS.creditVault),
  collateral:         (a: PublicKey) => findPda([Buffer.from('collateral'), a.toBuffer()], PROGRAM_IDS.creditVault),
  agentWallet:        (a: PublicKey) => findPda([Buffer.from('agent_wallet'), a.toBuffer()], PROGRAM_IDS.agentWallet),
  whitelistConfig:    () => findPda([Buffer.from('whitelist_config')],              PROGRAM_IDS.venueWhitelist),
  whitelistedVenue:   (p: PublicKey) => findPda([Buffer.from('venue'), p.toBuffer()], PROGRAM_IDS.venueWhitelist),
};

// ---------------------------------------------------------------------------
// Instruction: deposit_collateral
//
// Context (from krexa-credit-vault/src/lib.rs DepositCollateral):
//   0. config          (mut)          — vault_config PDA
//   1. vault_token     (mut)          — vault_usdc PDA token account
//   2. collateral_position (mut)      — ["collateral", agent] PDA — init_if_needed
//   3. owner_usdc      (mut)          — owner's USDC ATA
//   4. owner           (mut, signer)
//   5. token_program
//   6. system_program
//
// Instruction data: disc("deposit_collateral") | agent: Pubkey | amount: u64
// ---------------------------------------------------------------------------

function ixDepositCollateral(
  agent: PublicKey,
  owner: PublicKey,
  ownerUsdc: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.concat([
    disc('deposit_collateral'),
    Buffer.from(agent.toBytes()),
    encodeU64(amount),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_IDS.creditVault,
    keys: [
      { pubkey: pdas.vaultConfig(),          isSigner: false, isWritable: true  },
      { pubkey: pdas.vaultUsdc(),            isSigner: false, isWritable: true  },
      { pubkey: pdas.collateral(agent),      isSigner: false, isWritable: true  },
      { pubkey: ownerUsdc,                   isSigner: false, isWritable: true  },
      { pubkey: owner,                       isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------------------
// Instruction: deposit_liquidity
//
// Context (from krexa-credit-vault/src/lib.rs DepositLiquidity):
//   0. config           (mut) — vault_config PDA
//   1. vault_token      (mut) — vault_usdc PDA token account
//   2. deposit_position (mut, init_if_needed) — ["deposit", depositor] PDA
//   3. depositor_usdc   (mut) — depositor's USDC ATA
//   4. depositor        (mut, signer)
//   5. token_program
//   6. system_program
//
// Instruction data: disc("deposit_liquidity") | amount: u64
// ---------------------------------------------------------------------------

function ixDepositLiquidity(
  depositor: PublicKey,
  depositorUsdc: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.concat([disc('deposit_liquidity'), encodeU64(amount)]);
  return new TransactionInstruction({
    programId: PROGRAM_IDS.creditVault,
    keys: [
      { pubkey: pdas.vaultConfig(),               isSigner: false, isWritable: true  },
      { pubkey: pdas.vaultUsdc(),                 isSigner: false, isWritable: true  },
      { pubkey: pdas.depositPosition(depositor),  isSigner: false, isWritable: true  },
      { pubkey: depositorUsdc,                    isSigner: false, isWritable: true  },
      { pubkey: depositor,                        isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,                 isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,          isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------------------
// Instruction: add_venue
//
// Context (from krexa-venue-whitelist/src/lib.rs AddVenue):
//   0. config  (mut) — whitelist_config PDA  (seeds: ["whitelist_config"])
//   1. venue   (init) — ["venue", program_id.as_ref()] PDA
//   2. admin   (mut, signer)
//   3. system_program
//
// Instruction data: disc("add_venue") | program_id: Pubkey | name: [u8;32] | category: u8
// ---------------------------------------------------------------------------

function ixAddVenue(
  venueProgramId: PublicKey,
  name: string,
  category: number,
  admin: PublicKey,
): TransactionInstruction {
  const nameBuf = Buffer.alloc(32, 0);
  Buffer.from(name, 'utf8').copy(nameBuf, 0, 0, 32);

  const data = Buffer.concat([
    disc('add_venue'),
    Buffer.from(venueProgramId.toBytes()),
    nameBuf,
    Buffer.from([category]),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_IDS.venueWhitelist,
    keys: [
      { pubkey: pdas.whitelistConfig(),                isSigner: false, isWritable: true  },
      { pubkey: pdas.whitelistedVenue(venueProgramId), isSigner: false, isWritable: true  },
      { pubkey: admin,                                 isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,               isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('══════════════════════════════════════════════');
  log('  Krexa Demo — One-time Setup');
  log('══════════════════════════════════════════════');

  // ── Load admin + oracle + USDC authority ──────────────────────────────────
  const adminPath = path.join(process.env.HOME!, '.config/solana/id.json');
  if (!fs.existsSync(adminPath)) {
    fail(`Admin keypair not found at ${adminPath}`);
    fail('Run: solana-keygen new --outfile ~/.config/solana/id.json');
    process.exit(1);
  }
  const admin = loadKeypair(adminPath);
  log(`Admin:      ${admin.publicKey.toBase58()}`);

  const oraclePath = path.join(SCRIPTS_DIR, 'oracle-keypair.json');
  if (!fs.existsSync(oraclePath)) {
    fail(`Oracle keypair not found at ${oraclePath}`);
    fail('Expected: solana-programs/scripts/oracle-keypair.json');
    process.exit(1);
  }
  const oracle = loadKeypair(oraclePath);
  log(`Oracle:     ${oracle.publicKey.toBase58()}`);

  const usdcMintPath = path.join(SCRIPTS_DIR, 'usdc-mint.json');
  if (!fs.existsSync(usdcMintPath)) {
    fail(`USDC mint json not found at ${usdcMintPath}`);
    fail('Expected: solana-programs/scripts/usdc-mint.json');
    process.exit(1);
  }
  const usdcMintData = JSON.parse(fs.readFileSync(usdcMintPath, 'utf-8'));
  const usdcAuthority = Keypair.fromSecretKey(new Uint8Array(usdcMintData.mintAuthority));
  log(`USDC auth:  ${usdcAuthority.publicKey.toBase58()}`);

  const conn = new Connection(RPC_URL, 'confirmed');

  // ── Admin balance check ───────────────────────────────────────────────────
  const adminBalance = await conn.getBalance(admin.publicKey);
  log(`Admin SOL:  ${(adminBalance / LAMPORTS_PER_SOL).toFixed(3)}`);
  if (adminBalance < 2 * LAMPORTS_PER_SOL) {
    fail('Admin wallet needs at least 2 SOL on devnet');
    fail('Run: solana airdrop 2 --url devnet');
    process.exit(1);
  }

  // ── Create keys/ directory ────────────────────────────────────────────────
  log('');
  log('── Step 1: Generating keypairs ──────────────────');
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    ok('Created demo/keys/');
  }

  const agentPath    = path.join(KEYS_DIR, 'agent.json');
  const ownerPath    = path.join(KEYS_DIR, 'owner.json');
  const customerPath = path.join(KEYS_DIR, 'customer.json');

  // Generate fresh keypairs (skip if already exist)
  let agent: Keypair;
  if (fs.existsSync(agentPath)) {
    agent = loadKeypair(agentPath);
    warn(`agent.json exists — reusing ${agent.publicKey.toBase58().slice(0, 16)}…`);
  } else {
    agent = Keypair.generate();
    saveKeypair(agent, agentPath);
    ok(`Generated agent:    ${agent.publicKey.toBase58()}`);
  }

  let owner: Keypair;
  if (fs.existsSync(ownerPath)) {
    owner = loadKeypair(ownerPath);
    warn(`owner.json exists — reusing ${owner.publicKey.toBase58().slice(0, 16)}…`);
  } else {
    owner = Keypair.generate();
    saveKeypair(owner, ownerPath);
    ok(`Generated owner:    ${owner.publicKey.toBase58()}`);
  }

  let customer: Keypair;
  if (fs.existsSync(customerPath)) {
    customer = loadKeypair(customerPath);
    warn(`customer.json exists — reusing ${customer.publicKey.toBase58().slice(0, 16)}…`);
  } else {
    customer = Keypair.generate();
    saveKeypair(customer, customerPath);
    ok(`Generated customer: ${customer.publicKey.toBase58()}`);
  }

  // ── Fund wallets with SOL ─────────────────────────────────────────────────
  log('');
  log('── Step 2: Funding wallets with SOL ─────────────');

  const fundIfNeeded = async (wallet: Keypair, label: string, targetSol: number) => {
    const bal = await conn.getBalance(wallet.publicKey);
    const needed = targetSol * LAMPORTS_PER_SOL - bal;
    if (needed <= 0) {
      ok(`${label} already has ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
      return;
    }
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: wallet.publicKey,
        lamports: Math.ceil(needed),
      }),
    );
    const sig = await sendAndConfirmTransaction(conn, tx, [admin], { commitment: 'confirmed' });
    ok(`Funded ${label}: ${targetSol} SOL (${sig.slice(0, 16)}…)`);
    await sleep(500);
  };

  await fundIfNeeded(owner,    'owner   ', 0.5);
  await fundIfNeeded(agent,    'agent   ', 0.2);
  await fundIfNeeded(customer, 'customer', 0.2);

  // ── Create USDC ATAs and mint ─────────────────────────────────────────────
  log('');
  log('── Step 3: Creating USDC ATAs and minting ───────');

  // Owner: $100 USDC (will use $2 for collateral, keep rest for demo reuse)
  const ownerAta = await getOrCreateAssociatedTokenAccount(conn, admin, USDC_MINT, owner.publicKey);
  const ownerUsdcBal = Number(ownerAta.amount) / 1_000_000;
  if (ownerUsdcBal < 10) {
    await mintTo(conn, admin, USDC_MINT, ownerAta.address, usdcAuthority, 100 * 1_000_000);
    ok(`Minted $100 USDC to owner (${ownerAta.address.toBase58().slice(0, 16)}…)`);
  } else {
    ok(`Owner already has $${ownerUsdcBal.toFixed(2)} USDC`);
  }
  await sleep(500);

  // Customer: $100 USDC (pays for 10 × $0.25 API calls in the demo)
  const customerAta = await getOrCreateAssociatedTokenAccount(conn, admin, USDC_MINT, customer.publicKey);
  const customerUsdcBal = Number(customerAta.amount) / 1_000_000;
  if (customerUsdcBal < 5) {
    await mintTo(conn, admin, USDC_MINT, customerAta.address, usdcAuthority, 100 * 1_000_000);
    ok(`Minted $100 USDC to customer (${customerAta.address.toBase58().slice(0, 16)}…)`);
  } else {
    ok(`Customer already has $${customerUsdcBal.toFixed(2)} USDC`);
  }
  await sleep(500);

  // ── deposit_liquidity — fund the vault so credit can be extended ──────────
  log('');
  log('── Step 4: Seeding vault with LP liquidity ───────');

  const adminAta = await getOrCreateAssociatedTokenAccount(conn, admin, USDC_MINT, admin.publicKey);
  const vaultUsdcPda = pdas.vaultUsdc();
  const vaultBal = await conn.getTokenAccountBalance(vaultUsdcPda).catch(() => null);
  const vaultUsdcAmount = vaultBal ? Number(vaultBal.value.amount) / 1_000_000 : 0;

  if (vaultUsdcAmount >= 200) {
    ok(`Vault already has $${vaultUsdcAmount.toFixed(2)} USDC`);
  } else {
    const LIQUIDITY_AMOUNT = 500_000_000n; // $500 USDC
    const ixLiq = ixDepositLiquidity(admin.publicKey, adminAta.address, LIQUIDITY_AMOUNT);
    const txLiq = new Transaction().add(ixLiq);
    try {
      const sig = await sendAndConfirmTransaction(conn, txLiq, [admin], { commitment: 'confirmed' });
      ok(`deposit_liquidity: $500 USDC added to vault (${sig.slice(0, 16)}…)`);
    } catch (e: any) {
      fail(`deposit_liquidity failed: ${e.message}`);
      if (e.logs) e.logs.forEach((l: string) => process.stderr.write(`  ${l}\n`));
      process.exit(1);
    }
    await sleep(500);
  }

  // ── add_venue — whitelist PaymentRouter as x402 facilitator ────────────────
  log('');
  log('── Step 5: Whitelisting PaymentRouter as venue ───');

  const routerVenuePda = pdas.whitelistedVenue(PROGRAM_IDS.paymentRouter);
  const existingVenue = await conn.getAccountInfo(routerVenuePda);

  if (existingVenue) {
    ok(`PaymentRouter already whitelisted (${routerVenuePda.toBase58().slice(0, 16)}…)`);
  } else {
    const ixVenue = ixAddVenue(
      PROGRAM_IDS.paymentRouter,
      'krexa-payment-router',
      2, // category 2 = x402
      admin.publicKey,
    );
    const txVenue = new Transaction().add(ixVenue);
    try {
      const sig = await sendAndConfirmTransaction(conn, txVenue, [admin], { commitment: 'confirmed' });
      ok(`add_venue: PaymentRouter whitelisted (${sig.slice(0, 16)}…)`);
    } catch (e: any) {
      fail(`add_venue failed: ${e.message}`);
      if (e.logs) e.logs.forEach((l: string) => process.stderr.write(`  ${l}\n`));
      process.exit(1);
    }
    await sleep(500);
  }

  // ── deposit_collateral ────────────────────────────────────────────────────
  log('');
  log('── Step 6: Creating collateral_position PDA ─────');

  const collateralPda = pdas.collateral(agent.publicKey);
  const existingCollateral = await conn.getAccountInfo(collateralPda);

  if (existingCollateral) {
    ok(`Collateral PDA already exists: ${collateralPda.toBase58().slice(0, 16)}…`);
  } else {
    // Deposit $2 USDC as collateral for the agent
    const COLLATERAL_AMOUNT = 2_000_000n; // $2.00 USDC

    const ix = ixDepositCollateral(
      agent.publicKey,
      owner.publicKey,
      ownerAta.address,
      COLLATERAL_AMOUNT,
    );

    const tx = new Transaction().add(ix);
    try {
      const sig = await sendAndConfirmTransaction(conn, tx, [owner], { commitment: 'confirmed' });
      ok(`deposit_collateral: $2 USDC locked (${sig.slice(0, 16)}…)`);
      ok(`Collateral PDA: ${collateralPda.toBase58()}`);
    } catch (e: any) {
      fail(`deposit_collateral failed: ${e.message}`);
      if (e.logs) e.logs.forEach((l: string) => process.stderr.write(`  ${l}\n`));
      process.exit(1);
    }
  }

  // ── Write demo/.env ───────────────────────────────────────────────────────
  log('');
  log('── Step 7: Writing demo/.env ────────────────────');

  const agentWalletPda = pdas.agentWallet(agent.publicKey);
  const relOraclePath  = '../solana-programs/scripts/oracle-keypair.json';

  const envContent = `# Auto-generated by configure-demo.ts — ${new Date().toISOString()}
# DO NOT COMMIT — contains keypair paths with real funds

# Keypairs
AGENT_KEYPAIR_PATH=./keys/agent.json
OWNER_KEYPAIR_PATH=./keys/owner.json
ORACLE_KEYPAIR_PATH=${relOraclePath}
CUSTOMER_KEYPAIR_PATH=./keys/customer.json

# Solana network
SOLANA_RPC_URL=${RPC_URL}

# USDC mint (devnet mock)
SOLANA_USDC_MINT=${USDC_MINT.toBase58()}

# Platform fee recipient (treasury ATA)
PLATFORM_TREASURY=${TREASURY_ATA.toBase58()}

# Program IDs
REGISTRY_PROGRAM_ID=${PROGRAM_IDS.agentRegistry.toBase58()}
VAULT_PROGRAM_ID=${PROGRAM_IDS.creditVault.toBase58()}
WALLET_PROGRAM_ID=${PROGRAM_IDS.agentWallet.toBase58()}
VENUE_PROGRAM_ID=${PROGRAM_IDS.venueWhitelist.toBase58()}
ROUTER_PROGRAM_ID=${PROGRAM_IDS.paymentRouter.toBase58()}

# Derived addresses (informational)
AGENT_PUBKEY=${agent.publicKey.toBase58()}
OWNER_PUBKEY=${owner.publicKey.toBase58()}
CUSTOMER_PUBKEY=${customer.publicKey.toBase58()}
AGENT_WALLET_PDA=${agentWalletPda.toBase58()}
COLLATERAL_PDA=${collateralPda.toBase58()}
`;

  fs.writeFileSync(path.join(DEMO_DIR, '.env'), envContent);
  ok('Wrote demo/.env');

  // ── Write demo/agent-service/.env ─────────────────────────────────────────
  log('');
  log('── Step 8: Writing demo/agent-service/.env ──────');

  const agentServiceEnvPath = path.join(DEMO_DIR, 'agent-service', '.env');
  if (fs.existsSync(agentServiceEnvPath)) {
    warn('demo/agent-service/.env already exists — not overwriting');
    warn('Check that ANTHROPIC_API_KEY and MERCHANT_WALLET are set correctly');
  } else {
    const agentServiceEnv = `# Fill in your API key before running the agent service
ANTHROPIC_API_KEY=<your-anthropic-api-key>

# Krexa agent wallet PDA — this is where the agent settles payments
MERCHANT_WALLET=${agentWalletPda.toBase58()}

# HTTP port for the agent service
PORT=3001
`;
    fs.writeFileSync(agentServiceEnvPath, agentServiceEnv);
    ok('Wrote demo/agent-service/.env (fill in ANTHROPIC_API_KEY)');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log('');
  log('══════════════════════════════════════════════');
  log('  Setup complete!');
  log('');
  log(`  Agent:    ${agent.publicKey.toBase58()}`);
  log(`  Owner:    ${owner.publicKey.toBase58()}`);
  log(`  Customer: ${customer.publicKey.toBase58()}`);
  log(`  Oracle:   ${oracle.publicKey.toBase58()}`);
  log('');
  log('  Next steps:');
  log('  1. Fill in ANTHROPIC_API_KEY in demo/agent-service/.env');
  log('  2. cd demo && npx tsx setup-demo.ts   (pre-flight check)');
  log('  3. cd demo && npx tsx run-demo.ts     (launch demo)');
  log('  4. Open http://localhost:5173/demo    (live dashboard)');
  log('══════════════════════════════════════════════');
}

main().catch((err) => {
  fail(`FATAL: ${err.message}`);
  if (err.logs) err.logs.forEach((l: string) => process.stderr.write(`  ${l}\n`));
  process.exit(1);
});
