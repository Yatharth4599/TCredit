import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { loadKeypair, shortenAddress } from "../utils/config.js";
import { success } from "../utils/display.js";
import * as api from "../utils/api.js";

export const faucetCommand = new Command("faucet")
  .description("Get test USDC on devnet (max 100 USDC per 24h)")
  .option("-a, --amount <amount>", "Amount in USDC (default 100, max 100)", "100")
  .action(async (opts) => {
    const amount = Math.min(parseFloat(opts.amount) || 100, 100);
    const spinner = ora(`Requesting ${amount} test USDC from faucet...`).start();
    const keypair = loadKeypair();

    try {
      const result = await api.requestFaucet(keypair.publicKey.toBase58(), amount);
      spinner.stop();
      console.log();
      success(`Minted ${chalk.green(`$${amount}`)} test USDC`);
      console.log(chalk.dim(`  To: ${shortenAddress(keypair.publicKey.toBase58(), 6)}`));
      if (result.signature) {
        console.log(chalk.dim(`  Tx: ${result.signature}`));
      }
      if (result.explorerUrl) {
        console.log(chalk.dim(`  Explorer: ${result.explorerUrl}`));
      }
      console.log();
    } catch (err: any) {
      spinner.fail(`Faucet error: ${err.message?.slice(0, 100) ?? "failed"}`);
      console.log(chalk.dim("  Rate limit: 1 request per 24 hours per address"));
    }
  });
