import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { header, divider } from "../utils/display.js";
import * as api from "../utils/api.js";

export const yieldCommand = new Command("yield")
  .description("Show top yield opportunities on Solana")
  .option("--limit <n>", "Number of results (default: 20)")
  .option("--min-tvl <usd>", "Minimum TVL in USD")
  .option("--token <symbol>", "Filter by token (e.g. SOL, USDC)")
  .action(async (opts: { limit?: string; minTvl?: string; token?: string }) => {
    const spinner = ora("Scanning yield opportunities...").start();

    try {
      const data = await api.scanYields({
        limit: opts.limit ? parseInt(opts.limit) : undefined,
        minTvl: opts.minTvl ? parseFloat(opts.minTvl) : undefined,
        token: opts.token,
      });

      spinner.stop();
      console.log();
      header("YIELD OPPORTUNITIES");
      console.log();

      if (data.opportunities.length === 0) {
        console.log(chalk.dim("  No yield opportunities found."));
      } else {
        // Table header
        console.log(
          chalk.dim("  ") +
          chalk.bold.white("Protocol".padEnd(16)) +
          chalk.bold.white("Pool".padEnd(20)) +
          chalk.bold.white("APY".padEnd(10)) +
          chalk.bold.white("TVL")
        );
        divider();

        for (const y of data.opportunities) {
          const tvl = y.tvlUsd >= 1e6
            ? `$${(y.tvlUsd / 1e6).toFixed(1)}M`
            : `$${(y.tvlUsd / 1e3).toFixed(0)}K`;

          console.log(
            "  " +
            chalk.white(y.protocol.padEnd(16)) +
            chalk.white(y.pool.slice(0, 18).padEnd(20)) +
            chalk.green(`${y.apy.toFixed(2)}%`.padEnd(10)) +
            chalk.dim(tvl)
          );
        }

        console.log();
        console.log(chalk.dim(`  ${data.count} results · Source: DeFi Llama`));
      }

      console.log();
    } catch (err: any) {
      spinner.fail(`Yield scan failed: ${err.message?.slice(0, 120) ?? "unknown error"}`);
    }
  });
