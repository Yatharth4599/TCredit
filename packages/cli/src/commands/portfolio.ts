import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { loadKeypair } from "../utils/config.js";
import { header, field, divider } from "../utils/display.js";
import * as api from "../utils/api.js";

export const portfolioCommand = new Command("portfolio")
  .description("Show token portfolio with USD values")
  .action(async () => {
    const spinner = ora("Fetching portfolio...").start();
    const keypair = loadKeypair();
    const agent = keypair.publicKey.toBase58();

    try {
      const data = await api.getPortfolio(agent);

      spinner.stop();
      console.log();
      header("PORTFOLIO");
      console.log();

      if (data.tokens.length === 0) {
        console.log(chalk.dim("  No tokens found in wallet."));
      } else {
        // Table header
        console.log(
          chalk.dim("  ") +
          chalk.bold.white("Token".padEnd(10)) +
          chalk.bold.white("Balance".padEnd(18)) +
          chalk.bold.white("Price".padEnd(14)) +
          chalk.bold.white("Value")
        );
        divider();

        for (const t of data.tokens) {
          const balance = parseFloat(t.balance);
          const price = parseFloat(t.price);
          const usd = parseFloat(t.balanceUsd);
          console.log(
            "  " +
            chalk.white(t.symbol.padEnd(10)) +
            chalk.white(balance.toFixed(4).padEnd(18)) +
            chalk.dim(`$${price.toFixed(4)}`.padEnd(14)) +
            chalk.green(`$${usd.toFixed(2)}`)
          );
        }

        divider();
        field("Total Value", chalk.bold.green(`$${data.totalValueUsd}`));
      }

      console.log();
    } catch (err: any) {
      spinner.fail(`Portfolio fetch failed: ${err.message?.slice(0, 120) ?? "unknown error"}`);
    }
  });
