import 'dotenv/config';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction, createMintToInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { readFileSync } from 'fs';

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  const USDC_MINT = new PublicKey(process.env.SOLANA_USDC_MINT!);

  const mintData = JSON.parse(readFileSync('../solana-programs/scripts/usdc-mint.json', 'utf8'));
  const mintAuthority = Keypair.fromSecretKey(Uint8Array.from(mintData.mintAuthority));
  const oracle = Keypair.fromSecretKey(Uint8Array.from(
    JSON.parse(readFileSync('../solana-programs/scripts/oracle-keypair.json', 'utf8'))
  ));
  const owner = Keypair.fromSecretKey(Uint8Array.from(
    JSON.parse(readFileSync('./keys/owner.json', 'utf8'))
  ));

  const oracleAta = getAssociatedTokenAddressSync(USDC_MINT, oracle.publicKey);
  console.log('Oracle:', oracle.publicKey.toBase58());
  console.log('Oracle ATA:', oracleAta.toBase58());

  const tx = new Transaction();

  const ataInfo = await conn.getAccountInfo(oracleAta);
  if (!ataInfo) {
    console.log('Creating oracle ATA...');
    tx.add(createAssociatedTokenAccountInstruction(
      owner.publicKey,
      oracleAta,
      oracle.publicKey,
      USDC_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
  } else {
    console.log('Oracle ATA already exists');
  }

  tx.add(createMintToInstruction(USDC_MINT, oracleAta, mintAuthority.publicKey, 100_000_000));

  const sig = await sendAndConfirmTransaction(conn, tx, [owner, mintAuthority]);
  console.log('Done! Tx:', sig);

  const bal = await conn.getTokenAccountBalance(oracleAta);
  console.log('Oracle USDC balance:', bal.value.uiAmountString);
}
main().catch(console.error);