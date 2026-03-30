import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection } from "@solana/web3.js";
import { loadKeypair, getRpcUrl } from "../utils/config.js";
import { success } from "../utils/display.js";
import { findSettlement, findAgentWallet, findCreditLine } from "../utils/pda.js";
import { deserializeMerchantSettlement } from "../utils/deserialize.js";
import { buildActivateSettlement } from "../utils/transactions.js";
import { ORACLE_KEYPAIR } from "../utils/constants.js";

export const settleCommand = new Command("settle")
  .description("Activate Revenue Router settlement for your agent")
  .option("--split <bps>", "Repayment split in basis points (default 4000 = 40%)", "4000")
  .action(async (opts) => {
    const spinner = ora("Checking settlement...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const agent = keypair.publicKey;

    // Check if settlement exists
    const [settlementPda] = findSettlement(agent);
    const existing = await connection.getAccountInfo(settlementPda);

    if (existing) {
      const settlement = deserializeMerchantSettlement(existing.data.slice(8));
      spinner.succeed("Settlement already active");
      console.log(chalk.dim(`  Split: ${(settlement.splitBps / 100).toFixed(1)}%`));
      console.log(chalk.dim(`  Total routed: ${settlement.totalRouted.toString()}`));
      return;
    }

    // Check if agent has active credit
    const [clPda] = findCreditLine(agent);
    const clInfo = await connection.getAccountInfo(clPda);
    const hasActiveCredit = clInfo !== null;

    const [agentWalletPda] = findAgentWallet(agent);
    const splitBps = parseInt(opts.split) || 4000;

    spinner.text = "Activating settlement...";

    try {
      const tx = buildActivateSettlement(
        ORACLE_KEYPAIR.publicKey,
        agent,
        agentWalletPda,
        splitBps,
        hasActiveCredit,
      );
      tx.feePayer = ORACLE_KEYPAIR.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(ORACLE_KEYPAIR);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      spinner.succeed(`Settlement activated (${(splitBps / 100).toFixed(0)}% auto-repay)`);
      success("Revenue Router is now active for your agent");
      console.log(chalk.dim("  Incoming x402 payments will auto-repay your credit line."));
    } catch (err: any) {
      spinner.fail(`Settlement activation failed: ${err.message?.slice(0, 100) ?? "unknown"}`);
    }
  });
