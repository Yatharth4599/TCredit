import { Connection } from "@solana/web3.js";
import { KrexaClient } from "@krexa/solana-sdk";

let client: KrexaClient | null = null;

export function getKrexaClient(): KrexaClient {
  if (!client) {
    const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    client = new KrexaClient({ connection });
  }
  return client;
}
