import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection } from "@solana/web3.js";
import BN from "bn.js";
import { loadKeypair, getRpcUrl, getNetwork, config, shortenAddress } from "../utils/config.js";
import { header, field, divider, progressBar, healthBadge } from "../utils/display.js";
import { findAgentProfile, findAgentWallet, findCreditLine, findSettlement, getAssociatedTokenAddress } from "../utils/pda.js";
import { USDC_MINT } from "../utils/constants.js";
import { deserializeAgentProfile, deserializeAgentWallet, deserializeCreditLine, deserializeMerchantSettlement, decodeName, formatUsdc, bpsToPercent } from "../utils/deserialize.js";
import { AGENT_TYPES, CREDIT_LEVELS, PROTOCOL } from "../utils/constants.js";
import * as api from "../utils/api.js";

export const statusCommand = new Command("status")
  .description("Show agent status — score, credit, wallet, health")
  .action(async () => {
    const spinner = ora("Loading agent status...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const network = getNetwork();
    const agent = keypair.publicKey;

    // Fetch profile
    const [profilePda] = findAgentProfile(agent);
    const profileInfo = await connection.getAccountInfo(profilePda);

    let agentName = config.get("agentName") as string || "Unknown";
    let agentType = config.get("agentType") as number || 0;
    let scoreVal = 350;
    let creditLevel = 1;

    if (profileInfo) {
      const profile = deserializeAgentProfile(profileInfo.data.slice(8));
      agentName = decodeName(profile.name) || agentName;
      agentType = profile.agentType;
      scoreVal = profile.creditScore || 350;
      creditLevel = profile.creditLevel || 1;
    }

    // Fetch wallet
    const [walletPda] = findAgentWallet(agent);
    const walletInfo = await connection.getAccountInfo(walletPda);

    let borrowed = new BN(0);
    let totalDebt = new BN(0);
    let walletBalance = new BN(0);
    let healthFactorBps = PROTOCOL.HF_HEALTHY;

    if (walletInfo) {
      const wallet = deserializeAgentWallet(walletInfo.data.slice(8));
      borrowed = wallet.creditDrawn;
      totalDebt = wallet.totalDebt;
      healthFactorBps = wallet.healthFactorBps || PROTOCOL.HF_HEALTHY;

      // Fetch PDA USDC balance
      try {
        const tokenInfo = await connection.getTokenAccountBalance(wallet.walletUsdc);
        walletBalance = new BN(tokenInfo.value.amount);
      } catch { /* no token account yet */ }
    }

    // Also check owner's ATA (faucet sends here)
    let ownerUsdcBalance = new BN(0);
    try {
      const ownerAta = getAssociatedTokenAddress(USDC_MINT, agent);
      const ataInfo = await connection.getTokenAccountBalance(ownerAta);
      ownerUsdcBalance = new BN(ataInfo.value.amount);
    } catch { /* no ATA yet */ }

    // Fetch credit line
    let accruedInterest = new BN(0);
    let rateBps = CREDIT_LEVELS[creditLevel]?.rateBps ?? 3650;
    const [clPda] = findCreditLine(agent);
    const clInfo = await connection.getAccountInfo(clPda);
    if (clInfo) {
      const cl = deserializeCreditLine(clInfo.data.slice(8));
      accruedInterest = cl.accruedInterest;
      rateBps = cl.interestRateBps || rateBps;
      borrowed = cl.creditDrawn;
    }

    // Try API score
    try {
      const scoreData = await api.getScore(agent.toBase58());
      scoreVal = scoreData.score ?? scoreData.components?.overall ?? scoreVal;
    } catch { /* use on-chain score */ }

    spinner.stop();

    // Display
    const levelInfo = CREDIT_LEVELS[creditLevel] ?? CREDIT_LEVELS[1];
    const nextLevel = CREDIT_LEVELS[creditLevel + 1];
    const totalOwed = borrowed.add(accruedInterest);
    const dailyCost = borrowed.muln(rateBps).divn(10000).divn(365);

    header("KREXA · Agent Status");
    field("Agent", `${agentName} (${AGENT_TYPES[agentType] ?? "Trader"})`);
    field("Address", chalk.cyan(shortenAddress(agent.toBase58(), 6)));
    field("Network", network);
    console.log();

    // Score
    const scoreMax = PROTOCOL.MAX_CREDIT_SCORE;
    const pct = Math.round((scoreVal / scoreMax) * 100);
    field("Krexit Score", chalk.cyan(String(scoreVal)) + chalk.dim(` (${levelInfo.name})`));
    if (nextLevel) {
      const pctToNext = Math.round(((scoreVal - (levelInfo.scoreMin)) / (nextLevel.scoreMin - levelInfo.scoreMin)) * 100);
      console.log(`  ${progressBar(Math.max(pctToNext, 0), 100)}  ${chalk.dim(`${Math.max(pctToNext, 0)}% to ${nextLevel.name.split(" ")[0]} (need ${nextLevel.scoreMin})`)}`);
    }
    console.log();

    // Credit
    if (!borrowed.isZero() || !totalDebt.isZero()) {
      console.log(chalk.bold.white("  Credit Line:"));
      field("Borrowed", chalk.white(formatUsdc(borrowed) + " USDC"));
      field("Interest", chalk.dim(formatUsdc(accruedInterest) + " accrued"));
      field("Total Owed", chalk.yellow(formatUsdc(totalOwed) + " USDC"));
      field("Daily Cost", chalk.dim(formatUsdc(dailyCost)));
      field("Rate", `${bpsToPercent(rateBps)} APR`);
      console.log();
    }

    // Wallet
    const totalUsdc = walletBalance.add(ownerUsdcBalance);
    console.log(chalk.bold.white("  Wallet:"));
    if (!ownerUsdcBalance.isZero() && !walletBalance.isZero()) {
      field("PDA USDC", chalk.white(formatUsdc(walletBalance)));
      field("Owner USDC", chalk.white(formatUsdc(ownerUsdcBalance)));
      field("Total USDC", chalk.green(formatUsdc(totalUsdc)));
    } else {
      field("USDC", chalk.white(formatUsdc(totalUsdc)));
    }
    console.log();

    // Revenue Router
    const [settlementPda] = findSettlement(agent);
    const settlementInfo = await connection.getAccountInfo(settlementPda);
    if (settlementInfo) {
      const settlement = deserializeMerchantSettlement(settlementInfo.data.slice(8));
      if (!settlement.totalRouted.isZero()) {
        console.log(chalk.bold.white("  Revenue Router:"));
        field("Total Routed", chalk.green(formatUsdc(settlement.totalRouted) + " USDC"));
        field("Auto-Repaid", chalk.cyan(formatUsdc(settlement.totalRepaid) + " USDC"));
        field("You Received", chalk.white(formatUsdc(settlement.totalMerchantReceived) + " USDC"));
        console.log();
      }
    }

    field("Health", healthBadge(healthFactorBps));
    divider();
    console.log(`  ${chalk.cyan("krexa repay 50")}       Repay $50`);
    console.log(`  ${chalk.cyan("krexa borrow 100")}     Borrow more`);
    console.log(`  ${chalk.cyan("krexa score")}          Score breakdown`);
    console.log();
  });
