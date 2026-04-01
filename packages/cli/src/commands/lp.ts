import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Connection } from "@solana/web3.js";
import BN from "bn.js";
import { loadKeypair, getRpcUrl, shortenAddress } from "../utils/config.js";
import { header, field, divider } from "../utils/display.js";
import { findLpDeposit, findVaultConfig, getAssociatedTokenAddress } from "../utils/pda.js";
import { deserializeDepositPosition, deserializeVaultConfig, formatUsdc, bpsToPercent } from "../utils/deserialize.js";
import { buildDepositLP, buildWithdrawLP } from "../utils/transactions.js";
import { USDC_MINT, PROTOCOL } from "../utils/constants.js";

const TRANCHE_NAMES = ["Senior", "Mezzanine", "Junior"];
const TRANCHE_APR = [PROTOCOL.SENIOR_APR_BPS, PROTOCOL.MEZZANINE_APR_BPS, PROTOCOL.JUNIOR_APR_BPS];

function parseTranche(input: string): number {
  const lower = input.toLowerCase();
  if (lower === "senior" || lower === "0") return 0;
  if (lower === "mezzanine" || lower === "mezz" || lower === "1") return 1;
  if (lower === "junior" || lower === "2") return 2;
  throw new Error(`Invalid tranche: ${input}. Use: senior, mezzanine, junior`);
}

export const lpCommand = new Command("lp")
  .description("LP operations — deposit, withdraw, status");

lpCommand
  .command("deposit")
  .description("Deposit USDC into a vault tranche")
  .argument("<tranche>", "Tranche: senior, mezzanine, junior")
  .argument("<amount>", "Amount in USDC")
  .action(async (trancheStr: string, amountStr: string) => {
    const tranche = parseTranche(trancheStr);
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log(chalk.red("  Invalid amount."));
      return;
    }

    const spinner = ora(`Depositing $${amount} into ${TRANCHE_NAMES[tranche]} tranche...`).start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const depositorUsdc = getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
    const amountBN = new BN(Math.round(amount * PROTOCOL.USDC_ONE));

    try {
      const tx = buildDepositLP(keypair.publicKey, depositorUsdc, amountBN, tranche);
      tx.feePayer = keypair.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(keypair);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      spinner.succeed(`Deposited $${amount} into ${TRANCHE_NAMES[tranche]} (${bpsToPercent(TRANCHE_APR[tranche])} APR)`);
    } catch (err: any) {
      spinner.fail(`Deposit failed: ${err.message?.slice(0, 100) ?? "unknown"}`);
    }
  });

lpCommand
  .command("withdraw")
  .description("Withdraw from a vault tranche")
  .argument("<tranche>", "Tranche: senior, mezzanine, junior")
  .argument("<shares>", "Share amount to withdraw")
  .action(async (trancheStr: string, sharesStr: string) => {
    const tranche = parseTranche(trancheStr);
    const shares = parseFloat(sharesStr);
    if (isNaN(shares) || shares <= 0) {
      console.log(chalk.red("  Invalid shares amount."));
      return;
    }

    const spinner = ora(`Withdrawing ${shares} shares from ${TRANCHE_NAMES[tranche]}...`).start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");
    const depositorUsdc = getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
    const sharesBN = new BN(Math.round(shares * PROTOCOL.USDC_ONE));

    try {
      const tx = buildWithdrawLP(keypair.publicKey, depositorUsdc, sharesBN, tranche);
      tx.feePayer = keypair.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(keypair);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      spinner.succeed(`Withdrew from ${TRANCHE_NAMES[tranche]} tranche`);
    } catch (err: any) {
      spinner.fail(`Withdrawal failed: ${err.message?.slice(0, 100) ?? "unknown"}`);
    }
  });

lpCommand
  .command("status")
  .description("Show LP positions across all tranches")
  .action(async () => {
    const spinner = ora("Fetching LP positions...").start();
    const keypair = loadKeypair();
    const connection = new Connection(getRpcUrl(), "confirmed");

    // Vault stats
    const [vaultPda] = findVaultConfig();
    const vaultInfo = await connection.getAccountInfo(vaultPda);

    spinner.stop();
    header("KREXA · LP Positions");

    if (vaultInfo) {
      const vault = deserializeVaultConfig(vaultInfo.data.slice(8));
      const totalDep = vault.totalDeposits;
      const totalDeploy = vault.totalDeployed;
      const utilBps = totalDep.isZero() ? 0 : totalDeploy.muln(10000).div(totalDep).toNumber();

      field("Total Deposits", formatUsdc(totalDep));
      field("Deployed", formatUsdc(totalDeploy));
      field("Utilization", bpsToPercent(utilBps));
      console.log();
    }

    // Check each tranche for this depositor
    for (let t = 0; t < 3; t++) {
      const [posPda] = findLpDeposit(keypair.publicKey, t);
      const posInfo = await connection.getAccountInfo(posPda);
      if (posInfo) {
        const pos = deserializeDepositPosition(posInfo.data.slice(8));
        if (!pos.isCollateral && !pos.shares.isZero()) {
          console.log(chalk.bold.white(`  ${TRANCHE_NAMES[t]} Tranche`));
          field("Deposited", formatUsdc(pos.depositAmount));
          field("Shares", pos.shares.toString());
          field("APR", bpsToPercent(TRANCHE_APR[t]));
          console.log();
        }
      }
    }

    divider();
    console.log(`  ${chalk.cyan("krexa lp deposit senior 100")}    Deposit $100 to Senior`);
    console.log(`  ${chalk.cyan("krexa lp withdraw junior 50")}    Withdraw from Junior`);
    console.log();
  });
