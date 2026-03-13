/**
 * Transaction builders for Krexa Solana programs.
 *
 * "Unsigned" builders return a base64-serialised Transaction (no signatures)
 * for frontend signing.  "Signed" builders return fully signed Transactions
 * ready to submit via solanaConnection.sendRawTransaction().
 */
import {
  PublicKey, Transaction, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  PROGRAM_IDS, DISCRIMINATORS,
  registryConfigPda, agentProfilePda, walletConfigPda, agentWalletPda,
  walletUsdcPda, vaultConfigPda, vaultUsdcPda, insuranceUsdcPda,
  creditLinePda, depositPositionPda, collateralPositionPda,
  routerConfigPda, settlementPda,
} from './programs.js';
import { env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Borsh encode helpers
// ---------------------------------------------------------------------------

function encodeU8(n: number): Buffer {
  const b = Buffer.alloc(1);
  b.writeUInt8(n);
  return b;
}

function encodeU16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function encodeU64(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function encodePubkey(key: PublicKey): Buffer {
  return Buffer.from(key.toBytes());
}

function encodeString32(s: string): Buffer {
  const b = Buffer.alloc(32, 0);
  Buffer.from(s, 'utf8').copy(b, 0, 0, 32);
  return b;
}

function ix(
  programId: PublicKey,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  data: Buffer,
): TransactionInstruction {
  return new TransactionInstruction({ programId, keys, data });
}

const USDC_MINT = new PublicKey(env.SOLANA_USDC_MINT);

// ---------------------------------------------------------------------------
// Registry: register_agent
// ---------------------------------------------------------------------------

export interface RegisterAgentParams {
  agent: PublicKey;
  owner: PublicKey;
  name: string;
}

export function buildRegisterAgent(params: RegisterAgentParams): TransactionInstruction {
  const { agent, owner, name } = params;
  const config = registryConfigPda();
  const profile = agentProfilePda(agent);

  const data = Buffer.concat([
    DISCRIMINATORS.registerAgent,
    encodeString32(name),
  ]);

  return ix(PROGRAM_IDS.agentRegistry, [
    { pubkey: config,         isSigner: false, isWritable: true  },
    { pubkey: profile,        isSigner: false, isWritable: true  },
    { pubkey: agent,          isSigner: true,  isWritable: false },
    { pubkey: owner,          isSigner: true,  isWritable: true  },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data);
}

// ---------------------------------------------------------------------------
// Registry: update_kya
// ---------------------------------------------------------------------------

export interface UpdateKyaParams {
  oracle: PublicKey;
  agent: PublicKey;
  newTier: number; // u8
}

export function buildUpdateKya(params: UpdateKyaParams): TransactionInstruction {
  const { oracle, agent } = params;
  const config = registryConfigPda();
  const profile = agentProfilePda(agent);

  const data = Buffer.concat([
    DISCRIMINATORS.updateKya,
    encodeU8(params.newTier),
  ]);

  return ix(PROGRAM_IDS.agentRegistry, [
    { pubkey: config,  isSigner: false, isWritable: true  },
    { pubkey: profile, isSigner: false, isWritable: true  },
    { pubkey: oracle,  isSigner: true,  isWritable: false },
  ], data);
}

// ---------------------------------------------------------------------------
// Registry: update_credit_score
// ---------------------------------------------------------------------------

export interface UpdateCreditScoreParams {
  oracle: PublicKey;
  agent: PublicKey;
  newScore: number; // u16
}

export function buildUpdateCreditScore(params: UpdateCreditScoreParams): TransactionInstruction {
  const { oracle, agent } = params;
  const config = registryConfigPda();
  const profile = agentProfilePda(agent);

  const data = Buffer.concat([
    DISCRIMINATORS.updateCreditScore,
    encodeU16(params.newScore),
  ]);

  return ix(PROGRAM_IDS.agentRegistry, [
    { pubkey: config,  isSigner: false, isWritable: true  },
    { pubkey: profile, isSigner: false, isWritable: true  },
    { pubkey: oracle,  isSigner: true,  isWritable: false },
  ], data);
}

// ---------------------------------------------------------------------------
// Agent Wallet: create_wallet
// Parameters: dailySpendLimit (u64) is passed in the instruction data.
// ---------------------------------------------------------------------------

export interface CreateWalletParams {
  agent: PublicKey;
  owner: PublicKey;
  dailySpendLimit: bigint;
  vaultProgram?: PublicKey;
  registryProgram?: PublicKey;
}

export function buildCreateWallet(params: CreateWalletParams): TransactionInstruction {
  const { agent, owner, dailySpendLimit } = params;
  const config = walletConfigPda();
  const wallet = agentWalletPda(agent);
  const walletUsdc = walletUsdcPda(agent);
  const registryConfig = registryConfigPda();
  const agentProfile = agentProfilePda(agent);

  const data = Buffer.concat([
    DISCRIMINATORS.createWallet,
    encodeU64(dailySpendLimit),
  ]);

  return ix(PROGRAM_IDS.agentWallet, [
    { pubkey: config,         isSigner: false, isWritable: true  },
    { pubkey: wallet,         isSigner: false, isWritable: true  },
    { pubkey: walletUsdc,     isSigner: false, isWritable: true  },
    { pubkey: USDC_MINT,      isSigner: false, isWritable: false },
    { pubkey: registryConfig, isSigner: false, isWritable: false },
    { pubkey: agentProfile,   isSigner: false, isWritable: true  },
    { pubkey: agent,          isSigner: true,  isWritable: false },
    { pubkey: owner,          isSigner: true,  isWritable: true  },
    { pubkey: params.registryProgram ?? PROGRAM_IDS.agentRegistry, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,               isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,             isSigner: false, isWritable: false },
  ], data);
}

// ---------------------------------------------------------------------------
// Agent Wallet: check_health
// ---------------------------------------------------------------------------

export interface CheckHealthParams {
  agent: PublicKey;
  caller: PublicKey;
  vaultConfigAddress?: PublicKey;
}

export function buildCheckHealth(params: CheckHealthParams): TransactionInstruction {
  const { agent, caller } = params;
  const config = walletConfigPda();
  const wallet = agentWalletPda(agent);
  const walletUsdc = walletUsdcPda(agent);
  const vaultConfig = params.vaultConfigAddress ?? vaultConfigPda();

  return ix(PROGRAM_IDS.agentWallet, [
    { pubkey: config,      isSigner: false, isWritable: false },
    { pubkey: wallet,      isSigner: false, isWritable: true  },
    { pubkey: walletUsdc,  isSigner: false, isWritable: false },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: caller,      isSigner: true,  isWritable: false },
  ], Buffer.from(DISCRIMINATORS.checkHealth));
}

// ---------------------------------------------------------------------------
// Agent Wallet: deleverage
// ---------------------------------------------------------------------------

export interface DeleverageParams {
  agent: PublicKey;
  keeper: PublicKey;
  vaultConfigAddress?: PublicKey;
}

export function buildDeleverage(params: DeleverageParams): TransactionInstruction {
  const { agent, keeper } = params;
  const config = walletConfigPda();
  const wallet = agentWalletPda(agent);
  const walletUsdc = walletUsdcPda(agent);
  const vaultConfig = params.vaultConfigAddress ?? vaultConfigPda();

  return ix(PROGRAM_IDS.agentWallet, [
    { pubkey: config,      isSigner: false, isWritable: false },
    { pubkey: wallet,      isSigner: false, isWritable: true  },
    { pubkey: walletUsdc,  isSigner: false, isWritable: false },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: keeper,      isSigner: true,  isWritable: false },
  ], Buffer.from(DISCRIMINATORS.deleverage));
}

// ---------------------------------------------------------------------------
// Agent Wallet: liquidate
// ---------------------------------------------------------------------------

export interface LiquidateParams {
  agent: PublicKey;
  agentOwner: PublicKey;
  keeper: PublicKey;
  keeperUsdc: PublicKey;  // keeper's ATA for USDC
  vaultToken?: PublicKey;       // defaults to vaultUsdcPda()
  insuranceToken?: PublicKey;   // defaults to insuranceUsdcPda()
  vaultConfigAddress?: PublicKey;
}

export function buildLiquidate(params: LiquidateParams): TransactionInstruction {
  const { agent, agentOwner, keeper, keeperUsdc } = params;
  const config = walletConfigPda();
  const wallet = agentWalletPda(agent);
  const walletUsdc = walletUsdcPda(agent);
  const vaultConfig = params.vaultConfigAddress ?? vaultConfigPda();
  const vaultToken = params.vaultToken ?? vaultUsdcPda();
  const insuranceToken = params.insuranceToken ?? insuranceUsdcPda();
  const creditLine = creditLinePda(agent);
  const registryConfig = registryConfigPda();
  const agentProfile = agentProfilePda(agent);
  const ownerUsdc = getAssociatedTokenAddressSync(USDC_MINT, agentOwner);

  return ix(PROGRAM_IDS.agentWallet, [
    { pubkey: config,         isSigner: false, isWritable: false },
    { pubkey: wallet,         isSigner: false, isWritable: true  },
    { pubkey: walletUsdc,     isSigner: false, isWritable: true  },
    { pubkey: vaultConfig,    isSigner: false, isWritable: true  },
    { pubkey: vaultToken,     isSigner: false, isWritable: true  },
    { pubkey: insuranceToken, isSigner: false, isWritable: true  },
    { pubkey: creditLine,     isSigner: false, isWritable: true  },
    { pubkey: registryConfig, isSigner: false, isWritable: false },
    { pubkey: agentProfile,   isSigner: false, isWritable: true  },
    { pubkey: keeperUsdc,     isSigner: false, isWritable: true  },
    { pubkey: ownerUsdc,      isSigner: false, isWritable: true  },
    { pubkey: keeper,         isSigner: true,  isWritable: false },
    { pubkey: PROGRAM_IDS.creditVault,    isSigner: false, isWritable: false },
    { pubkey: PROGRAM_IDS.agentRegistry,  isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,           isSigner: false, isWritable: false },
  ], Buffer.from(DISCRIMINATORS.liquidate));
}

// ---------------------------------------------------------------------------
// Agent Wallet: repay
// ---------------------------------------------------------------------------

export interface RepayParams {
  agent: PublicKey;
  caller: PublicKey;
  callerUsdc: PublicKey;  // caller's USDC ATA
  amount: bigint;
  vaultToken?: PublicKey;
  insuranceToken?: PublicKey;
  vaultConfigAddress?: PublicKey;
}

export function buildRepay(params: RepayParams): TransactionInstruction {
  const { agent, caller, callerUsdc, amount } = params;
  const config = walletConfigPda();
  const wallet = agentWalletPda(agent);
  const walletUsdc = walletUsdcPda(agent);
  const vaultConfig = params.vaultConfigAddress ?? vaultConfigPda();
  const vaultToken = params.vaultToken ?? vaultUsdcPda();
  const insuranceToken = params.insuranceToken ?? insuranceUsdcPda();
  const creditLine = creditLinePda(agent);
  const registryConfig = registryConfigPda();
  const agentProfile = agentProfilePda(agent);

  const data = Buffer.concat([
    DISCRIMINATORS.repay,
    encodeU64(amount),
  ]);

  return ix(PROGRAM_IDS.agentWallet, [
    { pubkey: config,         isSigner: false, isWritable: false },
    { pubkey: wallet,         isSigner: false, isWritable: true  },
    { pubkey: walletUsdc,     isSigner: false, isWritable: true  },
    { pubkey: vaultConfig,    isSigner: false, isWritable: true  },
    { pubkey: vaultToken,     isSigner: false, isWritable: true  },
    { pubkey: insuranceToken, isSigner: false, isWritable: true  },
    { pubkey: creditLine,     isSigner: false, isWritable: true  },
    { pubkey: registryConfig, isSigner: false, isWritable: false },
    { pubkey: agentProfile,   isSigner: false, isWritable: true  },
    { pubkey: callerUsdc,     isSigner: false, isWritable: true  },
    { pubkey: caller,         isSigner: true,  isWritable: false },
    { pubkey: PROGRAM_IDS.creditVault,    isSigner: false, isWritable: false },
    { pubkey: PROGRAM_IDS.agentRegistry,  isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,           isSigner: false, isWritable: false },
  ], data);
}

// ---------------------------------------------------------------------------
// Router: activate_settlement
// ---------------------------------------------------------------------------

export interface ActivateSettlementParams {
  oracle: PublicKey;
  merchant: PublicKey;
  agentWalletPdaAddress: PublicKey;
  splitBps: number;
  hasActiveCredit?: boolean;
}

export function buildActivateSettlement(params: ActivateSettlementParams): TransactionInstruction {
  const { oracle, merchant, agentWalletPdaAddress, splitBps, hasActiveCredit = false } = params;
  const routerConfig = routerConfigPda();
  const settlement = settlementPda(merchant);

  const data = Buffer.concat([
    DISCRIMINATORS.activateSettlement,
    encodePubkey(agentWalletPdaAddress),
    encodeU16(splitBps),
    encodeU8(hasActiveCredit ? 1 : 0),
  ]);

  return ix(PROGRAM_IDS.paymentRouter, [
    { pubkey: routerConfig,         isSigner: false, isWritable: false },
    { pubkey: settlement,           isSigner: false, isWritable: true  },
    { pubkey: oracle,               isSigner: true,  isWritable: true  },
    { pubkey: merchant,             isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data);
}

// ---------------------------------------------------------------------------
// Router: execute_payment
// ---------------------------------------------------------------------------

export interface ExecutePaymentParams {
  oracle: PublicKey;
  payer: PublicKey;
  payerUsdc: PublicKey;       // payer's USDC ATA
  merchant: PublicKey;
  merchantUsdc: PublicKey;    // merchant's USDC ATA
  agentWalletPdaAddress: PublicKey;
  agentWalletUsdc: PublicKey; // agent's wallet_usdc PDA
  platformTreasury: PublicKey;
  vaultToken?: PublicKey;
  amount: bigint;
  nonce: bigint;
}

export function buildExecutePayment(params: ExecutePaymentParams): TransactionInstruction {
  const {
    oracle, payer, payerUsdc, merchant, merchantUsdc,
    agentWalletPdaAddress, agentWalletUsdc, platformTreasury, amount, nonce,
  } = params;

  const routerConfig = routerConfigPda();
  const settlement = settlementPda(merchant);
  const vaultConfig = vaultConfigPda();
  const vaultToken = params.vaultToken ?? vaultUsdcPda();

  const data = Buffer.concat([
    DISCRIMINATORS.executePayment,
    encodeU64(amount),
    encodeU64(nonce),
  ]);

  return ix(PROGRAM_IDS.paymentRouter, [
    { pubkey: routerConfig,         isSigner: false, isWritable: false },
    { pubkey: settlement,           isSigner: false, isWritable: true  },
    { pubkey: oracle,               isSigner: true,  isWritable: false },
    { pubkey: payer,                isSigner: true,  isWritable: false },
    { pubkey: payerUsdc,            isSigner: false, isWritable: true  },
    { pubkey: merchant,             isSigner: false, isWritable: false },
    { pubkey: merchantUsdc,         isSigner: false, isWritable: true  },
    { pubkey: agentWalletPdaAddress,isSigner: false, isWritable: true  },
    { pubkey: agentWalletUsdc,      isSigner: false, isWritable: true  },
    { pubkey: platformTreasury,     isSigner: false, isWritable: true  },
    { pubkey: vaultConfig,          isSigner: false, isWritable: true  },
    { pubkey: vaultToken,           isSigner: false, isWritable: true  },
    { pubkey: PROGRAM_IDS.creditVault, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,     isSigner: false, isWritable: false },
  ], data);
}

// ---------------------------------------------------------------------------
// Helpers: wrap an instruction into a base64 serialised unsigned Transaction
// ---------------------------------------------------------------------------

export async function instructionToUnsignedTx(
  instruction: TransactionInstruction,
  feePayer: PublicKey,
): Promise<string> {
  const { solanaConnection } = await import('./connection.js');
  const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer });
  tx.add(instruction);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}
