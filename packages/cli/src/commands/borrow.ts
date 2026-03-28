import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection, Transaction } from "@solana/web3.js";
import { loadKeypair, getRpcUrl, getNetwork } from "../utils/config.js";
import { success, warn, header, field, divider } from "../utils/display.js";
import { CREDIT_LEVELS, PROTOCOL } from "../utils/constants.js";
import { findAgentProfile } from "../utils/pda.js";
import { deserializeAgentProfile, bpsToPercent } from "../utils/deserialize.js";
import * as api from "../utils/api.js";

export const borrowCommand = new Command("borrow")
  .description("Borrow USDC from the Krexa vault")
  .argument("<amount>", "Amount in USDC (e.g. 500)")
  .action(async (amountStr: string) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log(chalk.red("  Invalid amount. Usage: krexa borrow 500"));
      return;
    }

    const spinner = ora("Requesting credit...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const agent = keypair.publicKey;

    // Get agent profile for credit level
    let creditLevel = 1;
    const [profilePda] = findAgentProfile(agent);
    const profileInfo = await connection.getAccountInfo(profilePda);
    if (profileInfo) {
      const profile = deserializeAgentProfile(profileInfo.data.slice(8));
      creditLevel = profile.creditLevel || 1;
    }

    const levelInfo = CREDIT_LEVELS[creditLevel] ?? CREDIT_LEVELS[1];
    if (amount > levelInfo.maxCredit) {
      spinner.fail(`Amount exceeds max credit for ${levelInfo.name}: $${levelInfo.maxCredit.toLocaleString()}`);
      return;
    }

    // Request oracle co-signed credit transaction
    try {
      spinner.text = "Oracle approving credit request...";
      const amountLamports = Math.round(amount * PROTOCOL.USDC_ONE);
      const result = await api.signCredit({
        agentPubkey: agent.toBase58(),
        agentOrOwnerPubkey: agent.toBase58(),
        amount: String(amountLamports),
        rateBps: levelInfo.rateBps,
        creditLevel,
        collateralValueUsdc: "0",
      });

      if (result.transaction) {
        spinner.text = "Sending transaction to Solana...";
        const txBuf = Buffer.from(result.transaction, "base64");
        const tx = Transaction.from(txBuf);
        tx.partialSign(keypair);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");
      }

      spinner.stop();
      console.log();
      success("Oracle approved credit request");
      success(`Credit line opened: ${chalk.green(`$${amount.toFixed(2)}`)} USDC`);
      console.log();

      const dailyCost = (amount * levelInfo.rateBps / 10000 / 365);

      console.log(chalk.bold.white("  Terms:"));
      field("Amount", chalk.white(`$${amount.toFixed(2)} USDC`));
      field("Rate", `${bpsToPercent(levelInfo.rateBps)} APR (${(levelInfo.rateBps / 365 / 100).toFixed(2)}%/day)`);
      field("Daily Cost", chalk.dim(`$${dailyCost.toFixed(2)}`));
      field("Level", levelInfo.name);
      field("NAV Trigger", "90%");
      console.log();
      console.log(`  Your wallet now has ${chalk.green(`$${amount.toFixed(2)}`)} USDC.`);
      console.log();
      warn("Repayment is automatic via Revenue Router.");
      console.log(chalk.dim("    Every dollar of revenue flows through Krexa first."));
      console.log();
    } catch (err: any) {
      spinner.fail(`Credit request failed: ${err.message?.slice(0, 100) ?? "unknown error"}`);
    }
  });
