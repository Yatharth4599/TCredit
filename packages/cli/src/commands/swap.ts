import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { loadKeypair, getRpcUrl } from "../utils/config.js";
import { success, header, field, divider } from "../utils/display.js";
import * as api from "../utils/api.js";

export const swapCommand = new Command("swap")
  .description("Swap tokens via Jupiter aggregator (best route across all Solana DEXs)")
  .argument("<from>", "Source token symbol (e.g. USDC, SOL)")
  .argument("<to>", "Destination token symbol (e.g. SOL, USDC)")
  .argument("<amount>", "Amount of source token (human units)")
  .option("--slippage <bps>", "Slippage tolerance in bps (default: 50)")
  .action(async (from: string, to: string, amountStr: string, opts: { slippage?: string }) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log(chalk.red("  Invalid amount. Usage: krexa swap USDC SOL 50"));
      return;
    }

    const spinner = ora("Fetching swap quote...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const agent = keypair.publicKey.toBase58();
    const slippageBps = opts.slippage ? parseInt(opts.slippage) : undefined;

    try {
      // Step 1: Get quote
      const quote = await api.getSwapQuote(agent, {
        from,
        to,
        amount,
        slippageBps,
      });

      spinner.stop();
      console.log();
      header("SWAP QUOTE");
      field("From", `${quote.from.amount} ${quote.from.symbol}`);
      field("To", `${quote.to.amount} ${quote.to.symbol}`);
      field("Price Impact", `${quote.priceImpactPct}%`);
      field("Slippage", `${quote.slippageBps} bps`);
      divider();

      // Step 2: Build and send swap tx
      spinner.start("Building swap transaction...");
      const result = await api.executeSwap(agent, {
        from,
        to,
        amount,
        slippageBps,
        ownerAddress: agent,
      });

      if (result.transaction) {
        spinner.text = "Signing and sending transaction...";
        const txBuf = Buffer.from(result.transaction, "base64");

        // Jupiter returns VersionedTransaction
        const tx = VersionedTransaction.deserialize(txBuf);
        tx.sign([keypair]);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");

        spinner.stop();
        console.log();
        success(`Swap executed: ${result.description}`);
        field("Signature", chalk.dim(sig));
      } else {
        spinner.stop();
        success(result.description ?? "Swap quote ready");
      }

      console.log();
    } catch (err: any) {
      spinner.fail(`Swap failed: ${err.message?.slice(0, 120) ?? "unknown error"}`);
    }
  });
