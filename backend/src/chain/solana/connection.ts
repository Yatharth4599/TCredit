import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// RPC Connection
// ---------------------------------------------------------------------------

export const solanaConnection = new Connection(
  env.SOLANA_RPC_URL,
  { commitment: 'confirmed', disableRetryOnRateLimit: false },
);

// ---------------------------------------------------------------------------
// Signing Keypairs (optional — only loaded when env vars are set)
// ---------------------------------------------------------------------------

function loadKeypair(b58Key: string | undefined, name: string): Keypair | null {
  if (!b58Key) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(b58Key));
  } catch (err) {
    console.warn(`[Solana] Could not load ${name} keypair:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Oracle signs credit-extension and payment-router transactions. */
export const oracleSolanaKeypair = loadKeypair(env.SOLANA_ORACLE_PRIVATE_KEY, 'oracle');

/** Keeper signs health-check, deleverage, and liquidation transactions. */
export const keeperSolanaKeypair = loadKeypair(env.SOLANA_KEEPER_PRIVATE_KEY, 'keeper');

export function isSolanaConfigured(): boolean {
  return env.SOLANA_RPC_URL !== 'https://api.mainnet-beta.solana.com';
}
