/**
 * E2E test: Revenue Router auto-repayment via x402 payment
 *
 * Flow:
 *   1. Agent has an active credit line ($10 borrowed)
 *   2. Agent has an active settlement (40% repay split)
 *   3. A "customer" sends $1 USDC through execute_payment
 *   4. The router splits: 0.5% fee → treasury, 40% of remainder → vault (repay), rest → agent wallet
 *   5. Agent's debt is reduced automatically
 *
 * Run: npx tsx scripts/test-revenue-router.ts
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { loadKeypair, getRpcUrl } from "../src/utils/config.js";
import { getOracleKeypair, USDC_MINT, TOKEN_PROGRAM_ID, PROGRAM_IDS } from "../src/utils/constants.js";
import * as pda from "../src/utils/pda.js";
import { deserializeCreditLine, deserializeMerchantSettlement, deserializeVaultConfig, formatUsdc } from "../src/utils/deserialize.js";
import { buildExecutePayment } from "../src/utils/transactions.js";

async function main() {
  const keypair = loadKeypair();
  const connection = new Connection(getRpcUrl(), "confirmed");
  const agent = keypair.publicKey;
  const oracle = getOracleKeypair();

  console.log("=== Revenue Router E2E Test ===\n");
  console.log("Agent:", agent.toBase58());
  console.log("Oracle:", oracle.publicKey.toBase58());

  // Step 1: Check credit line
  const [clPda] = pda.findCreditLine(agent);
  const clInfo = await connection.getAccountInfo(clPda);
  if (!clInfo) {
    console.error("No credit line — run 'krexa borrow 10' first");
    return;
  }
  const clBefore = deserializeCreditLine(clInfo.data.slice(8));
  console.log("\n[Before] Credit drawn:", formatUsdc(clBefore.creditDrawn));

  // Step 2: Check settlement
  const [settlementPda] = pda.findSettlement(agent);
  const settlementInfo = await connection.getAccountInfo(settlementPda);
  if (!settlementInfo) {
    console.error("No settlement — run 'krexa settle' first");
    return;
  }
  const settlement = deserializeMerchantSettlement(settlementInfo.data.slice(8));
  console.log("Settlement split:", settlement.splitBps, "bps");
  console.log("Previous nonce:", settlement.nonce.toString());

  // Step 3: Get oracle's USDC ATA (or create it)
  const oracleAta = pda.getAssociatedTokenAddress(USDC_MINT, oracle.publicKey);
  let oracleBalance = 0;
  try {
    const info = await connection.getTokenAccountBalance(oracleAta);
    oracleBalance = parseInt(info.value.amount);
    console.log("Oracle USDC balance:", oracleBalance / 1e6);
  } catch {
    console.log("Oracle has no USDC ATA — need to create and fund it");
    // Create ATA and transfer from agent
    const createAtaIx = createAssociatedTokenAccountIx(keypair.publicKey, oracle.publicKey, USDC_MINT);
    const tx = new Transaction().add(createAtaIx);
    tx.feePayer = keypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(keypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    console.log("Created oracle ATA");
  }

  // Fund oracle with 1 USDC from agent's ATA if needed
  const paymentAmount = 1_000_000; // 1 USDC
  if (oracleBalance < paymentAmount) {
    const agentAta = pda.getAssociatedTokenAddress(USDC_MINT, agent);
    const transferAmount = Buffer.alloc(8);
    transferAmount.writeBigUInt64LE(BigInt(paymentAmount));
    const transferIx = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: agentAta, isSigner: false, isWritable: true },
        { pubkey: oracleAta, isSigner: false, isWritable: true },
        { pubkey: agent, isSigner: true, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from([3]), transferAmount]),
    });
    const tx = new Transaction().add(transferIx);
    tx.feePayer = keypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(keypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    console.log("Funded oracle with 1 USDC (simulating customer payment)");
  }

  // Step 4: Get vault config for token addresses
  const [vaultConfigPda] = pda.findVaultConfig();
  const vcInfo = await connection.getAccountInfo(vaultConfigPda);
  if (!vcInfo) { console.error("No vault config"); return; }
  const vc = deserializeVaultConfig(vcInfo.data.slice(8));

  // Merchant USDC = agent's wallet PDA USDC
  const [walletUsdc] = pda.findWalletUsdc(agent);

  // Platform treasury
  const platformTreasury = new PublicKey("5v86BdV1SS23TKdsp9tdVcm8sGj1UdhefxnJGTgJeWBi");

  // Step 5: Execute payment through Revenue Router
  console.log("\n--- Executing payment: $1.00 USDC through Revenue Router ---");

  const nonce = new BN(settlement.nonce.toNumber() + 1);
  const amount = new BN(paymentAmount);

  const tx = buildExecutePayment(
    oracle.publicKey,
    agent,                    // merchant
    oracleAta,                // payer_usdc (oracle's ATA)
    walletUsdc,               // merchant_usdc (agent's wallet PDA USDC)
    platformTreasury,         // platform treasury
    vc.vaultTokenAccount,     // vault token
    vc.insuranceTokenAccount, // insurance token
    amount,
    nonce,
  );

  tx.feePayer = oracle.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(oracle);

  // Simulate first
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    console.error("Simulation failed:");
    console.error("Logs:", sim.value.logs?.join("\n"));
    console.error("Error:", JSON.stringify(sim.value.err));
    return;
  }

  console.log("Simulation passed! Logs:");
  sim.value.logs?.forEach(l => console.log("  ", l));

  // Send for real
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log("\nTransaction confirmed:", sig);

  // Step 6: Check results
  const clAfterInfo = await connection.getAccountInfo(clPda);
  if (clAfterInfo) {
    const clAfter = deserializeCreditLine(clAfterInfo.data.slice(8));
    console.log("\n[After] Credit drawn:", formatUsdc(clAfter.creditDrawn));
    const repaidAmount = clBefore.creditDrawn.sub(clAfter.creditDrawn);
    console.log("Auto-repaid:", formatUsdc(repaidAmount), "USDC");
  }

  // Check updated settlement stats
  const settlementAfterInfo = await connection.getAccountInfo(settlementPda);
  if (settlementAfterInfo) {
    const sAfter = deserializeMerchantSettlement(settlementAfterInfo.data.slice(8));
    console.log("\n[Settlement Updated]");
    console.log("  Total routed:", formatUsdc(sAfter.totalRouted));
    console.log("  Total repaid:", formatUsdc(sAfter.totalRepaid));
    console.log("  Merchant received:", formatUsdc(sAfter.totalMerchantReceived));
    console.log("  Nonce:", sAfter.nonce.toString());
  }

  console.log("\n=== Revenue Router E2E Test Complete ===");
  console.log("\nRun 'krexa revenue' to see updated stats");
  console.log("Run 'krexa status' to see reduced debt");
}

function createAssociatedTokenAccountIx(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const ata = pda.getAssociatedTokenAddress(mint, owner);
  return new TransactionInstruction({
    programId: ATA_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
}

main().catch(console.error);
