/**
 * One-shot migration: resize VaultConfig PDA from 298 → 450 bytes.
 * Run: npx tsx migrate-vault.ts
 */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const RPC = 'https://api.devnet.solana.com';
const VAULT_PROGRAM = new PublicKey('26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N');

// Load admin keypair (same as solana CLI default)
const adminPath = process.env.ADMIN_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(adminPath, 'utf8'))));

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const connection = new Connection(RPC, 'confirmed');

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_config')],
    VAULT_PROGRAM,
  );

  const acct = await connection.getAccountInfo(configPda);
  console.log(`VaultConfig PDA: ${configPda.toBase58()}`);
  console.log(`Current size: ${acct?.data.length ?? 'NOT FOUND'} bytes`);
  console.log(`Target size: 450 bytes`);
  console.log(`Admin: ${admin.publicKey.toBase58()}`);

  if (!acct) {
    console.error('VaultConfig PDA not found!');
    process.exit(1);
  }

  if (acct.data.length >= 450) {
    console.log('Already at target size — nothing to do.');
    return;
  }

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM,
    keys: [
      { pubkey: configPda,              isSigner: false, isWritable: true },
      { pubkey: admin.publicKey,        isSigner: true,  isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('migrate_config_v2'),
  });

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: admin.publicKey });
  tx.add(ix);

  console.log('Sending migrate_config_v2 transaction...');
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], { commitment: 'confirmed' });
  console.log(`Success! Tx: ${sig}`);

  // Verify
  const after = await connection.getAccountInfo(configPda);
  console.log(`New size: ${after?.data.length ?? 'ERROR'} bytes`);
}

main().catch(err => {
  console.error('Migration failed:', err.message ?? err);
  process.exit(1);
});
