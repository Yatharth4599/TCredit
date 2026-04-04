import { Command } from "commander";
import { getApiUrl } from "../utils/config.js";
import { loadKeypair } from "../utils/config.js";

export const historyCommand = new Command("history")
  .description("View agent transaction history")
  .option("--limit <n>", "Number of transactions", "20")
  .option("--type <type>", "Filter: all, swaps, lp, credit, revenue", "all")
  .action(async (opts) => {
    try {
      const keypair = loadKeypair();
      const agent = keypair.publicKey.toBase58();
      const params = new URLSearchParams();
      params.set("limit", opts.limit);
      if (opts.type !== "all") params.set("type", opts.type);
      const res = await fetch(`${getApiUrl()}/solana/wallets/${agent}/history?${params.toString()}`);
      const data: any = await res.json();
      console.log(`\nTransaction History (${data.transactions?.length ?? 0} results)\n`);
      for (const tx of data.transactions ?? []) {
        console.log(`  ${tx.type.padEnd(10)} ${tx.amount ?? ''} ${tx.description ?? ''} ${tx.timestamp ?? ''}`);
      }
    } catch (err: any) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  });
