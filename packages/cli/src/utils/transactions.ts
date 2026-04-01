import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import BN from "bn.js";
import { createHash } from "crypto";
import { PROGRAM_IDS, USDC_MINT, TOKEN_PROGRAM_ID } from "./constants.js";
import * as pda from "./pda.js";

function disc(name: string): Buffer {
  return createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

function encodeU8(v: number): Buffer {
  const b = Buffer.alloc(1);
  b.writeUInt8(v);
  return b;
}

function encodeU16(v: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}

function encodeU64(v: bigint | BN): Buffer {
  const b = Buffer.alloc(8);
  if (typeof v === "bigint") b.writeBigUInt64LE(v);
  else b.writeBigUInt64LE(BigInt(v.toString()));
  return b;
}

function encodeName(name: string): Buffer {
  const buf = Buffer.alloc(32);
  Buffer.from(name, "utf-8").copy(buf, 0, 0, 32);
  return buf;
}

export function buildRegisterAgent(
  agent: PublicKey,
  owner: PublicKey,
  name: string,
  agentType: number,
): Transaction {
  const [registryConfig] = pda.findRegistryConfig();
  const [agentProfile] = pda.findAgentProfile(agent);

  const data = Buffer.concat([
    disc("register_agent"),
    encodeName(name),
    encodeU8(agentType),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.AGENT_REGISTRY,
    keys: [
      { pubkey: registryConfig, isSigner: false, isWritable: true },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: agent, isSigner: true, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

export function buildCreateWallet(
  agent: PublicKey,
  owner: PublicKey,
  dailySpendLimit: BN,
): Transaction {
  const [walletConfig] = pda.findWalletConfig();
  const [agentWallet] = pda.findAgentWallet(agent);
  const [walletUsdc] = pda.findWalletUsdc(agent);
  const [registryConfig] = pda.findRegistryConfig();
  const [agentProfile] = pda.findAgentProfile(agent);

  const data = Buffer.concat([
    disc("create_wallet"),
    encodeU64(dailySpendLimit),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.AGENT_WALLET,
    keys: [
      { pubkey: walletConfig, isSigner: false, isWritable: true },
      { pubkey: agentWallet, isSigner: false, isWritable: true },
      { pubkey: walletUsdc, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: registryConfig, isSigner: false, isWritable: false },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: agent, isSigner: true, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: PROGRAM_IDS.AGENT_REGISTRY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

export function buildUpdateKya(
  agent: PublicKey,
  authority: PublicKey,
  newTier: number,
): Transaction {
  const [registryConfig] = pda.findRegistryConfig();
  const [agentProfile] = pda.findAgentProfile(agent);

  const data = Buffer.concat([
    disc("update_kya"),
    encodeU8(newTier),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.AGENT_REGISTRY,
    keys: [
      { pubkey: registryConfig, isSigner: false, isWritable: false },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

export function buildRepay(
  agent: PublicKey,
  caller: PublicKey,
  amount: BN,
  vaultTokenAccount: PublicKey,
  insuranceTokenAccount: PublicKey,
): Transaction {
  const [walletConfig] = pda.findWalletConfig();
  const [agentWallet] = pda.findAgentWallet(agent);
  const [walletUsdc] = pda.findWalletUsdc(agent);
  const [vaultConfig] = pda.findVaultConfig();
  const [creditLine] = pda.findCreditLine(agent);
  const [registryConfig] = pda.findRegistryConfig();
  const [agentProfile] = pda.findAgentProfile(agent);

  const data = Buffer.concat([disc("repay"), encodeU64(amount)]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.AGENT_WALLET,
    keys: [
      { pubkey: walletConfig, isSigner: false, isWritable: false },
      { pubkey: agentWallet, isSigner: false, isWritable: true },
      { pubkey: walletUsdc, isSigner: false, isWritable: true },
      { pubkey: vaultConfig, isSigner: false, isWritable: true },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: insuranceTokenAccount, isSigner: false, isWritable: true },
      { pubkey: creditLine, isSigner: false, isWritable: true },
      { pubkey: registryConfig, isSigner: false, isWritable: false },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: caller, isSigner: true, isWritable: false },
      { pubkey: PROGRAM_IDS.CREDIT_VAULT, isSigner: false, isWritable: false },
      { pubkey: PROGRAM_IDS.AGENT_REGISTRY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

export function buildDepositLP(
  depositor: PublicKey,
  depositorUsdc: PublicKey,
  amount: BN,
  tranche: number,
): Transaction {
  const [vaultConfig] = pda.findVaultConfig();
  const [vaultUsdc] = pda.findVaultUsdc();
  const [lpDeposit] = pda.findLpDeposit(depositor, tranche);

  const data = Buffer.concat([
    disc("deposit_liquidity"),
    encodeU64(amount),
    encodeU8(tranche),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.CREDIT_VAULT,
    keys: [
      { pubkey: vaultConfig, isSigner: false, isWritable: true },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: lpDeposit, isSigner: false, isWritable: true },
      { pubkey: depositorUsdc, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

export function buildWithdrawLP(
  depositor: PublicKey,
  depositorUsdc: PublicKey,
  shares: BN,
  tranche: number,
): Transaction {
  const [vaultConfig] = pda.findVaultConfig();
  const [vaultUsdc] = pda.findVaultUsdc();
  const [lpDeposit] = pda.findLpDeposit(depositor, tranche);

  const data = Buffer.concat([
    disc("withdraw_liquidity"),
    encodeU64(shares),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.CREDIT_VAULT,
    keys: [
      { pubkey: vaultConfig, isSigner: false, isWritable: true },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: lpDeposit, isSigner: false, isWritable: true },
      { pubkey: depositorUsdc, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

export function buildActivateSettlement(
  oracle: PublicKey,
  merchant: PublicKey,
  agentWalletPda: PublicKey,
  splitBps: number,
  hasActiveCredit: boolean,
): Transaction {
  const [routerConfig] = pda.findRouterConfig();
  const [settlement] = pda.findSettlement(merchant);

  // On-chain args: merchant (Pubkey), split_bps (u16), agent_wallet_pda (Pubkey)
  const data = Buffer.concat([
    disc("activate_settlement"),
    merchant.toBuffer(),
    encodeU16(splitBps),
    agentWalletPda.toBuffer(),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.PAYMENT_ROUTER,
    keys: [
      { pubkey: routerConfig, isSigner: false, isWritable: false },
      { pubkey: settlement, isSigner: false, isWritable: true },
      { pubkey: oracle, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

// On-chain ExecutePayment accounts (12):
//   config, settlement, payer_usdc, merchant_usdc, platform_treasury_token,
//   vault_config, vault_token, insurance_token, credit_line, oracle, vault_program, token_program
// Instruction args: merchant (Pubkey), amount (u64), nonce (u64)
export function buildExecutePayment(
  oracle: PublicKey,
  merchant: PublicKey,
  payerUsdc: PublicKey,
  merchantUsdc: PublicKey,
  platformTreasury: PublicKey,
  vaultToken: PublicKey,
  insuranceToken: PublicKey,
  amount: BN,
  nonce: BN,
): Transaction {
  const [routerConfig] = pda.findRouterConfig();
  const [settlement] = pda.findSettlement(merchant);
  const [vaultConfig] = pda.findVaultConfig();
  const [creditLine] = pda.findCreditLine(merchant);

  const data = Buffer.concat([
    disc("execute_payment"),
    merchant.toBuffer(),
    encodeU64(amount),
    encodeU64(nonce),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.PAYMENT_ROUTER,
    keys: [
      { pubkey: routerConfig, isSigner: false, isWritable: false },
      { pubkey: settlement, isSigner: false, isWritable: true },
      { pubkey: payerUsdc, isSigner: false, isWritable: true },
      { pubkey: merchantUsdc, isSigner: false, isWritable: true },
      { pubkey: platformTreasury, isSigner: false, isWritable: true },
      { pubkey: vaultConfig, isSigner: false, isWritable: true },
      { pubkey: vaultToken, isSigner: false, isWritable: true },
      { pubkey: insuranceToken, isSigner: false, isWritable: true },
      { pubkey: creditLine, isSigner: false, isWritable: true },
      { pubkey: oracle, isSigner: true, isWritable: true },
      { pubkey: PROGRAM_IDS.CREDIT_VAULT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}
