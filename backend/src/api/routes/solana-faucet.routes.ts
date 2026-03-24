/**
 * Devnet USDC Faucet — mint test USDC to any wallet
 *
 * POST /api/v1/solana/faucet/usdc  — mint test USDC to recipient
 *
 * Rate limited to 1 request per address per 24 hours.
 * Max 100 USDC per request.
 */

import { Router } from 'express';
import {
  PublicKey, Keypair, Transaction,
  SystemProgram, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { solanaConnection } from '../../chain/solana/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../../config/env.js';

const router = Router();

// Simple in-memory rate limit: address → last mint timestamp
const recentMints = new Map<string, number>();
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_USDC = 100_000_000; // 100 USDC (6 decimals)

// Token program IDs
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

function parsePubkey(raw: string): PublicKey {
  try { return new PublicKey(raw); }
  catch { throw new AppError(400, `Invalid Solana public key: ${raw}`); }
}

function loadFaucetKeypair(): Keypair {
  const raw = env.SOLANA_FAUCET_PRIVATE_KEY;
  if (!raw) throw new AppError(503, 'Faucet not configured (SOLANA_FAUCET_PRIVATE_KEY missing)');
  try {
    let kp: Keypair;
    if (raw.startsWith('[')) {
      kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
    } else {
      const decoded = bs58.decode(raw);
      kp = Keypair.fromSecretKey(decoded);
    }
    if (env.NODE_ENV !== 'production') {
      console.log('[Faucet] keypair loaded, pubkey:', kp.publicKey.toBase58());
    }
    return kp;
  } catch (e) {
    console.error('[Faucet] keypair load error:', e);
    throw new AppError(503, 'Faucet keypair is invalid');
  }
}

function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

// MintTo instruction data (SPL Token)
function buildMintToIx(mint: PublicKey, dest: PublicKey, authority: PublicKey, amount: bigint): Transaction {
  // SPL Token mint_to discriminator = 7
  const data = Buffer.alloc(9);
  data.writeUInt8(7, 0);
  data.writeBigUInt64LE(amount, 1);

  const mintToIx = {
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint,      isSigner: false, isWritable: true },
      { pubkey: dest,      isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true,  isWritable: false },
    ],
    data,
  };

  return mintToIx as unknown as Transaction;
}

// Create ATA instruction (idempotent — fails silently if already exists)
function buildCreateAtaIx(mint: PublicKey, owner: PublicKey, payer: PublicKey, ata: PublicKey) {
  return {
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer,                    isSigner: true,  isWritable: true  },
      { pubkey: ata,                      isSigner: false, isWritable: true  },
      { pubkey: owner,                    isSigner: false, isWritable: false },
      { pubkey: mint,                     isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,         isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,       isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  };
}

/**
 * POST /api/v1/solana/faucet/usdc
 * Body: { recipient: string, amountUsdc?: number }
 * Response: { signature, ata, amountUsdc }
 */
router.post('/usdc', async (req, res, next) => {
  try {
    const { recipient, amountUsdc = 10 } = req.body;
    if (!recipient) throw new AppError(400, 'recipient pubkey required');

    // BUG-089 fix: validate amount type and bounds
    if (typeof amountUsdc !== 'number' || !Number.isFinite(amountUsdc) || amountUsdc <= 0 || amountUsdc > 100) {
      throw new AppError(400, 'amountUsdc must be a positive number (max 100)');
    }

    const recipientPk = parsePubkey(recipient);
    // BUG-091 fix: normalize pubkey to canonical base58 before rate limit check
    const normalizedKey = recipientPk.toBase58();

    // Rate limit check
    const lastMint = recentMints.get(normalizedKey);
    if (lastMint && Date.now() - lastMint < RATE_LIMIT_MS) {
      const nextMintAt = new Date(lastMint + RATE_LIMIT_MS).toISOString();
      throw new AppError(429, `Rate limit: this address can request again after ${nextMintAt}`);
    }

    const amount = BigInt(Math.min(Math.floor(amountUsdc * 1_000_000), MAX_USDC));
    if (amount <= 0n) throw new AppError(400, 'amountUsdc must be positive (max 100)');

    const faucetKeypair = loadFaucetKeypair();
    const usdcMint = new PublicKey(env.SOLANA_USDC_MINT);
    const recipientAta = findAta(usdcMint, recipientPk);

    // Check if ATA exists
    const ataInfo = await solanaConnection.getAccountInfo(recipientAta);

    const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: faucetKeypair.publicKey });

    // Create ATA if it doesn't exist
    if (!ataInfo) {
      tx.add(buildCreateAtaIx(usdcMint, recipientPk, faucetKeypair.publicKey, recipientAta) as never);
    }

    // Mint tokens
    tx.add(buildMintToIx(usdcMint, recipientAta, faucetKeypair.publicKey, amount) as never);
    tx.sign(faucetKeypair);

    const signature = await solanaConnection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await solanaConnection.confirmTransaction(signature, 'confirmed');

    // Record rate limit (BUG-091: use normalized key)
    recentMints.set(normalizedKey, Date.now());

    res.json({
      signature,
      ata: recipientAta.toBase58(),
      amountUsdc: Number(amount) / 1_000_000,
      mint: usdcMint.toBase58(),
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
