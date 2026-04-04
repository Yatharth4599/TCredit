import { Command } from "commander";
import { getApiUrl } from "../utils/config.js";

export const poolsCommand = new Command("pools")
  .description("List available LP pools with APY data")
  .option("--token <symbol>", "Filter by token")
  .option("--limit <n>", "Number of results", "10")
  .action(async (opts) => {
    try {
      const params = new URLSearchParams();
      if (opts.token) params.set("token", opts.token);
      params.set("limit", opts.limit);
      const qs = params.toString();
      const res = await fetch(`${getApiUrl()}/solana/trading/pools${qs ? `?${qs}` : ""}`);
      const data: any = await res.json();
      console.log(`\nLP Pools (${data.count} results)\n`);
      for (const pool of data.pools ?? []) {
        console.log(`  ${pool.protocol.padEnd(12)} ${pool.pool.padEnd(20)} APY: ${pool.apy.toFixed(1)}%  TVL: $${(pool.tvlUsd / 1e6).toFixed(1)}M`);
      }
    } catch (err: any) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  });
