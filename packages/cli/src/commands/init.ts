import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import {
  config,
  keypairExists,
  loadKeypair,
  saveKeypair,
  getRpcUrl,
  shortenAddress,
} from "../utils/config.js";
import { showBanner, success, warn, info, header, field, divider } from "../utils/display.js";
import { buildRegisterAgent, buildCreateWallet } from "../utils/transactions.js";
import { AGENT_TYPES, CREDIT_LEVELS } from "../utils/constants.js";
import * as api from "../utils/api.js";

export const initCommand = new Command("init")
  .description("Initialize your agent — keypair, registration, wallet, score")
  .option("--type <type>", "Agent type: trader, service, hybrid")
  .option("--name <name>", "Agent name")
  .option("--keypair <path>", "Path to existing keypair file")
  .action(async (opts) => {
    showBanner();

    // Step 1: Keypair
    let keypair: Keypair;
    const spinner = ora();

    if (opts.keypair) {
      spinner.start("Loading keypair...");
      const fs = await import("fs");
      const raw = JSON.parse(fs.readFileSync(opts.keypair, "utf-8"));
      keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
      spinner.succeed(`Keypair loaded: ${chalk.cyan(shortenAddress(keypair.publicKey.toBase58()))}`);
    } else if (keypairExists()) {
      keypair = loadKeypair();
      success(`Keypair exists: ${chalk.cyan(shortenAddress(keypair.publicKey.toBase58()))}`);
    } else {
      spinner.start("Generating new keypair...");
      keypair = Keypair.generate();
      const kpPath = saveKeypair(keypair);
      spinner.succeed(`Keypair created: ${chalk.cyan(shortenAddress(keypair.publicKey.toBase58()))}`);
      info(chalk.dim(`Saved to ${kpPath}`));
    }

    // Step 2: Agent type
    let agentType: number;
    if (opts.type) {
      const idx = AGENT_TYPES.findIndex(
        (t) => t.toLowerCase() === opts.type.toLowerCase()
      );
      agentType = idx >= 0 ? idx : 0;
    } else {
      const { type } = await inquirer.prompt([
        {
          type: "list",
          name: "type",
          message: "Agent type:",
          choices: [
            { name: "Trader   — DEX trading, arbitrage, market making", value: 0 },
            { name: "Service  — x402 APIs, SaaS, compute providers", value: 1 },
            { name: "Hybrid   — Both trading and service revenue", value: 2 },
          ],
        },
      ]);
      agentType = type;
    }

    // Step 3: Agent name
    let agentName: string;
    if (opts.name) {
      agentName = opts.name;
    } else {
      const { name } = await inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "Agent name:",
          default: `Agent-${keypair.publicKey.toBase58().slice(0, 6)}`,
          validate: (v: string) => v.length > 0 && v.length <= 32 || "Name must be 1-32 characters",
        },
      ]);
      agentName = name;
    }

    config.set("agentName", agentName);
    config.set("agentType", agentType);

    // Step 4: Network check + airdrop
    const network = config.get("network") as string;
    const rpcUrl = getRpcUrl();
    const connection = new Connection(rpcUrl, "confirmed");

    let hasSol = false;
    if (network === "devnet") {
      spinner.start("Checking SOL balance on devnet...");
      let balance = await connection.getBalance(keypair.publicKey);
      if (balance < LAMPORTS_PER_SOL) {
        spinner.text = "Airdropping 2 SOL on devnet...";
        // Try multiple times — devnet faucet is flaky
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const sig = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig, "confirmed");
            balance = await connection.getBalance(keypair.publicKey);
            if (balance >= LAMPORTS_PER_SOL) {
              spinner.succeed(`Airdropped 2 SOL to ${chalk.cyan(shortenAddress(keypair.publicKey.toBase58()))}`);
              hasSol = true;
              break;
            }
          } catch {
            if (attempt < 2) {
              spinner.text = `Airdrop attempt ${attempt + 2}/3...`;
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }
        if (!hasSol) {
          spinner.warn("SOL airdrop failed — fund your wallet to complete setup");
          info(chalk.dim(`  Address: ${keypair.publicKey.toBase58()}`));
          info(chalk.dim("  Use https://faucet.solana.com or `solana airdrop 2`"));
        }
      } else {
        spinner.succeed(`SOL balance: ${chalk.cyan((balance / LAMPORTS_PER_SOL).toFixed(2))} SOL`);
        hasSol = true;
      }
    } else {
      hasSol = true;
    }

    // Step 5: Register agent on-chain
    if (hasSol) {
      spinner.start(`Registering ${chalk.cyan(agentName)} on Solana ${network}...`);
      try {
        const tx = buildRegisterAgent(keypair.publicKey, keypair.publicKey, agentName, agentType);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.sign(keypair);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        spinner.succeed(`Agent registered: ${chalk.cyan(agentName)} (${AGENT_TYPES[agentType]})`);
      } catch (err: any) {
        if (err.message?.includes("already in use")) {
          spinner.succeed(`Agent already registered: ${chalk.cyan(agentName)}`);
        } else {
          spinner.warn(`Registration: ${err.message?.slice(0, 80) ?? "failed"}`);
        }
      }

      // Step 5b: KYA verification via backend API
      // KYA requires oracle co-signature — request it from the backend instead of
      // signing client-side. The backend register/onboard flow handles KYA bundled
      // into agent registration when available.
      spinner.start("Requesting KYA Basic verification from backend...");
      try {
        await api.requestKyaVerification(keypair.publicKey.toBase58(), 1);
        spinner.succeed("KYA Basic verified (L1 credit unlocked)");
      } catch (err: any) {
        // KYA may already be set, or the endpoint may not be deployed yet
        if (err.message?.includes("already verified") || err.message?.includes("409")) {
          spinner.succeed("KYA already verified");
        } else {
          spinner.warn(
            "KYA auto-verify unavailable — complete KYA manually via the dashboard or API. " +
            `(${err.message?.slice(0, 60) ?? "unknown error"})`
          );
        }
      }

      // Step 6: Create PDA wallet
      spinner.start(`Creating PDA wallet for ${chalk.cyan(shortenAddress(keypair.publicKey.toBase58()))}...`);
      try {
        const walletTx = buildCreateWallet(keypair.publicKey, keypair.publicKey, new BN(100_000_000));
        walletTx.feePayer = keypair.publicKey;
        walletTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        walletTx.sign(keypair);
        const sig = await connection.sendRawTransaction(walletTx.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        spinner.succeed("PDA wallet created");
      } catch (err: any) {
        if (err.message?.includes("already in use")) {
          spinner.succeed("PDA wallet already exists");
        } else {
          spinner.warn(`Wallet: ${err.message?.slice(0, 80) ?? "failed"}`);
        }
      }
    } else {
      warn("Skipping on-chain registration (no SOL). Fund wallet, then run:");
      info(chalk.cyan("  krexa init"));
    }

    // Step 7: Fetch score
    let scoreVal = 350;
    spinner.start("Fetching Krexit Score from oracle...");
    try {
      const scoreData = await api.getScore(keypair.publicKey.toBase58());
      scoreVal = scoreData.score ?? scoreData.components?.overall ?? 350;
      spinner.succeed(`Krexit Score: ${chalk.cyan(String(scoreVal))}`);
    } catch {
      spinner.info(`Krexit Score: ${chalk.cyan("350")} (initial)`);
    }

    // Summary
    const level = scoreVal < 500 ? 1 : scoreVal < 650 ? 2 : scoreVal < 750 ? 3 : 4;
    const creditInfo = CREDIT_LEVELS[level];

    header("KREXA · Agent Initialized");
    field("Agent", `${agentName} (${AGENT_TYPES[agentType]})`);
    field("Address", chalk.cyan(keypair.publicKey.toBase58()));
    field("Network", network);
    field("Krexit Score", chalk.cyan(String(scoreVal)) + chalk.dim(` (${creditInfo.name})`));
    field("Max Credit", chalk.green(`$${creditInfo.maxCredit.toLocaleString()} USDC`));
    field("Rate", `${(creditInfo.rateBps / 100).toFixed(2)}% APR`);
    divider();
    console.log();
    console.log(chalk.bold.white("  Next steps:"));
    console.log(chalk.dim("  ─────────────────────────────────────"));
    console.log(`  ${chalk.cyan("krexa faucet")}       Get test USDC (devnet)`);
    console.log(`  ${chalk.cyan("krexa borrow 500")}   Borrow $500 USDC`);
    console.log(`  ${chalk.cyan("krexa status")}       Check your status`);
    console.log(`  ${chalk.cyan("krexa score")}        Score breakdown`);
    console.log();
  });
