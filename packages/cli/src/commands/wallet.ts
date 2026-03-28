import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import { loadKeypair, getRpcUrl, shortenAddress } from "../utils/config.js";
import { header, field, divider } from "../utils/display.js";
import { findAgentWallet, findWalletUsdc, getAssociatedTokenAddress } from "../utils/pda.js";
import { deserializeAgentWallet, formatUsdc } from "../utils/deserialize.js";
import { USDC_MINT } from "../utils/constants.js";

export const walletCommand = new Command("wallet")
  .description("Show PDA wallet balance and details")
  .action(async () => {
    const spinner = ora("Fetching wallet...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const agent = keypair.publicKey;

    // SOL balance
    const solBalance = await connection.getBalance(agent);

    // Wallet PDA
    const [walletPda] = findAgentWallet(agent);
    const walletInfo = await connection.getAccountInfo(walletPda);

    let walletUsdcBalance = new BN(0);
    let ownerUsdcBalance = new BN(0);

    if (walletInfo) {
      const wallet = deserializeAgentWallet(walletInfo.data.slice(8));
      try {
        const tokenInfo = await connection.getTokenAccountBalance(wallet.walletUsdc);
        walletUsdcBalance = new BN(tokenInfo.value.amount);
      } catch { /* empty */ }
    }

    // Owner's ATA balance
    try {
      const ownerAta = getAssociatedTokenAddress(USDC_MINT, agent);
      const tokenInfo = await connection.getTokenAccountBalance(ownerAta);
      ownerUsdcBalance = new BN(tokenInfo.value.amount);
    } catch { /* empty */ }

    spinner.stop();

    header("KREXA · Wallet");
    field("Address", chalk.cyan(agent.toBase58()));
    field("PDA Wallet", chalk.cyan(shortenAddress(walletPda.toBase58(), 6)));
    console.log();
    field("SOL", chalk.white(`${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`));
    field("PDA USDC", chalk.white(formatUsdc(walletUsdcBalance)));
    field("Owner USDC", chalk.white(formatUsdc(ownerUsdcBalance)));
    field("Total USDC", chalk.green(formatUsdc(walletUsdcBalance.add(ownerUsdcBalance))));
    divider();
    console.log(`  ${chalk.cyan("krexa faucet")}         Get test USDC`);
    console.log(`  ${chalk.cyan("krexa borrow 500")}     Borrow USDC`);
    console.log();
  });
