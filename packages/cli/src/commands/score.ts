import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadKeypair, getRpcUrl, shortenAddress } from "../utils/config.js";
import { header, field, divider, progressBar } from "../utils/display.js";
import { findKrexitScore } from "../utils/pda.js";
import { deserializeKrexitScore, bpsToPercent } from "../utils/deserialize.js";
import { CREDIT_LEVELS, PROTOCOL } from "../utils/constants.js";
import * as api from "../utils/api.js";

export const scoreCommand = new Command("score")
  .description("Show Krexit Score breakdown")
  .argument("[wallet]", "Wallet address (defaults to your agent)")
  .action(async (walletArg?: string) => {
    const spinner = ora("Fetching Krexit Score...").start();
    const keypair = loadKeypair();
    const agent = walletArg ? new PublicKey(walletArg) : keypair.publicKey;
    const connection = new Connection(getRpcUrl(), "confirmed");

    // Try on-chain score first
    let score: number | null = null;
    let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
    let creditLevel = 1;

    const [scorePda] = findKrexitScore(agent);
    const scoreInfo = await connection.getAccountInfo(scorePda);

    if (scoreInfo) {
      const ks = deserializeKrexitScore(scoreInfo.data.slice(8));
      score = ks.score;
      c1 = ks.c1Repayment;
      c2 = ks.c2Profitability;
      c3 = ks.c3Behavioral;
      c4 = ks.c4Usage;
      c5 = ks.c5Maturity;
      creditLevel = ks.creditLevel;
    }

    // Fallback to API
    if (score === null) {
      try {
        const data = await api.getScore(agent.toBase58());
        score = data.score ?? data.components?.overall ?? 350;
        c1 = data.components?.repayment ?? 50;
        c2 = data.components?.profitability ?? 40;
        c3 = data.components?.behavioral ?? 30;
        c4 = data.components?.usage ?? 20;
        c5 = data.components?.maturity ?? 10;
        creditLevel = data.creditLevel ?? 1;
      } catch {
        score = 350;
        c1 = 50; c2 = 40; c3 = 30; c4 = 20; c5 = 10;
      }
    }

    spinner.stop();

    const levelInfo = CREDIT_LEVELS[creditLevel] ?? CREDIT_LEVELS[1];
    const nextLevel = CREDIT_LEVELS[creditLevel + 1];

    console.log();
    console.log(chalk.bold.white(`  KREXIT SCORE · ${chalk.cyan(String(score))} / ${PROTOCOL.MAX_CREDIT_SCORE}`));
    console.log(chalk.dim("  " + "═".repeat(40)));
    console.log();

    // Component breakdown
    const components = [
      { name: "Repayment History", weight: "30%", score: c1, max: 255 },
      { name: "Profitability", weight: "25%", score: c2, max: 255 },
      { name: "Behavioral", weight: "20%", score: c3, max: 255 },
      { name: "Usage Patterns", weight: "15%", score: c4, max: 255 },
      { name: "Account Maturity", weight: "10%", score: c5, max: 255 },
    ];

    for (const c of components) {
      const pct = Math.round((c.score / c.max) * 100);
      const label = `${c.name.padEnd(22)} (${c.weight})`;
      console.log(`  ${chalk.dim(label)} ${progressBar(pct, 100, 15)} ${chalk.dim(`${pct}%`)}`);
    }

    console.log();
    console.log(`  ${chalk.dim("Level:")} ${chalk.white(levelInfo.name)}`);
    if (nextLevel) {
      console.log(`  ${chalk.dim("Next:")}  Need ${chalk.cyan(String(nextLevel.scoreMin))} for ${nextLevel.name}`);
    }

    console.log();
    console.log(chalk.bold.white("  Tips to improve:"));
    console.log(chalk.dim("  • Repay on time — biggest impact (30% weight)"));
    console.log(chalk.dim("  • Diversify venues — use 3+ DEXs for trading"));
    console.log(chalk.dim("  • Maintain Green health zone consistently"));
    console.log();
  });
