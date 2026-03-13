/**
 * seed-devnet.ts
 *
 * Seeds the devnet deployment with 3 test agents:
 *   - Registers each agent on krexa-agent-registry
 *   - Sets KYA tier and credit score via oracle
 *   - Mints mock USDC to admin and agent owners for testing
 *
 * Uses raw TransactionInstruction (no IDL / anchor.Program required).
 * Requires init-devnet.ts to have run first (.env.devnet must exist).
 */

import {
  Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount, mintTo,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const DEVNET_RPC = 'https://api.devnet.solana.com';
const SCRIPTS_DIR = path.resolve(__dirname);

dotenv.config({ path: path.join(SCRIPTS_DIR, '.env.devnet') });

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key} — run init-devnet.ts first`);
  return v;
}

function log(msg: string) { process.stdout.write(`[seed] ${msg}\n`); }
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────────────────────
// Encoding helpers (Anchor-compatible Borsh)
// ─────────────────────────────────────────────────────────────────────────────

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}
function encodeU8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v); return b; }
function encodeU16(v: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function encodePubkey(pk: PublicKey): Buffer { return Buffer.from(pk.toBytes()); }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadWallet(p: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(p.replace('~', process.env.HOME!), 'utf-8'))),
  );
}

function findPda(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function nameToBytes32(name: string): Buffer {
  const buf = Buffer.alloc(32);
  Buffer.from(name).copy(buf);
  return buf;
}

async function send(
  conn: Connection,
  ix: TransactionInstruction,
  payer: Keypair,
  signers: Keypair[] = [],
): Promise<string> {
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(conn, tx, [payer, ...signers], { commitment: 'confirmed' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const registryId = new PublicKey(env('SOLANA_REGISTRY_PROGRAM_ID'));
  const usdcMint   = new PublicKey(env('SOLANA_USDC_MINT'));

  const usdcMintData = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'usdc-mint.json'), 'utf-8'));
  const usdcAuthority = Keypair.fromSecretKey(new Uint8Array(usdcMintData.mintAuthority));

  const conn  = new Connection(DEVNET_RPC, 'confirmed');
  const admin = loadWallet('~/.config/solana/id.json');

  const oracleRaw = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'oracle-keypair.json'), 'utf-8'));
  const oracle = Keypair.fromSecretKey(new Uint8Array(oracleRaw));

  log(`Admin:  ${admin.publicKey.toBase58()}`);
  log(`Oracle: ${oracle.publicKey.toBase58()}`);

  const [registryConfigPda] = findPda([Buffer.from('registry_config')], registryId);

  // ── Test agent definitions ──────────────────────────────────────────────────
  const agents = [
    { name: 'DataBot-Alpha', kyaTier: 2, creditScore: 720 },
    { name: 'TradeBot-Beta',  kyaTier: 1, creditScore: 550 },
    { name: 'PayBot-Gamma',   kyaTier: 1, creditScore: 410 },
  ];

  const seedAgents: {
    name: string;
    agentPubkey: string;
    ownerPubkey: string;
    kyaTier: number;
    creditScore: number;
  }[] = [];

  for (const agentDef of agents) {
    log(`\nSeeding agent: ${agentDef.name}`);

    const agentKp = Keypair.generate();
    const ownerKp = Keypair.generate();

    // Fund owner from admin (cheaper than faucet)
    {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: ownerKp.publicKey,
          lamports: Math.round(0.1 * LAMPORTS_PER_SOL),
        }),
      );
      await sendAndConfirmTransaction(conn, tx, [admin], { commitment: 'confirmed' });
      log(`  Funded owner from admin`);
    }

    const [profilePda] = findPda(
      [Buffer.from('agent_profile'), agentKp.publicKey.toBuffer()],
      registryId,
    );

    // 1. register_agent
    const profileInfo = await conn.getAccountInfo(profilePda);
    if (profileInfo) {
      log(`  Already registered — skipping`);
    } else {
      // Anchor: register_agent(name: [u8;32])
      // Borsh: 32-byte fixed array — no length prefix
      const data = Buffer.concat([
        disc('register_agent'),
        nameToBytes32(agentDef.name),
      ]);
      const ix = new TransactionInstruction({
        programId: registryId,
        keys: [
          { pubkey: registryConfigPda, isSigner: false, isWritable: false },
          { pubkey: profilePda,        isSigner: false, isWritable: true },
          { pubkey: agentKp.publicKey, isSigner: true,  isWritable: false },
          { pubkey: ownerKp.publicKey, isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      const sig = await send(conn, ix, admin, [agentKp, ownerKp]);
      log(`  ✓ Registered (${sig.slice(0, 16)}…)`);
    }

    // 2. update_kya(new_tier: u8) — oracle signs as authority
    {
      const data = Buffer.concat([
        disc('update_kya'),
        encodeU8(agentDef.kyaTier),
      ]);
      const ix = new TransactionInstruction({
        programId: registryId,
        keys: [
          { pubkey: registryConfigPda,  isSigner: false, isWritable: false },
          { pubkey: profilePda,         isSigner: false, isWritable: true },
          { pubkey: oracle.publicKey,   isSigner: true,  isWritable: false },
        ],
        data,
      });
      try {
        const sig = await send(conn, ix, admin, [oracle]);
        log(`  ✓ KYA tier set to ${agentDef.kyaTier} (${sig.slice(0, 16)}…)`);
      } catch (e: any) {
        log(`  KYA update failed: ${e.message}`);
      }
    }

    // 3. update_credit_score(new_score: u16) — oracle signs as authority
    {
      const data = Buffer.concat([
        disc('update_credit_score'),
        encodeU16(agentDef.creditScore),
      ]);
      const ix = new TransactionInstruction({
        programId: registryId,
        keys: [
          { pubkey: registryConfigPda,  isSigner: false, isWritable: false },
          { pubkey: profilePda,         isSigner: false, isWritable: true },
          { pubkey: oracle.publicKey,   isSigner: true,  isWritable: false },
        ],
        data,
      });
      try {
        const sig = await send(conn, ix, admin, [oracle]);
        log(`  ✓ Credit score set to ${agentDef.creditScore} (${sig.slice(0, 16)}…)`);
      } catch (e: any) {
        log(`  Credit score update failed: ${e.message}`);
      }
    }

    // 4. Mint USDC to owner for testing
    try {
      const ata = await getOrCreateAssociatedTokenAccount(
        conn, admin, usdcMint, ownerKp.publicKey,
      );
      await mintTo(conn, admin, usdcMint, ata.address, usdcAuthority, 500 * 1_000_000);
      log(`  ✓ Minted $500 USDC to owner ${ownerKp.publicKey.toBase58().slice(0, 12)}…`);
    } catch (e: any) {
      log(`  USDC mint failed: ${e.message}`);
    }

    seedAgents.push({
      name: agentDef.name,
      agentPubkey: agentKp.publicKey.toBase58(),
      ownerPubkey: ownerKp.publicKey.toBase58(),
      kyaTier: agentDef.kyaTier,
      creditScore: agentDef.creditScore,
    });

    await sleep(500);
  }

  // ── Mint LP liquidity USDC to admin ──────────────────────────────────────────
  log('\nMinting LP liquidity USDC to admin…');
  try {
    const adminAta = await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, admin.publicKey);
    await mintTo(conn, admin, usdcMint, adminAta.address, usdcAuthority, 10_000 * 1_000_000);
    log(`  ✓ Minted $10,000 USDC to admin (${adminAta.address.toBase58().slice(0, 12)}…)`);
  } catch (e: any) {
    log(`  Admin USDC mint failed: ${e.message}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  log('\n════════════════════════════════════════');
  log('Devnet seed complete!');
  log('');
  log('Test agents registered on krexa-agent-registry:');
  for (const a of seedAgents) {
    log(`  ${a.name}:`);
    log(`    agent: ${a.agentPubkey}`);
    log(`    owner: ${a.ownerPubkey}`);
    log(`    KYA tier: ${a.kyaTier}, credit score: ${a.creditScore}`);
  }
  log('');
  log(`USDC mint: ${usdcMint.toBase58()}`);
  log('════════════════════════════════════════\n');

  const seedOutput = {
    timestamp: new Date().toISOString(),
    usdcMint: usdcMint.toBase58(),
    agents: seedAgents,
  };
  fs.writeFileSync(
    path.join(SCRIPTS_DIR, 'seed-output.json'),
    JSON.stringify(seedOutput, null, 2),
  );
  log('Wrote seed-output.json');
}

main().catch((err) => {
  process.stderr.write(`[seed] FATAL: ${err.message}\n`);
  if (err.logs) err.logs.forEach((l: string) => process.stderr.write(`  ${l}\n`));
  process.exit(1);
});
