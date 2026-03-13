import { PublicKey, AccountInfo } from '@solana/web3.js';
import { solanaConnection } from './connection.js';
import {
  PROGRAM_IDS, ACCOUNT_DISCRIMINATORS,
  agentProfilePda, vaultConfigPda, creditLinePda, agentWalletPda,
  walletConfigPda, depositPositionPda, collateralPositionPda,
  routerConfigPda, settlementPda, registryConfigPda,
} from './programs.js';

// ---------------------------------------------------------------------------
// TypeScript interfaces — match on-chain Rust structs field-for-field
// ---------------------------------------------------------------------------

export interface RegistryConfig {
  admin: PublicKey;
  oracle: PublicKey;
  walletProgram: PublicKey;
  totalAgents: bigint;
  isPaused: boolean;
  bump: number;
}

export interface AgentProfile {
  agent: PublicKey;
  owner: PublicKey;
  name: string;            // decoded from [u8;32]
  creditScore: number;     // u16
  creditLevel: number;     // u8
  kyaTier: number;         // u8
  kyaVerifiedAt: bigint;   // i64 unix ts
  scoreUpdatedAt: bigint;
  totalVolumeUsd: bigint;
  totalTrades: bigint;
  totalRepaid: bigint;
  totalBorrowed: bigint;
  liquidationCount: number;
  walletPda: PublicKey;
  hasWallet: boolean;
  isActive: boolean;
  registeredAt: bigint;
  bump: number;
}

export interface VaultConfig {
  admin: PublicKey;
  oracle: PublicKey;
  walletProgram: PublicKey;
  usdcMint: PublicKey;
  vaultTokenAccount: PublicKey;
  insuranceTokenAccount: PublicKey;
  totalDeposits: bigint;
  totalShares: bigint;
  totalDeployed: bigint;
  totalInterestEarned: bigint;
  totalDefaults: bigint;
  insuranceBalance: bigint;
  utilizationCapBps: number;
  baseInterestRateBps: number;
  lockupSeconds: bigint;
  isPaused: boolean;
  bump: number;
  vaultTokenBump: number;
  insuranceTokenBump: number;
}

export interface DepositPosition {
  depositor: PublicKey;
  shares: bigint;
  depositedAmount: bigint;
  depositTimestamp: bigint;
  isCollateral: boolean;
  agentPubkey: PublicKey;
  bump: number;
}

export interface CreditLine {
  agent: PublicKey;
  agentWalletPda: PublicKey;
  creditLimit: bigint;
  creditDrawn: bigint;
  interestRateBps: number;
  accruedInterest: bigint;
  totalInterestPaid: bigint;
  lastAccrualTimestamp: bigint;
  originatedAt: bigint;
  isActive: boolean;
  bump: number;
}

export interface WalletConfig {
  admin: PublicKey;
  creditVaultProgram: PublicKey;
  agentRegistryProgram: PublicKey;
  venueWhitelistProgram: PublicKey;
  paymentRouterProgram: PublicKey;
  usdcMint: PublicKey;
  keeper: PublicKey;
  totalWallets: bigint;
  isPaused: boolean;
  bump: number;
}

export interface AgentWallet {
  agent: PublicKey;
  owner: PublicKey;
  config: PublicKey;
  walletUsdc: PublicKey;
  collateralShares: bigint;
  creditLimit: bigint;
  creditDrawn: bigint;
  totalDebt: bigint;
  dailySpendLimit: bigint;
  dailySpent: bigint;
  lastDailyReset: bigint;
  healthFactorBps: number;
  lastHealthCheck: bigint;
  creditLevel: number;
  isFrozen: boolean;
  isLiquidating: boolean;
  totalTrades: bigint;
  totalVolume: bigint;
  totalRepaid: bigint;
  createdAt: bigint;
  bump: number;
  usdcBump: number;
}

export interface RouterConfig {
  admin: PublicKey;
  oracle: PublicKey;
  usdcMint: PublicKey;
  platformTreasury: PublicKey;
  platformFeeBps: number;
  isPaused: boolean;
  bump: number;
}

export interface MerchantSettlement {
  merchant: PublicKey;
  agentWalletPda: PublicKey;
  hasActiveCredit: boolean;
  splitBps: number;
  totalRouted: bigint;
  totalRepaid: bigint;
  totalMerchantReceived: bigint;
  nonce: bigint;
  isActive: boolean;
  bump: number;
}

// ---------------------------------------------------------------------------
// Low-level Borsh helpers
// ---------------------------------------------------------------------------

function readPubkey(buf: Buffer, offset: number): [PublicKey, number] {
  return [new PublicKey(buf.subarray(offset, offset + 32)), offset + 32];
}

function readU64(buf: Buffer, offset: number): [bigint, number] {
  return [buf.readBigUInt64LE(offset), offset + 8];
}

function readI64(buf: Buffer, offset: number): [bigint, number] {
  return [buf.readBigInt64LE(offset), offset + 8];
}

function readU16(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt16LE(offset), offset + 2];
}

function readU8(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt8(offset), offset + 1];
}

function readBool(buf: Buffer, offset: number): [boolean, number] {
  return [buf.readUInt8(offset) !== 0, offset + 1];
}

function decodeFixed32String(buf: Buffer, offset: number): [string, number] {
  const raw = buf.subarray(offset, offset + 32);
  const nullIdx = raw.indexOf(0);
  return [raw.subarray(0, nullIdx < 0 ? 32 : nullIdx).toString('utf8'), offset + 32];
}

function assertDiscriminator(data: Buffer, expected: Buffer, name: string): void {
  const actual = data.subarray(0, 8);
  if (!actual.equals(expected)) {
    throw new Error(
      `${name}: discriminator mismatch — expected ${expected.toString('hex')} got ${actual.toString('hex')}`,
    );
  }
}

async function fetchAccountData(address: PublicKey): Promise<Buffer | null> {
  const info: AccountInfo<Buffer> | null = await solanaConnection.getAccountInfo(address, 'confirmed');
  if (!info) return null;
  return info.data as Buffer;
}

// ---------------------------------------------------------------------------
// Decoders
// ---------------------------------------------------------------------------

function decodeRegistryConfig(data: Buffer): RegistryConfig {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.RegistryConfig, 'RegistryConfig');
  let o = 8; // skip discriminator
  let admin: PublicKey; [admin, o] = readPubkey(data, o);
  let oracle: PublicKey; [oracle, o] = readPubkey(data, o);
  let walletProgram: PublicKey; [walletProgram, o] = readPubkey(data, o);
  let totalAgents: bigint; [totalAgents, o] = readU64(data, o);
  let isPaused: boolean; [isPaused, o] = readBool(data, o);
  let bump: number; [bump, o] = readU8(data, o);
  return { admin, oracle, walletProgram, totalAgents, isPaused, bump };
}

function decodeAgentProfile(data: Buffer): AgentProfile {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.AgentProfile, 'AgentProfile');
  let o = 8;
  let agent: PublicKey;       [agent, o] = readPubkey(data, o);
  let owner: PublicKey;       [owner, o] = readPubkey(data, o);
  let name: string;           [name, o] = decodeFixed32String(data, o);
  let creditScore: number;    [creditScore, o] = readU16(data, o);
  let creditLevel: number;    [creditLevel, o] = readU8(data, o);
  let kyaTier: number;        [kyaTier, o] = readU8(data, o);
  let kyaVerifiedAt: bigint;  [kyaVerifiedAt, o] = readI64(data, o);
  let scoreUpdatedAt: bigint; [scoreUpdatedAt, o] = readI64(data, o);
  let totalVolumeUsd: bigint; [totalVolumeUsd, o] = readU64(data, o);
  let totalTrades: bigint;    [totalTrades, o] = readU64(data, o);
  let totalRepaid: bigint;    [totalRepaid, o] = readU64(data, o);
  let totalBorrowed: bigint;  [totalBorrowed, o] = readU64(data, o);
  let liquidationCount: number; [liquidationCount, o] = readU8(data, o);
  let walletPda: PublicKey;   [walletPda, o] = readPubkey(data, o);
  let hasWallet: boolean;     [hasWallet, o] = readBool(data, o);
  let isActive: boolean;      [isActive, o] = readBool(data, o);
  let registeredAt: bigint;   [registeredAt, o] = readI64(data, o);
  let bump: number;           [bump, o] = readU8(data, o);
  return {
    agent, owner, name, creditScore, creditLevel, kyaTier, kyaVerifiedAt,
    scoreUpdatedAt, totalVolumeUsd, totalTrades, totalRepaid, totalBorrowed,
    liquidationCount, walletPda, hasWallet, isActive, registeredAt, bump,
  };
}

function decodeVaultConfig(data: Buffer): VaultConfig {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.VaultConfig, 'VaultConfig');
  let o = 8;
  let admin: PublicKey;                  [admin, o] = readPubkey(data, o);
  let oracle: PublicKey;                 [oracle, o] = readPubkey(data, o);
  let walletProgram: PublicKey;          [walletProgram, o] = readPubkey(data, o);
  let usdcMint: PublicKey;              [usdcMint, o] = readPubkey(data, o);
  let vaultTokenAccount: PublicKey;      [vaultTokenAccount, o] = readPubkey(data, o);
  let insuranceTokenAccount: PublicKey;  [insuranceTokenAccount, o] = readPubkey(data, o);
  let totalDeposits: bigint;            [totalDeposits, o] = readU64(data, o);
  let totalShares: bigint;              [totalShares, o] = readU64(data, o);
  let totalDeployed: bigint;            [totalDeployed, o] = readU64(data, o);
  let totalInterestEarned: bigint;      [totalInterestEarned, o] = readU64(data, o);
  let totalDefaults: bigint;            [totalDefaults, o] = readU64(data, o);
  let insuranceBalance: bigint;         [insuranceBalance, o] = readU64(data, o);
  let utilizationCapBps: number;        [utilizationCapBps, o] = readU16(data, o);
  let baseInterestRateBps: number;      [baseInterestRateBps, o] = readU16(data, o);
  let lockupSeconds: bigint;            [lockupSeconds, o] = readI64(data, o);
  let isPaused: boolean;                [isPaused, o] = readBool(data, o);
  let bump: number;                     [bump, o] = readU8(data, o);
  let vaultTokenBump: number;           [vaultTokenBump, o] = readU8(data, o);
  let insuranceTokenBump: number;       [insuranceTokenBump, o] = readU8(data, o);
  return {
    admin, oracle, walletProgram, usdcMint, vaultTokenAccount, insuranceTokenAccount,
    totalDeposits, totalShares, totalDeployed, totalInterestEarned, totalDefaults,
    insuranceBalance, utilizationCapBps, baseInterestRateBps, lockupSeconds,
    isPaused, bump, vaultTokenBump, insuranceTokenBump,
  };
}

function decodeDepositPosition(data: Buffer): DepositPosition {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.DepositPosition, 'DepositPosition');
  let o = 8;
  let depositor: PublicKey;         [depositor, o] = readPubkey(data, o);
  let shares: bigint;               [shares, o] = readU64(data, o);
  let depositedAmount: bigint;      [depositedAmount, o] = readU64(data, o);
  let depositTimestamp: bigint;     [depositTimestamp, o] = readI64(data, o);
  let isCollateral: boolean;        [isCollateral, o] = readBool(data, o);
  let agentPubkey: PublicKey;       [agentPubkey, o] = readPubkey(data, o);
  let bump: number;                 [bump, o] = readU8(data, o);
  return { depositor, shares, depositedAmount, depositTimestamp, isCollateral, agentPubkey, bump };
}

function decodeCreditLine(data: Buffer): CreditLine {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.CreditLine, 'CreditLine');
  let o = 8;
  let agent: PublicKey;                  [agent, o] = readPubkey(data, o);
  let agentWalletPda: PublicKey;         [agentWalletPda, o] = readPubkey(data, o);
  let creditLimit: bigint;               [creditLimit, o] = readU64(data, o);
  let creditDrawn: bigint;               [creditDrawn, o] = readU64(data, o);
  let interestRateBps: number;           [interestRateBps, o] = readU16(data, o);
  let accruedInterest: bigint;           [accruedInterest, o] = readU64(data, o);
  let totalInterestPaid: bigint;         [totalInterestPaid, o] = readU64(data, o);
  let lastAccrualTimestamp: bigint;      [lastAccrualTimestamp, o] = readI64(data, o);
  let originatedAt: bigint;             [originatedAt, o] = readI64(data, o);
  let isActive: boolean;                [isActive, o] = readBool(data, o);
  let bump: number;                     [bump, o] = readU8(data, o);
  return {
    agent, agentWalletPda, creditLimit, creditDrawn, interestRateBps,
    accruedInterest, totalInterestPaid, lastAccrualTimestamp, originatedAt, isActive, bump,
  };
}

function decodeWalletConfig(data: Buffer): WalletConfig {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.WalletConfig, 'WalletConfig');
  let o = 8;
  let admin: PublicKey;                  [admin, o] = readPubkey(data, o);
  let creditVaultProgram: PublicKey;     [creditVaultProgram, o] = readPubkey(data, o);
  let agentRegistryProgram: PublicKey;   [agentRegistryProgram, o] = readPubkey(data, o);
  let venueWhitelistProgram: PublicKey;  [venueWhitelistProgram, o] = readPubkey(data, o);
  let paymentRouterProgram: PublicKey;   [paymentRouterProgram, o] = readPubkey(data, o);
  let usdcMint: PublicKey;             [usdcMint, o] = readPubkey(data, o);
  let keeper: PublicKey;               [keeper, o] = readPubkey(data, o);
  let totalWallets: bigint;            [totalWallets, o] = readU64(data, o);
  let isPaused: boolean;               [isPaused, o] = readBool(data, o);
  let bump: number;                    [bump, o] = readU8(data, o);
  return {
    admin, creditVaultProgram, agentRegistryProgram, venueWhitelistProgram,
    paymentRouterProgram, usdcMint, keeper, totalWallets, isPaused, bump,
  };
}

function decodeAgentWallet(data: Buffer): AgentWallet {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.AgentWallet, 'AgentWallet');
  let o = 8;
  let agent: PublicKey;           [agent, o] = readPubkey(data, o);
  let owner: PublicKey;           [owner, o] = readPubkey(data, o);
  let config: PublicKey;          [config, o] = readPubkey(data, o);
  let walletUsdc: PublicKey;      [walletUsdc, o] = readPubkey(data, o);
  let collateralShares: bigint;   [collateralShares, o] = readU64(data, o);
  let creditLimit: bigint;        [creditLimit, o] = readU64(data, o);
  let creditDrawn: bigint;        [creditDrawn, o] = readU64(data, o);
  let totalDebt: bigint;          [totalDebt, o] = readU64(data, o);
  let dailySpendLimit: bigint;    [dailySpendLimit, o] = readU64(data, o);
  let dailySpent: bigint;         [dailySpent, o] = readU64(data, o);
  let lastDailyReset: bigint;     [lastDailyReset, o] = readI64(data, o);
  let healthFactorBps: number;    [healthFactorBps, o] = readU16(data, o);
  let lastHealthCheck: bigint;    [lastHealthCheck, o] = readI64(data, o);
  let creditLevel: number;        [creditLevel, o] = readU8(data, o);
  let isFrozen: boolean;          [isFrozen, o] = readBool(data, o);
  let isLiquidating: boolean;     [isLiquidating, o] = readBool(data, o);
  let totalTrades: bigint;        [totalTrades, o] = readU64(data, o);
  let totalVolume: bigint;        [totalVolume, o] = readU64(data, o);
  let totalRepaid: bigint;        [totalRepaid, o] = readU64(data, o);
  let createdAt: bigint;          [createdAt, o] = readI64(data, o);
  let bump: number;               [bump, o] = readU8(data, o);
  let usdcBump: number;           [usdcBump, o] = readU8(data, o);
  return {
    agent, owner, config, walletUsdc, collateralShares, creditLimit, creditDrawn,
    totalDebt, dailySpendLimit, dailySpent, lastDailyReset, healthFactorBps,
    lastHealthCheck, creditLevel, isFrozen, isLiquidating, totalTrades,
    totalVolume, totalRepaid, createdAt, bump, usdcBump,
  };
}

function decodeRouterConfig(data: Buffer): RouterConfig {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.RouterConfig, 'RouterConfig');
  let o = 8;
  let admin: PublicKey;            [admin, o] = readPubkey(data, o);
  let oracle: PublicKey;           [oracle, o] = readPubkey(data, o);
  let usdcMint: PublicKey;        [usdcMint, o] = readPubkey(data, o);
  let platformTreasury: PublicKey; [platformTreasury, o] = readPubkey(data, o);
  let platformFeeBps: number;     [platformFeeBps, o] = readU16(data, o);
  let isPaused: boolean;          [isPaused, o] = readBool(data, o);
  let bump: number;               [bump, o] = readU8(data, o);
  return { admin, oracle, usdcMint, platformTreasury, platformFeeBps, isPaused, bump };
}

function decodeMerchantSettlement(data: Buffer): MerchantSettlement {
  assertDiscriminator(data, ACCOUNT_DISCRIMINATORS.MerchantSettlement, 'MerchantSettlement');
  let o = 8;
  let merchant: PublicKey;              [merchant, o] = readPubkey(data, o);
  let agentWalletPda: PublicKey;        [agentWalletPda, o] = readPubkey(data, o);
  let hasActiveCredit: boolean;         [hasActiveCredit, o] = readBool(data, o);
  let splitBps: number;                 [splitBps, o] = readU16(data, o);
  let totalRouted: bigint;              [totalRouted, o] = readU64(data, o);
  let totalRepaid: bigint;              [totalRepaid, o] = readU64(data, o);
  let totalMerchantReceived: bigint;    [totalMerchantReceived, o] = readU64(data, o);
  let nonce: bigint;                    [nonce, o] = readU64(data, o);
  let isActive: boolean;               [isActive, o] = readBool(data, o);
  let bump: number;                    [bump, o] = readU8(data, o);
  return {
    merchant, agentWalletPda, hasActiveCredit, splitBps,
    totalRouted, totalRepaid, totalMerchantReceived, nonce, isActive, bump,
  };
}

// ---------------------------------------------------------------------------
// Public Read API
// ---------------------------------------------------------------------------

export async function readRegistryConfig(): Promise<RegistryConfig | null> {
  const data = await fetchAccountData(registryConfigPda());
  return data ? decodeRegistryConfig(data) : null;
}

export async function readAgentProfile(agent: PublicKey): Promise<AgentProfile | null> {
  const data = await fetchAccountData(agentProfilePda(agent));
  return data ? decodeAgentProfile(data) : null;
}

export async function readVaultConfig(): Promise<VaultConfig | null> {
  const data = await fetchAccountData(vaultConfigPda());
  return data ? decodeVaultConfig(data) : null;
}

export async function readDepositPosition(depositor: PublicKey): Promise<DepositPosition | null> {
  const data = await fetchAccountData(depositPositionPda(depositor));
  return data ? decodeDepositPosition(data) : null;
}

export async function readCollateralPosition(agent: PublicKey): Promise<DepositPosition | null> {
  const data = await fetchAccountData(collateralPositionPda(agent));
  return data ? decodeDepositPosition(data) : null;
}

export async function readCreditLine(agent: PublicKey): Promise<CreditLine | null> {
  const data = await fetchAccountData(creditLinePda(agent));
  return data ? decodeCreditLine(data) : null;
}

export async function readWalletConfig(): Promise<WalletConfig | null> {
  const data = await fetchAccountData(walletConfigPda());
  return data ? decodeWalletConfig(data) : null;
}

export async function readAgentWallet(agent: PublicKey): Promise<AgentWallet | null> {
  const data = await fetchAccountData(agentWalletPda(agent));
  return data ? decodeAgentWallet(data) : null;
}

export async function readRouterConfig(): Promise<RouterConfig | null> {
  const data = await fetchAccountData(routerConfigPda());
  return data ? decodeRouterConfig(data) : null;
}

export async function readMerchantSettlement(merchant: PublicKey): Promise<MerchantSettlement | null> {
  const data = await fetchAccountData(settlementPda(merchant));
  return data ? decodeMerchantSettlement(data) : null;
}

/**
 * Fetch all AgentWallet accounts using getProgramAccounts filtered by
 * the AgentWallet account discriminator.
 */
export async function getAllAgentWallets(): Promise<Array<{ pubkey: PublicKey; wallet: AgentWallet }>> {
  const disc = ACCOUNT_DISCRIMINATORS.AgentWallet;
  const accounts = await solanaConnection.getProgramAccounts(
    PROGRAM_IDS.agentWallet,
    {
      commitment: 'confirmed',
      filters: [
        { memcmp: { offset: 0, bytes: disc.toString('base64'), encoding: 'base64' } },
      ],
    },
  );

  const results: Array<{ pubkey: PublicKey; wallet: AgentWallet }> = [];
  for (const { pubkey, account } of accounts) {
    try {
      const wallet = decodeAgentWallet(account.data as Buffer);
      results.push({ pubkey, wallet });
    } catch {
      // skip malformed accounts
    }
  }
  return results;
}

/** Read USDC token account balance for a given SPL token account address. */
export async function readTokenBalance(tokenAccountAddress: PublicKey): Promise<bigint> {
  try {
    const info = await solanaConnection.getTokenAccountBalance(tokenAccountAddress, 'confirmed');
    return BigInt(info.value.amount);
  } catch {
    return 0n;
  }
}
