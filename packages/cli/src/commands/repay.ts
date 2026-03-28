import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection } from "@solana/web3.js";
import BN from "bn.js";
import { loadKeypair, getRpcUrl } from "../utils/config.js";
import { success, header, field, divider } from "../utils/display.js";
import { findCreditLine, findAgentWallet, getAssociatedTokenAddress } from "../utils/pda.js";
import { deserializeCreditLine, deserializeAgentWallet, formatUsdc } from "../utils/deserialize.js";
import { buildRepay } from "../utils/transactions.js";
import { USDC_MINT, PROTOCOL } from "../utils/constants.js";

export const repayCommand = new Command("repay")
  .description("Repay credit line debt")
  .argument("<amount>", "Amount in USDC (or 'all' for full repayment)")
  .action(async (amountStr: string) => {
    const spinner = ora("Preparing repayment...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const agent = keypair.publicKey;

    // Fetch credit line to know how much is owed
    const [clPda] = findCreditLine(agent);
    const clInfo = await connection.getAccountInfo(clPda);
    if (!clInfo) {
      spinner.fail("No active credit line found. Nothing to repay.");
      return;
    }

    const cl = deserializeCreditLine(clInfo.data.slice(8));
    const totalOwed = cl.creditDrawn.add(cl.accruedInterest);

    let repayAmount: BN;
    if (amountStr.toLowerCase() === "all") {
      repayAmount = totalOwed;
    } else {
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        spinner.fail("Invalid amount. Usage: krexa repay 50  or  krexa repay all");
        return;
      }
      repayAmount = new BN(Math.round(amount * PROTOCOL.USDC_ONE));
    }

    if (repayAmount.gt(totalOwed)) {
      repayAmount = totalOwed;
    }

    // Get caller's USDC ATA
    const callerUsdc = getAssociatedTokenAddress(USDC_MINT, agent);

    spinner.text = `Repaying ${formatUsdc(repayAmount)} USDC...`;

    try {
      const tx = buildRepay(agent, agent, callerUsdc, repayAmount);
      tx.feePayer = keypair.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(keypair);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      spinner.stop();
      console.log();
      success(`Repaid ${chalk.green(formatUsdc(repayAmount))} USDC`);

      const remaining = totalOwed.sub(repayAmount);
      if (remaining.isZero()) {
        success("Credit line fully repaid!");
      } else {
        console.log(chalk.dim(`  Remaining debt: ${formatUsdc(remaining)} USDC`));
      }
      console.log();
    } catch (err: any) {
      spinner.fail(`Repayment failed: ${err.message?.slice(0, 100) ?? "unknown error"}`);
    }
  });
