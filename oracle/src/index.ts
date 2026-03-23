import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import { startScoringOracle } from "./scoring/updater.js";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const ORACLE_KEYPAIR_PATH = process.env.ORACLE_KEYPAIR_PATH ?? "~/.config/solana/id.json";
const SCORE_PROGRAM_ID = new PublicKey(
  process.env.SCORE_PROGRAM_ID ?? "KrXAscr111111111111111111111111111111111111"
);

async function main() {
  console.log("[Oracle] Starting Krexa Scoring Oracle...");
  console.log(`[Oracle] RPC: ${RPC_URL}`);
  console.log(`[Oracle] Program: ${SCORE_PROGRAM_ID.toBase58()}`);

  await startScoringOracle(RPC_URL, ORACLE_KEYPAIR_PATH, SCORE_PROGRAM_ID);
}

main().catch((err) => {
  console.error("[Oracle] Fatal error:", err);
  process.exit(1);
});
