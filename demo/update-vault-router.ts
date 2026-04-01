import 'dotenv/config';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}
function encodePubkey(k: PublicKey): Buffer { return Buffer.from(k.toBytes()); }

// Option<Pubkey>: 0x00 for None, 0x01 + 32 bytes for Some
function encodeOptionPubkey(k: PublicKey | null): Buffer {
  if (!k) return Buffer.from([0]);
  return Buffer.concat([Buffer.from([1]), encodePubkey(k)]);
}
// Option<u16>: 0x00 for None, 0x01 + 2 bytes for Some
function encodeOptionU16(n: number | null): Buffer {
  if (n === null) return Buffer.from([0]);
  const b = Buffer.alloc(3); b[0] = 1; b.writeUInt16LE(n, 1); return b;
}
// Option<i64>: 0x00 for None, 0x01 + 8 bytes for Some
function encodeOptionI64(n: bigint | null): Buffer {
  if (n === null) return Buffer.from([0]);
  const b = Buffer.alloc(9); b[0] = 1; b.writeBigInt64LE(n, 1); return b;
}

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  const admin = Keypair.fromSecretKey(Uint8Array.from(
    JSON.parse(readFileSync('/Users/yatharthkher/.config/solana/id.json', 'utf8'))
  ));
  
  const VAULT_PROGRAM = new PublicKey(process.env.VAULT_PROGRAM_ID!);
  const ROUTER_PROGRAM = new PublicKey(process.env.ROUTER_PROGRAM_ID!);
  
  const [vaultConfig] = PublicKey.findProgramAddressSync([Buffer.from('vault_config')], VAULT_PROGRAM);
  console.log('Vault config PDA:', vaultConfig.toBase58());
  
  // update_config(new_admin, new_oracle, new_wallet_program, new_router_program, new_utilization_cap_bps, new_base_rate_bps, new_lockup_seconds)
  const data = Buffer.concat([
    disc('update_config'),
    encodeOptionPubkey(null),            // new_admin: None
    encodeOptionPubkey(null),            // new_oracle: None
    encodeOptionPubkey(null),            // new_wallet_program: None
    encodeOptionPubkey(ROUTER_PROGRAM),  // new_router_program: Some(routerProgramId)
    encodeOptionU16(null),               // new_utilization_cap_bps: None
    encodeOptionU16(null),               // new_base_interest_rate_bps: None
    encodeOptionI64(null),               // new_lockup_seconds: None
  ]);
  
  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM,
    keys: [
      { pubkey: vaultConfig,       isSigner: false, isWritable: true },
      { pubkey: admin.publicKey,   isSigner: true,  isWritable: false },
    ],
    data,
  });
  
  const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [admin]);
  console.log('Done! router_program set. Tx:', sig);
}
main().catch(console.error);
