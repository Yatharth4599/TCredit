/**
 * solana-oracle.service.ts
 *
 * Solana oracle operations: builds and submits raw Anchor-compatible
 * TransactionInstructions signed by the oracle keypair (base58 private key
 * loaded from SOLANA_ORACLE_PRIVATE_KEY).
 *
 * Supported instructions (krexa-agent-registry program):
 *   - update_credit_score
 *   - update_kya
 *
 * PDAs:
 *   - registryConfigPda()     → seeds: ["registry_config"]
 *   - agentProfilePda(agent)  → seeds: ["agent_profile", agent]
 *   - vaultConfigPda()        → seeds: ["vault_config"]
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import bs58 from 'bs58';
import { env } from '../config/env.js';

// ── Borsh helpers (Anchor discriminator + encoding) ───────────────────────────

function disc(name: string): Buffer {
  return Buffer.from(createHash('sha256').update(`global:${name}`).digest()).subarray(0, 8);
}

function encodeU8(v: number): Buffer {
  const b = Buffer.alloc(1);
  b.writeUInt8(v);
  return b;
}

function encodeU16(v: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}

// ── Connection (singleton) ────────────────────────────────────────────────────

export const solanaConn = new Connection(env.SOLANA_RPC_URL, 'confirmed');

// ── Oracle keypair (lazy-loaded, cached) ─────────────────────────────────────

let _oracleKeypair: Keypair | null | undefined;

function loadKeypair(b58: string): Keypair | null {
  if (!b58) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(b58));
  } catch {
    return null;
  }
}

export function getOracleKeypair(): Keypair | null {
  if (_oracleKeypair === undefined) {
    _oracleKeypair = loadKeypair(env.SOLANA_ORACLE_PRIVATE_KEY);
  }
  return _oracleKeypair;
}

// ── Program IDs ───────────────────────────────────────────────────────────────

const REGISTRY_PROGRAM_ID = new PublicKey(env.SOLANA_REGISTRY_PROGRAM_ID);
const VAULT_PROGRAM_ID    = new PublicKey(env.SOLANA_VAULT_PROGRAM_ID);

// ── PDA derivation ────────────────────────────────────────────────────────────

export function registryConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('registry_config')],
    REGISTRY_PROGRAM_ID,
  );
  return pda;
}

export function agentProfilePda(agentPubkey: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent_profile'), new PublicKey(agentPubkey).toBuffer()],
    REGISTRY_PROGRAM_ID,
  );
  return pda;
}

export function vaultConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_config')],
    VAULT_PROGRAM_ID,
  );
  return pda;
}

// ── Instruction builders ──────────────────────────────────────────────────────

/**
 * Oracle calls update_credit_score on krexa-agent-registry.
 * Returns the confirmed transaction signature.
 */
export async function updateCreditScore(agentPubkey: string, score: number): Promise<string> {
  const oracle = getOracleKeypair();
  if (!oracle) throw new Error('SOLANA_ORACLE_PRIVATE_KEY not configured');

  const data = Buffer.concat([disc('update_credit_score'), encodeU16(score)]);

  const ix = new TransactionInstruction({
    programId: REGISTRY_PROGRAM_ID,
    keys: [
      { pubkey: registryConfigPda(),                   isSigner: false, isWritable: false },
      { pubkey: agentProfilePda(agentPubkey),          isSigner: false, isWritable: true  },
      { pubkey: oracle.publicKey,                      isSigner: true,  isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(solanaConn, tx, [oracle], { commitment: 'confirmed' });
}

/**
 * Oracle calls update_kya on krexa-agent-registry.
 * Returns the confirmed transaction signature.
 */
export async function updateKya(agentPubkey: string, tier: number): Promise<string> {
  const oracle = getOracleKeypair();
  if (!oracle) throw new Error('SOLANA_ORACLE_PRIVATE_KEY not configured');

  const data = Buffer.concat([disc('update_kya'), encodeU8(tier)]);

  const ix = new TransactionInstruction({
    programId: REGISTRY_PROGRAM_ID,
    keys: [
      { pubkey: registryConfigPda(),                   isSigner: false, isWritable: false },
      { pubkey: agentProfilePda(agentPubkey),          isSigner: false, isWritable: true  },
      { pubkey: oracle.publicKey,                      isSigner: true,  isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(solanaConn, tx, [oracle], { commitment: 'confirmed' });
}
