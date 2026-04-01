import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection } from "@solana/web3.js";
import { loadKeypair, getRpcUrl } from "../utils/config.js";
import { success } from "../utils/display.js";
import { findSettlement } from "../utils/pda.js";
import { deserializeMerchantSettlement } from "../utils/deserialize.js";
import * as api from "../utils/api.js";

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

    const splitBps = parseInt(opts.split) || 4000;

    // Settlement activation requires oracle co-signature via the backend API,
    // following the same pattern as borrow (api.signCredit).
    spinner.text = "Requesting settlement activation from backend...";

    try {
      const result = await api.activateSettlement({
        agentPubkey: agent.toBase58(),
        splitBps,
      });

      if (result.transaction) {
        spinner.text = "Sending transaction to Solana...";
        const { Transaction } = await import("@solana/web3.js");
        const txBuf = Buffer.from(result.transaction, "base64");
        const tx = Transaction.from(txBuf);
        tx.partialSign(keypair);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        spinner.succeed(`Settlement activated (${(splitBps / 100).toFixed(0)}% auto-repay)`);
        success("Revenue Router is now active for your agent");
        console.log(chalk.dim("  Incoming x402 payments will auto-repay your credit line."));
      } else {
        // Backend acknowledged but no transaction returned — endpoint may not be deployed yet
        spinner.fail(
          "Settlement activation requires backend oracle co-signature. " +
          "Use the API directly: POST /api/v1/solana/oracle/activate-settlement"
        );
      }
    } catch (err: any) {
      if (err.message?.includes("404") || err.message?.includes("not found")) {
        spinner.fail(
          "Settlement activation endpoint not yet deployed on backend. " +
          "Use the API directly when available: POST /api/v1/solana/oracle/activate-settlement"
        );
      } else {
        spinner.fail(`Settlement activation failed: ${err.message?.slice(0, 100) ?? "unknown"}`);
      }
    }
  });
