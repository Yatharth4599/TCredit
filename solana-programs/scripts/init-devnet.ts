/**
 * init-devnet.ts — initializes all 7 Krexa programs on devnet.
 * Uses raw instructions (no IDL / anchor.Program required).
 */

import {
  Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  createMint, createAssociatedTokenAccount, getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const DEVNET_RPC = 'https://api.devnet.solana.com';
const USDC_DECIMALS = 6;
const VAULT_UTILIZATION_CAP_BPS = 7500;
const VAULT_BASE_RATE_BPS = 500;
const VAULT_LOCKUP_SECONDS = BigInt(0);
const ROUTER_PLATFORM_FEE_BPS = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Encoding helpers (Anchor-compatible Borsh)
// ─────────────────────────────────────────────────────────────────────────────

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function encodeU8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v); return b; }
function encodeU16(v: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function encodeU64(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }
function encodeI64(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigInt64LE(v); return b; }
function encodePubkey(pk: PublicKey): Buffer { return Buffer.from(pk.toBytes()); }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadWallet(): Keypair {
  const raw = JSON.parse(fs.readFileSync(
    path.join(process.env.HOME!, '.config/solana/id.json'), 'utf-8',
  ));
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

function findPda(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function log(msg: string) { process.stdout.write(`[init] ${msg}\n`); }

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function send(
  conn: Connection,
  ix: TransactionInstruction,
  payer: Keypair,
  signers: Keypair[] = [],
): Promise<string> {
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(conn, tx, [payer, ...signers], { commitment: 'confirmed' });
}

function getArg(name: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) throw new Error(`Missing --${name}`);
  return process.argv[idx + 1]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const registryId     = new PublicKey(getArg('registry'));
  const vaultId        = new PublicKey(getArg('vault'));
  const walletId       = new PublicKey(getArg('wallet'));
  const venueId        = new PublicKey(getArg('venue'));
  const routerId       = new PublicKey(getArg('router'));
  const scoreId        = new PublicKey(getArg('score'));
  const servicePlanId  = new PublicKey(getArg('service-plan'));

  const conn  = new Connection(DEVNET_RPC, 'confirmed');
  const admin = loadWallet();

  log(`Admin:   ${admin.publicKey.toBase58()}`);
  log(`Balance: ${(await conn.getBalance(admin.publicKey)) / LAMPORTS_PER_SOL} SOL`);

  // ── 0. Oracle + keeper keypairs ────────────────────────────────────────────
  const SCRIPTS = path.resolve(__dirname);

  function loadOrCreate(filename: string, label: string): Keypair {
    const p = path.join(SCRIPTS, filename);
    if (fs.existsSync(p)) {
      const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(p, 'utf-8'))));
      log(`Loaded ${label}: ${kp.publicKey.toBase58()}`);
      return kp;
    }
    const kp = Keypair.generate();
    fs.writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)));
    log(`Generated ${label}: ${kp.publicKey.toBase58()}`);
    return kp;
  }

  const oracle = loadOrCreate('oracle-keypair.json', 'oracle');
  const keeper = loadOrCreate('keeper-keypair.json', 'keeper');

  // Fund oracle + keeper from admin wallet (avoids faucet rate limits)
  for (const [name, kp] of [['oracle', oracle], ['keeper', keeper]] as [string, Keypair][]) {
    const bal = await conn.getBalance(kp.publicKey);
    if (bal < 0.3 * LAMPORTS_PER_SOL) {
      log(`Funding ${name} from admin…`);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: kp.publicKey,
          lamports: Math.round(0.5 * LAMPORTS_PER_SOL),
        }),
      );
      const sig = await sendAndConfirmTransaction(conn, tx, [admin], { commitment: 'confirmed' });
      log(`  Funded ${name} (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 1. Mock USDC mint ──────────────────────────────────────────────────────
  const usdcMintPath = path.join(SCRIPTS, 'usdc-mint.json');
  let usdcMint: PublicKey;
  let usdcMintAuthority: Keypair;

  if (fs.existsSync(usdcMintPath)) {
    const saved = JSON.parse(fs.readFileSync(usdcMintPath, 'utf-8'));
    usdcMint = new PublicKey(saved.mint);
    usdcMintAuthority = Keypair.fromSecretKey(new Uint8Array(saved.mintAuthority));
    log(`Loaded mock USDC: ${usdcMint.toBase58()}`);
  } else {
    usdcMintAuthority = Keypair.generate();
    usdcMint = await createMint(conn, admin, usdcMintAuthority.publicKey, usdcMintAuthority.publicKey, USDC_DECIMALS);
    fs.writeFileSync(usdcMintPath, JSON.stringify({
      mint: usdcMint.toBase58(),
      mintAuthority: Array.from(usdcMintAuthority.secretKey),
    }));
    log(`Created mock USDC: ${usdcMint.toBase58()}`);
  }

  // ── 2. Treasury ATA ────────────────────────────────────────────────────────
  let treasuryAta: PublicKey;
  try {
    treasuryAta = await createAssociatedTokenAccount(conn, admin, usdcMint, admin.publicKey);
    log(`Created treasury ATA: ${treasuryAta.toBase58()}`);
  } catch {
    treasuryAta = await getAssociatedTokenAddress(usdcMint, admin.publicKey);
    log(`Treasury ATA exists: ${treasuryAta.toBase58()}`);
  }

  // ── 3. Initialize krexa-venue-whitelist ────────────────────────────────────
  {
    const [configPda] = findPda([Buffer.from('whitelist_config')], venueId);
    const info = await conn.getAccountInfo(configPda);
    if (info) {
      log(`krexa-venue-whitelist already initialized — skipping`);
    } else {
      const data = disc('initialize');
      const ix = new TransactionInstruction({
        programId: venueId,
        keys: [
          { pubkey: configPda,            isSigner: false, isWritable: true },
          { pubkey: admin.publicKey,       isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-venue-whitelist initialized (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 4. Initialize krexa-agent-registry ────────────────────────────────────
  {
    const [configPda] = findPda([Buffer.from('registry_config')], registryId);
    const info = await conn.getAccountInfo(configPda);
    if (info) {
      log(`krexa-agent-registry already initialized — skipping`);
    } else {
      const data = Buffer.concat([
        disc('initialize'),
        encodePubkey(oracle.publicKey),
        encodePubkey(walletId),
      ]);
      const ix = new TransactionInstruction({
        programId: registryId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: admin.publicKey,         isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-agent-registry initialized (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 5. Initialize krexa-credit-vault ──────────────────────────────────────
  {
    const [configPda]   = findPda([Buffer.from('vault_config')],   vaultId);
    const [vaultToken]  = findPda([Buffer.from('vault_usdc')],     vaultId);
    const [insureToken] = findPda([Buffer.from('insurance_usdc')], vaultId);

    // 5a. initialize_vault — creates only VaultConfig PDA
    const configInfo = await conn.getAccountInfo(configPda);
    if (configInfo) {
      log(`krexa-credit-vault config already initialized — skipping`);
    } else {
      const data = Buffer.concat([
        disc('initialize_vault'),
        encodePubkey(oracle.publicKey),
        encodePubkey(walletId),
        encodeU16(VAULT_UTILIZATION_CAP_BPS),
        encodeU16(VAULT_BASE_RATE_BPS),
        encodeI64(VAULT_LOCKUP_SECONDS),
      ]);
      const ix = new TransactionInstruction({
        programId: vaultId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: usdcMint,               isSigner: false, isWritable: false },
          { pubkey: admin.publicKey,        isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-credit-vault config initialized (${sig.slice(0, 16)}…)`);
    }

    // 5b. create_vault_token — creates vault_usdc PDA token account
    const vaultTokenInfo = await conn.getAccountInfo(vaultToken);
    if (vaultTokenInfo) {
      log(`krexa-credit-vault vault_token already exists — skipping`);
    } else {
      const ix = new TransactionInstruction({
        programId: vaultId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: usdcMint,               isSigner: false, isWritable: false },
          { pubkey: vaultToken,             isSigner: false, isWritable: true },
          { pubkey: admin.publicKey,        isSigner: true,  isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID,       isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY,     isSigner: false, isWritable: false },
        ],
        data: disc('create_vault_token'),
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-credit-vault vault_token created (${sig.slice(0, 16)}…)`);
    }

    // 5c. create_insurance_token — creates insurance_usdc PDA token account
    const insureInfo = await conn.getAccountInfo(insureToken);
    if (insureInfo) {
      log(`krexa-credit-vault insurance_token already exists — skipping`);
    } else {
      const ix = new TransactionInstruction({
        programId: vaultId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: usdcMint,               isSigner: false, isWritable: false },
          { pubkey: insureToken,            isSigner: false, isWritable: true },
          { pubkey: admin.publicKey,        isSigner: true,  isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID,       isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY,     isSigner: false, isWritable: false },
        ],
        data: disc('create_insurance_token'),
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-credit-vault insurance_token created (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 6. Initialize krexa-agent-wallet ──────────────────────────────────────
  {
    const [configPda] = findPda([Buffer.from('wallet_config')], walletId);
    const info = await conn.getAccountInfo(configPda);
    if (info) {
      log(`krexa-agent-wallet already initialized — skipping`);
    } else {
      const data = Buffer.concat([
        disc('initialize'),
        encodePubkey(keeper.publicKey),
        encodePubkey(vaultId),
        encodePubkey(registryId),
        encodePubkey(venueId),
        encodePubkey(routerId),
      ]);
      const ix = new TransactionInstruction({
        programId: walletId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: usdcMint,               isSigner: false, isWritable: false },
          { pubkey: admin.publicKey,         isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-agent-wallet initialized (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 7. Initialize krexa-payment-router ────────────────────────────────────
  {
    const [configPda] = findPda([Buffer.from('router_config')], routerId);
    const info = await conn.getAccountInfo(configPda);
    if (info) {
      log(`krexa-payment-router already initialized — skipping`);
    } else {
      const data = Buffer.concat([
        disc('initialize'),
        encodeU16(ROUTER_PLATFORM_FEE_BPS),
      ]);
      const ix = new TransactionInstruction({
        programId: routerId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: usdcMint,               isSigner: false, isWritable: false },
          { pubkey: treasuryAta,            isSigner: false, isWritable: false },
          { pubkey: oracle.publicKey,        isSigner: false, isWritable: false },
          { pubkey: admin.publicKey,         isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-payment-router initialized (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 7b. Initialize krexa-score ────────────────────────────────────────────
  {
    const [configPda] = findPda([Buffer.from('score_config')], scoreId);
    const info = await conn.getAccountInfo(configPda);
    if (info) {
      log(`krexa-score already initialized — skipping`);
    } else {
      const data = Buffer.concat([
        disc('initialize'),
        encodePubkey(oracle.publicKey),
        encodePubkey(registryId),
        encodePubkey(walletId),
        encodePubkey(vaultId),
      ]);
      const ix = new TransactionInstruction({
        programId: scoreId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: admin.publicKey,         isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-score initialized (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 7c. Initialize krexa-service-plan ─────────────────────────────────────
  {
    const [configPda] = findPda([Buffer.from('svc_config')], servicePlanId);
    const info = await conn.getAccountInfo(configPda);
    if (info) {
      log(`krexa-service-plan already initialized — skipping`);
    } else {
      const data = Buffer.concat([
        disc('initialize'),
        encodePubkey(oracle.publicKey),
        encodePubkey(vaultId),
        encodePubkey(walletId),
      ]);
      const ix = new TransactionInstruction({
        programId: servicePlanId,
        keys: [
          { pubkey: configPda,              isSigner: false, isWritable: true },
          { pubkey: admin.publicKey,         isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin);
      log(`✓ krexa-service-plan initialized (${sig.slice(0, 16)}…)`);
    }
  }

  // ── 8. Write .env.devnet ──────────────────────────────────────────────────
  const bs58 = await import('bs58');
  const envContent = `# Auto-generated by init-devnet.ts — ${new Date().toISOString()}
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

SOLANA_REGISTRY_PROGRAM_ID=${registryId.toBase58()}
SOLANA_VAULT_PROGRAM_ID=${vaultId.toBase58()}
SOLANA_WALLET_PROGRAM_ID=${walletId.toBase58()}
SOLANA_VENUE_PROGRAM_ID=${venueId.toBase58()}
SOLANA_ROUTER_PROGRAM_ID=${routerId.toBase58()}
SOLANA_SCORE_PROGRAM_ID=${scoreId.toBase58()}
SOLANA_SERVICE_PLAN_PROGRAM_ID=${servicePlanId.toBase58()}

SOLANA_USDC_MINT=${usdcMint.toBase58()}
KREXA_ORACLE_PUBKEY=${oracle.publicKey.toBase58()}
KREXA_KEEPER_PUBKEY=${keeper.publicKey.toBase58()}
KREXA_TREASURY_ATA=${treasuryAta.toBase58()}

SOLANA_ORACLE_PRIVATE_KEY=${bs58.default.encode(oracle.secretKey)}
SOLANA_KEEPER_PRIVATE_KEY=${bs58.default.encode(keeper.secretKey)}
`;
  fs.writeFileSync(path.join(SCRIPTS, '.env.devnet'), envContent);

  log('\n════════════════════════════════════════');
  log('All 7 programs initialized on devnet ✓');
  log(`  Venue:        ${venueId.toBase58()}`);
  log(`  Registry:     ${registryId.toBase58()}`);
  log(`  Vault:        ${vaultId.toBase58()}`);
  log(`  Wallet:       ${walletId.toBase58()}`);
  log(`  Router:       ${routerId.toBase58()}`);
  log(`  Score:        ${scoreId.toBase58()}`);
  log(`  ServicePlan:  ${servicePlanId.toBase58()}`);
  log(`  USDC:         ${usdcMint.toBase58()}`);
  log(`  Oracle:       ${oracle.publicKey.toBase58()}`);
  log(`  Keeper:       ${keeper.publicKey.toBase58()}`);
  log(`  .env.devnet written`);
  log('════════════════════════════════════════\n');
}

main().catch(err => {
  process.stderr.write(`[init] FATAL: ${err.message}\n`);
  if (err.logs) err.logs.forEach((l: string) => process.stderr.write(`  ${l}\n`));
  process.exit(1);
});
