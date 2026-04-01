import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import BN from "bn.js";
import { createHash } from "crypto";
import { PROGRAM_IDS, PDA_SEEDS } from "./types.js";
import * as pda from "./pda.js";

// ─────────────────────────────────────────────────────────────────────────────
// Token Program ID (avoid @solana/spl-token dependency)
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/**
 * Derive the associated token address for a given mint and owner.
 * Avoids pulling in the full @solana/spl-token package.
 */
export function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

// ─────────────────────────────────────────────────────────────────────────────
// USDC Mint (configurable)
// ─────────────────────────────────────────────────────────────────────────────

export let USDC_MINT = new PublicKey("H2SYsnzdRXrXpHpcDkedARksoxiQLGXjtAvkJg158ETP");

export function setUsdcMint(mint: PublicKey): void {
  USDC_MINT = mint;
}

export function getUsdcMint(): PublicKey {
  return USDC_MINT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encoding helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function encodeU64(v: bigint | BN): Buffer {
  const b = Buffer.alloc(8);
  if (typeof v === "bigint") b.writeBigUInt64LE(v);
  else b.writeBigUInt64LE(BigInt(v.toString()));
  return b;
}

function encodePubkey(pk: PublicKey): Buffer {
  return Buffer.from(pk.toBytes());
}

function encodeName(name: string): Buffer {
  const buf = Buffer.alloc(32);
  Buffer.from(name, "utf-8").copy(buf, 0, 0, 32);
  return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA helper for vault_usdc (not in pda.ts — uses bare seed)
// ─────────────────────────────────────────────────────────────────────────────

function findVaultUsdc(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc")],
    PROGRAM_IDS.CREDIT_VAULT,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Register Agent
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create Wallet
// ─────────────────────────────────────────────────────────────────────────────

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
      { pubkey: agentProfile, isSigner: false, isWritable: false },
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Deposit Collateral
// ─────────────────────────────────────────────────────────────────────────────

export function buildDepositCollateral(
  agent: PublicKey,
  owner: PublicKey,
  ownerUsdc: PublicKey,
  amount: BN,
): Transaction {
  const [vaultConfig] = pda.findVaultConfig();
  const [vaultUsdc] = findVaultUsdc();
  const [collateral] = pda.findCollateral(agent);

  const data = Buffer.concat([
    disc("deposit_collateral"),
    encodePubkey(agent),
    encodeU64(amount),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.CREDIT_VAULT,
    keys: [
      { pubkey: vaultConfig, isSigner: false, isWritable: true },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: collateral, isSigner: false, isWritable: true },
      { pubkey: ownerUsdc, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Repay
// ─────────────────────────────────────────────────────────────────────────────

export function buildRepay(
  agent: PublicKey,
  caller: PublicKey,
  callerUsdc: PublicKey,
  amount: BN,
): Transaction {
  const [vaultConfig] = pda.findVaultConfig();
  const [vaultUsdc] = findVaultUsdc();
  const [creditLine] = pda.findCreditLine(agent);
  const [agentWallet] = pda.findAgentWallet(agent);

  const data = Buffer.concat([disc("repay"), encodeU64(amount)]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.CREDIT_VAULT,
    keys: [
      { pubkey: vaultConfig, isSigner: false, isWritable: true },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: creditLine, isSigner: false, isWritable: true },
      { pubkey: agentWallet, isSigner: false, isWritable: true },
      { pubkey: callerUsdc, isSigner: false, isWritable: true },
      { pubkey: caller, isSigner: true, isWritable: true },
      { pubkey: PROGRAM_IDS.AGENT_WALLET, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Deposit LP (Liquidity)
// ─────────────────────────────────────────────────────────────────────────────

export function buildDepositLP(
  depositor: PublicKey,
  depositorUsdc: PublicKey,
  amount: BN,
  tranche: number,
): Transaction {
  const [vaultConfig] = pda.findVaultConfig();
  const [vaultUsdc] = findVaultUsdc();
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. Withdraw LP (Liquidity)
// ─────────────────────────────────────────────────────────────────────────────

export function buildWithdrawLP(
  depositor: PublicKey,
  depositorUsdc: PublicKey,
  shares: BN,
  tranche: number,
): Transaction {
  const [vaultConfig] = pda.findVaultConfig();
  const [vaultUsdc] = findVaultUsdc();
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
