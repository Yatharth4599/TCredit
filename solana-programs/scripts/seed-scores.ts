/**
 * seed-scores.ts
 *
 * Seeds KrexitScore PDAs for the 3 test agents from seed-output.json.
 * For each agent: initialize_score then update_score on krexa-score program.
 *
 * Uses raw TransactionInstruction (no IDL / anchor.Program required).
 * Requires init-devnet.ts and seed-devnet.ts to have run first.
 */

import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const DEVNET_RPC = 'https://api.devnet.solana.com';
const SCRIPTS_DIR = path.resolve(__dirname);
const SCORE_PROGRAM_ID    = new PublicKey('2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh');
const REGISTRY_PROGRAM_ID = new PublicKey('ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG');

// ─────────────────────────────────────────────────────────────────────────────
// Encoding helpers (Anchor-compatible Borsh)
// ─────────────────────────────────────────────────────────────────────────────

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function encodeU8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v); return b; }
function encodeU16(v: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function encodeI16(v: number): Buffer { const b = Buffer.alloc(2); b.writeInt16LE(v); return b; }
function encodeU32(v: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; }
function encodeI32(v: number): Buffer { const b = Buffer.alloc(4); b.writeInt32LE(v); return b; }
function encodeU64(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }

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

function log(msg: string) { process.stdout.write(`[seed-scores] ${msg}\n`); }
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

// ─────────────────────────────────────────────────────────────────────────────
// Score data definitions
// ─────────────────────────────────────────────────────────────────────────────

interface ScoreData {
  score: number;              // u16
  credit_level: number;       // u8
  c1_repayment: number;       // u16
  c2_profitability: number;   // u16
  c3_behavioral: number;      // u16
  c4_usage: number;           // u16
  c5_maturity: number;        // u16
  on_time_repayments: number; // u32
  late_repayments: number;    // u16
  missed_repayments: number;  // u16
  liquidations: number;       // u16
  defaults: number;           // u16
  credit_cycles_completed: number;  // u32
  cumulative_borrowed: bigint;      // u64
  cumulative_repaid: bigint;        // u64
  current_debt: bigint;             // u64
  pnl_ratio_bps: number;           // i32
  max_drawdown_bps: number;        // u16
  sharpe_ratio_bps: number;        // i16
  green_time_bps: number;          // u16
  yellow_time_bps: number;         // u16
  orange_time_bps: number;         // u16
  red_time_bps: number;            // u16
  venue_entropy_bps: number;       // u16
  unique_venues: number;           // u8
  total_transactions: number;      // u32
  avg_daily_volume: bigint;        // u64
  event_type: number;              // u8
}

function encodeScoreData(d: ScoreData): Buffer {
  return Buffer.concat([
    encodeU16(d.score),
    encodeU8(d.credit_level),
    encodeU16(d.c1_repayment),
    encodeU16(d.c2_profitability),
    encodeU16(d.c3_behavioral),
    encodeU16(d.c4_usage),
    encodeU16(d.c5_maturity),
    encodeU32(d.on_time_repayments),
    encodeU16(d.late_repayments),
    encodeU16(d.missed_repayments),
    encodeU16(d.liquidations),
    encodeU16(d.defaults),
    encodeU32(d.credit_cycles_completed),
    encodeU64(d.cumulative_borrowed),
    encodeU64(d.cumulative_repaid),
    encodeU64(d.current_debt),
    encodeI32(d.pnl_ratio_bps),
    encodeU16(d.max_drawdown_bps),
    encodeI16(d.sharpe_ratio_bps),
    encodeU16(d.green_time_bps),
    encodeU16(d.yellow_time_bps),
    encodeU16(d.orange_time_bps),
    encodeU16(d.red_time_bps),
    encodeU16(d.venue_entropy_bps),
    encodeU8(d.unique_venues),
    encodeU32(d.total_transactions),
    encodeU64(d.avg_daily_volume),
    encodeU8(d.event_type),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent score definitions
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_SCORES: Record<string, { agentType: number; data: ScoreData }> = {
  'DataBot-Alpha': {
    agentType: 0, // Trader
    data: {
      score: 720,
      credit_level: 3, // L3 Trusted
      c1_repayment: 8200,
      c2_profitability: 7500,
      c3_behavioral: 8000,
      c4_usage: 6500,
      c5_maturity: 7000,
      on_time_repayments: 45,
      late_repayments: 2,
      missed_repayments: 0,
      liquidations: 0,
      defaults: 0,
      credit_cycles_completed: 12,
      cumulative_borrowed: 50_000_000_000n,   // $50K
      cumulative_repaid: 48_000_000_000n,     // $48K
      current_debt: 2_000_000_000n,           // $2K
      pnl_ratio_bps: 1500,
      max_drawdown_bps: 800,
      sharpe_ratio_bps: 120,
      green_time_bps: 7500,
      yellow_time_bps: 2000,
      orange_time_bps: 500,
      red_time_bps: 0,
      venue_entropy_bps: 6500,
      unique_venues: 5,
      total_transactions: 850,
      avg_daily_volume: 500_000_000n,         // $500
      event_type: 0,
    },
  },
  'TradeBot-Beta': {
    agentType: 0, // Trader
    data: {
      score: 550,
      credit_level: 2, // L2 Established
      c1_repayment: 6000,
      c2_profitability: 5500,
      c3_behavioral: 5800,
      c4_usage: 4500,
      c5_maturity: 4000,
      on_time_repayments: 20,
      late_repayments: 5,
      missed_repayments: 1,
      liquidations: 0,
      defaults: 0,
      credit_cycles_completed: 6,
      cumulative_borrowed: 15_000_000_000n,   // $15K
      cumulative_repaid: 12_000_000_000n,     // $12K
      current_debt: 3_000_000_000n,           // $3K
      pnl_ratio_bps: 800,
      max_drawdown_bps: 1500,
      sharpe_ratio_bps: 75,
      green_time_bps: 5000,
      yellow_time_bps: 3000,
      orange_time_bps: 1500,
      red_time_bps: 500,
      venue_entropy_bps: 4000,
      unique_venues: 3,
      total_transactions: 320,
      avg_daily_volume: 200_000_000n,         // $200
      event_type: 0,
    },
  },
  'PayBot-Gamma': {
    agentType: 0, // Trader
    data: {
      score: 410,
      credit_level: 1, // L1 Starter
      c1_repayment: 4500,
      c2_profitability: 3800,
      c3_behavioral: 4200,
      c4_usage: 3000,
      c5_maturity: 2500,
      on_time_repayments: 8,
      late_repayments: 3,
      missed_repayments: 2,
      liquidations: 0,
      defaults: 0,
      credit_cycles_completed: 2,
      cumulative_borrowed: 500_000_000n,      // $500
      cumulative_repaid: 300_000_000n,        // $300
      current_debt: 200_000_000n,             // $200
      pnl_ratio_bps: 200,
      max_drawdown_bps: 2500,
      sharpe_ratio_bps: 30,
      green_time_bps: 3500,
      yellow_time_bps: 3500,
      orange_time_bps: 2000,
      red_time_bps: 1000,
      venue_entropy_bps: 2000,
      unique_venues: 2,
      total_transactions: 95,
      avg_daily_volume: 50_000_000n,          // $50
      event_type: 0,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const conn  = new Connection(DEVNET_RPC, 'confirmed');
  const admin = loadWallet('~/.config/solana/id.json');

  const oracleRaw = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'oracle-keypair.json'), 'utf-8'));
  const oracle = Keypair.fromSecretKey(new Uint8Array(oracleRaw));

  const seedOutput = JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'seed-output.json'), 'utf-8'));

  log(`Admin:  ${admin.publicKey.toBase58()}`);
  log(`Oracle: ${oracle.publicKey.toBase58()}`);
  log(`Score program: ${SCORE_PROGRAM_ID.toBase58()}`);

  const [scoreConfigPda] = findPda([Buffer.from('score_config')], SCORE_PROGRAM_ID);

  for (const agent of seedOutput.agents) {
    const agentName: string = agent.name;
    const agentPubkey = new PublicKey(agent.agentPubkey);
    const scoreEntry = AGENT_SCORES[agentName];

    if (!scoreEntry) {
      log(`Unknown agent ${agentName} — skipping`);
      continue;
    }

    log(`\nSeeding score for: ${agentName} (${agentPubkey.toBase58().slice(0, 12)}…)`);

    // agent_profile PDA: ["agent_profile", agent] on registry program
    const [agentProfilePda] = findPda(
      [Buffer.from('agent_profile'), agentPubkey.toBuffer()],
      REGISTRY_PROGRAM_ID,
    );

    // krexit_score PDA: ["krexit_score", agent_profile_key] on score program
    const [krexitScorePda] = findPda(
      [Buffer.from('krexit_score'), agentProfilePda.toBuffer()],
      SCORE_PROGRAM_ID,
    );

    // Check if KrexitScore PDA already exists
    const existingAccount = await conn.getAccountInfo(krexitScorePda);

    // 1. initialize_score (only if not yet created)
    if (!existingAccount) {
      const data = Buffer.concat([
        disc('initialize_score'),
        encodeU8(scoreEntry.agentType),
      ]);
      const ix = new TransactionInstruction({
        programId: SCORE_PROGRAM_ID,
        keys: [
          { pubkey: scoreConfigPda,          isSigner: false, isWritable: false },
          { pubkey: agentProfilePda,         isSigner: false, isWritable: false },
          { pubkey: krexitScorePda,          isSigner: false, isWritable: true  },
          { pubkey: admin.publicKey,         isSigner: true,  isWritable: true  },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      try {
        const sig = await send(conn, ix, admin);
        log(`  ✓ initialize_score (${sig.slice(0, 16)}…)`);
      } catch (e: any) {
        log(`  ✗ initialize_score failed: ${e.message}`);
        continue;
      }
      await sleep(500);
    } else {
      log(`  KrexitScore PDA already exists — skipping initialize`);
    }

    // 2. update_score — ramp in steps of 100 (program max delta = 100 per update)
    {
      const targetScore = scoreEntry.data.score;
      const currentScoreBytes = (await conn.getAccountInfo(krexitScorePda))?.data;
      // score is at offset: 8 (disc) + 32 (agent) + 32 (owner) = 72, stored as u16 LE
      const currentScore = currentScoreBytes ? currentScoreBytes.readUInt16LE(72) : 350;
      const steps = Math.ceil(Math.abs(targetScore - currentScore) / 100);
      log(`  Ramping score ${currentScore} → ${targetScore} in ${steps} step(s)…`);

      for (let step = 1; step <= steps; step++) {
        // Always wait 65s before each step (60s on-chain cooldown + buffer)
        if (step > 1 || steps > 1) {
          log(`  Waiting 65s cooldown before step ${step}/${steps}…`);
          await sleep(65_000);
        }
        const stepScore = step < steps
          ? currentScore + Math.round((targetScore - currentScore) * step / steps)
          : targetScore;
        const stepData = { ...scoreEntry.data, score: stepScore };
        const data = Buffer.concat([disc('update_score'), encodeScoreData(stepData)]);
        const ix = new TransactionInstruction({
          programId: SCORE_PROGRAM_ID,
          keys: [
            { pubkey: scoreConfigPda,   isSigner: false, isWritable: false },
            { pubkey: oracle.publicKey, isSigner: true,  isWritable: false },
            { pubkey: krexitScorePda,   isSigner: false, isWritable: true  },
          ],
          data,
        });
        try {
          const sig = await send(conn, ix, oracle);
          log(`  ✓ step ${step}/${steps}: score=${stepScore} (${sig.slice(0, 16)}…)`);
        } catch (e: any) {
          log(`  ✗ update_score step ${step} failed: ${e.message}`);
          break;
        }
      }
    }

    await sleep(500);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  log('\n════════════════════════════════════════');
  log('Score seeding complete!');
  log('');
  for (const agent of seedOutput.agents) {
    const scoreEntry = AGENT_SCORES[agent.name];
    if (scoreEntry) {
      const agentPub = new PublicKey(agent.agentPubkey);
      const [profilePda] = findPda([Buffer.from('agent_profile'), agentPub.toBuffer()], REGISTRY_PROGRAM_ID);
      const [pda] = findPda(
        [Buffer.from('krexit_score'), profilePda.toBuffer()],
        SCORE_PROGRAM_ID,
      );
      log(`  ${agent.name}: score=${scoreEntry.data.score}, L${scoreEntry.data.credit_level}`);
      log(`    PDA: ${pda.toBase58()}`);
    }
  }
  log('════════════════════════════════════════\n');
}

main().catch((err) => {
  process.stderr.write(`[seed-scores] FATAL: ${err.message}\n`);
  if (err.logs) err.logs.forEach((l: string) => process.stderr.write(`  ${l}\n`));
  process.exit(1);
});
