import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection } from "@solana/web3.js";
import { loadKeypair, getRpcUrl } from "../utils/config.js";
import { header, field, divider } from "../utils/display.js";
import { findSettlement } from "../utils/pda.js";
import { deserializeMerchantSettlement, formatUsdc } from "../utils/deserialize.js";

export const revenueCommand = new Command("revenue")
  .description("Revenue Router — settlement stats and payment splits")
  .action(async () => {
    const spinner = ora("Loading revenue data...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const agent = keypair.publicKey;

    const [settlementPda] = findSettlement(agent);
    const info = await connection.getAccountInfo(settlementPda);

    spinner.stop();

    if (!info) {
      console.log();
      console.log(chalk.yellow("  No settlement found for this agent."));
      console.log(chalk.dim("  Revenue routing is not yet activated."));
      console.log();
      console.log(chalk.dim("  To activate:"));
      console.log(`  ${chalk.cyan("krexa settle")}   Activate revenue routing`);
      console.log();
      return;
    }

    const settlement = deserializeMerchantSettlement(info.data.slice(8));

    header("KREXA · Revenue Router");
    field("Agent", chalk.cyan(agent.toBase58().slice(0, 10) + "..."));
    field("Status", settlement.isActive ? chalk.green("Active") : chalk.red("Inactive"));
    field("Credit Routing", settlement.hasActiveCredit ? chalk.cyan("Enabled") : chalk.dim("Disabled"));
    field("Repay Split", chalk.white(`${(settlement.splitBps / 100).toFixed(1)}%`));
    console.log();

    console.log(chalk.bold.white("  Lifetime Stats:"));
    field("Total Routed", chalk.green(formatUsdc(settlement.totalRouted) + " USDC"));
    field("Auto-Repaid", chalk.cyan(formatUsdc(settlement.totalRepaid) + " USDC"));
    field("You Received", chalk.white(formatUsdc(settlement.totalMerchantReceived) + " USDC"));
    field("Nonce", chalk.dim(settlement.nonce.toString()));

    if (!settlement.totalRouted.isZero()) {
      const repaidPct = settlement.totalRepaid.muln(10000).div(settlement.totalRouted).toNumber() / 100;
      const receivedPct = settlement.totalMerchantReceived.muln(10000).div(settlement.totalRouted).toNumber() / 100;
      console.log();
      console.log(chalk.bold.white("  Split Breakdown:"));
      console.log(chalk.dim(`    Auto-repaid:  ${repaidPct.toFixed(1)}% of revenue`));
      console.log(chalk.dim(`    You received: ${receivedPct.toFixed(1)}% of revenue`));
    }

    divider();
    console.log(`  ${chalk.cyan("krexa status")}         Full agent status`);
    console.log(`  ${chalk.cyan("krexa settle --split 40")}  Change repay split`);
    console.log();
  });
