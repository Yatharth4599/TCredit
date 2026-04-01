import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import { startScoringOracle } from "./scoring/updater.js";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
// Cloud: base58-encoded private key via env var; Local: path to keypair JSON file
const ORACLE_KEYPAIR_BASE58 = process.env.SOLANA_ORACLE_PRIVATE_KEY ?? "";
const ORACLE_KEYPAIR_PATH = process.env.ORACLE_KEYPAIR_PATH ?? "~/.config/solana/id.json";
const SCORE_PROGRAM_ID = new PublicKey(
  process.env.SOLANA_SCORE_PROGRAM_ID ?? process.env.SCORE_PROGRAM_ID ?? "2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh"
);
const REGISTRY_PROGRAM_ID = new PublicKey(
  process.env.SOLANA_REGISTRY_PROGRAM_ID ?? process.env.REGISTRY_PROGRAM_ID ?? "ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG"
);
const WALLET_PROGRAM_ID = new PublicKey(
  process.env.SOLANA_WALLET_PROGRAM_ID ?? process.env.WALLET_PROGRAM_ID ?? "35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6"
);
const VAULT_PROGRAM_ID = new PublicKey(
  process.env.SOLANA_VAULT_PROGRAM_ID ?? process.env.VAULT_PROGRAM_ID ?? "26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N"
);

async function main() {
  console.log("[Oracle] Starting Krexa Scoring Oracle...");
  console.log(`[Oracle] RPC: ${RPC_URL}`);
  console.log(`[Oracle] Score Program: ${SCORE_PROGRAM_ID.toBase58()}`);
  console.log(`[Oracle] Registry Program: ${REGISTRY_PROGRAM_ID.toBase58()}`);
  console.log(`[Oracle] Wallet Program: ${WALLET_PROGRAM_ID.toBase58()}`);
  console.log(`[Oracle] Vault Program: ${VAULT_PROGRAM_ID.toBase58()}`);
  console.log('[Oracle] Oracle keypair loaded successfully');

  await startScoringOracle(
    RPC_URL,
    ORACLE_KEYPAIR_PATH,
    SCORE_PROGRAM_ID,
    {
      registry: REGISTRY_PROGRAM_ID,
      wallet: WALLET_PROGRAM_ID,
      vault: VAULT_PROGRAM_ID,
    },
    ORACLE_KEYPAIR_BASE58 || undefined,
  );
}

main().catch((err) => {
  console.error("[Oracle] Fatal error:", err);
  process.exit(1);
});
