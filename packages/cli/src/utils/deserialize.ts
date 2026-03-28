import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// Borsh deserialization helpers — exact copies from app/src/sdk/client.ts

function readPubkey(buf: Buffer, offset: number): [PublicKey, number] {
  return [new PublicKey(buf.slice(offset, offset + 32)), offset + 32];
}

function readU8(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt8(offset), offset + 1];
}

function readU16(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt16LE(offset), offset + 2];
}

function readI16(buf: Buffer, offset: number): [number, number] {
  return [buf.readInt16LE(offset), offset + 2];
}

function readU32(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt32LE(offset), offset + 4];
}

function readI32(buf: Buffer, offset: number): [number, number] {
  return [buf.readInt32LE(offset), offset + 4];
}

function readU64(buf: Buffer, offset: number): [BN, number] {
  return [new BN(buf.slice(offset, offset + 8), "le"), offset + 8];
}

function readI64(buf: Buffer, offset: number): [BN, number] {
  return [new BN(buf.slice(offset, offset + 8), "le"), offset + 8];
}

function readBool(buf: Buffer, offset: number): [boolean, number] {
  return [buf.readUInt8(offset) !== 0, offset + 1];
}

function readBytes(buf: Buffer, offset: number, len: number): [number[], number] {
  return [Array.from(buf.slice(offset, offset + len)), offset + len];
}

// Types

export interface AgentProfile {
  agent: PublicKey;
  owner: PublicKey;
  name: number[];
  creditScore: number;
  creditLevel: number;
  kyaTier: number;
  kyaVerifiedAt: BN;
  scoreUpdatedAt: BN;
  totalVolume: BN;
  totalTrades: BN;
  totalRepaid: BN;
  totalBorrowed: BN;
  liquidationCount: number;
  walletPda: PublicKey;
  hasWallet: boolean;
  isActive: boolean;
  registeredAt: BN;
  bump: number;
  agentType: number;
}

export interface AgentWallet {
  agent: PublicKey;
  owner: PublicKey;
  config: PublicKey;
  walletUsdc: PublicKey;
  collateralShares: BN;
  creditLimit: BN;
  creditDrawn: BN;
  totalDebt: BN;
  dailySpendLimit: BN;
  dailySpent: BN;
  lastDailyReset: BN;
  healthFactorBps: number;
  lastHealthCheck: BN;
  creditLevel: number;
  isFrozen: boolean;
  isLiquidating: boolean;
  totalTrades: BN;
  totalVolume: BN;
  totalRepaid: BN;
  createdAt: BN;
  bump: number;
  usdcBump: number;
  ownerType: number;
}

export interface CreditLine {
  agent: PublicKey;
  agentWalletPda: PublicKey;
  creditLimit: BN;
  creditDrawn: BN;
  interestRateBps: number;
  accruedInterest: BN;
  totalInterestPaid: BN;
  lastAccrualAt: BN;
  originatedAt: BN;
  isActive: boolean;
  bump: number;
}

export interface VaultConfig {
  admin: PublicKey;
  oracle: PublicKey;
  walletProgram: PublicKey;
  usdcMint: PublicKey;
  vaultTokenAccount: PublicKey;
  insuranceTokenAccount: PublicKey;
  totalDeposits: BN;
  totalShares: BN;
  totalDeployed: BN;
  totalInterestEarned: BN;
  totalDefaults: BN;
  insuranceBalance: BN;
  utilizationCapBps: number;
  baseInterestRateBps: number;
  lockupSeconds: BN;
  isPaused: boolean;
  bump: number;
  vaultTokenBump: number;
  insuranceTokenBump: number;
  routerProgram: PublicKey;
  seniorDeposits: BN;
  seniorShares: BN;
  mezzanineDeposits: BN;
  mezzanineShares: BN;
  juniorDeposits: BN;
  juniorShares: BN;
  treasuryAccount: PublicKey;
  lastYieldTimestamp: BN;
  servicePlanProgram: PublicKey;
}

export interface DepositPosition {
  depositor: PublicKey;
  shares: BN;
  depositAmount: BN;
  depositedAt: BN;
  isCollateral: boolean;
  agentPubkey: PublicKey;
  tranche: number;
  bump: number;
}

export interface ScoreHistoryEntry {
  timestamp: BN;
  oldScore: number;
  newScore: number;
  eventType: number;
  deltaBps: number;
}

export interface KrexitScore {
  agent: PublicKey;
  owner: PublicKey;
  score: number;
  creditLevel: number;
  kyaTier: number;
  c1Repayment: number;
  c2Profitability: number;
  c3Behavioral: number;
  c4Usage: number;
  c5Maturity: number;
  onTimeRepayments: number;
  lateRepayments: number;
  missedRepayments: number;
  liquidations: number;
  defaults: number;
  creditCyclesCompleted: number;
  cumulativeBorrowed: BN;
  cumulativeRepaid: BN;
  currentDebt: BN;
  pnlRatioBps: number;
  maxDrawdownBps: number;
  sharpeRatioBps: number;
  greenTimeBps: number;
  yellowTimeBps: number;
  orangeTimeBps: number;
  redTimeBps: number;
  venueEntropyBps: number;
  uniqueVenues: number;
  totalTransactions: number;
  avgDailyVolume: BN;
  registeredAt: BN;
  lastScoreUpdate: BN;
  lastCriticalEvent: BN;
  lastRepayment: BN;
  history: ScoreHistoryEntry[];
  historyIndex: number;
  agentType: number;
  revenueHealthBps: number;
  milestoneCompletionRateBps: number;
  isActive: boolean;
  isBlacklisted: boolean;
  bump: number;
}

// Deserializers

export function deserializeAgentProfile(buf: Buffer): AgentProfile {
  let off = 0;
  let agent: PublicKey, owner: PublicKey, walletPda: PublicKey;
  let creditScore: number, creditLevel: number, kyaTier: number, bump: number, agentType: number, liquidationCount: number;
  let hasWallet: boolean, isActive: boolean;
  let registeredAt: BN, kyaVerifiedAt: BN, scoreUpdatedAt: BN;
  let totalVolume: BN, totalTrades: BN, totalRepaid: BN, totalBorrowed: BN;
  let name: number[];

  [agent, off] = readPubkey(buf, off);
  [owner, off] = readPubkey(buf, off);
  [name, off] = readBytes(buf, off, 32);
  [creditScore, off] = readU16(buf, off);
  [creditLevel, off] = readU8(buf, off);
  [kyaTier, off] = readU8(buf, off);
  [kyaVerifiedAt, off] = readI64(buf, off);
  [scoreUpdatedAt, off] = readI64(buf, off);
  [totalVolume, off] = readU64(buf, off);
  [totalTrades, off] = readU64(buf, off);
  [totalRepaid, off] = readU64(buf, off);
  [totalBorrowed, off] = readU64(buf, off);
  [liquidationCount, off] = readU8(buf, off);
  [walletPda, off] = readPubkey(buf, off);
  [hasWallet, off] = readBool(buf, off);
  [isActive, off] = readBool(buf, off);
  [registeredAt, off] = readI64(buf, off);
  [bump, off] = readU8(buf, off);
  agentType = off < buf.length ? (([agentType, off] = readU8(buf, off)), agentType) : 0;

  return {
    agent, owner, name, creditScore, creditLevel, kyaTier,
    kyaVerifiedAt, scoreUpdatedAt, totalVolume, totalTrades, totalRepaid, totalBorrowed,
    liquidationCount, walletPda, hasWallet, isActive, registeredAt, bump, agentType,
  };
}

export function deserializeAgentWallet(buf: Buffer): AgentWallet {
  let off = 0;
  let agent: PublicKey, owner: PublicKey, config: PublicKey, walletUsdc: PublicKey;
  let collateralShares: BN, creditLimit: BN, creditDrawn: BN, totalDebt: BN;
  let dailySpendLimit: BN, dailySpent: BN, lastDailyReset: BN;
  let healthFactorBps: number, creditLevel: number, bump: number, usdcBump: number, ownerType: number;
  let lastHealthCheck: BN, totalTrades: BN, totalVolume: BN, totalRepaid: BN, createdAt: BN;
  let isFrozen: boolean, isLiquidating: boolean;

  [agent, off] = readPubkey(buf, off);
  [owner, off] = readPubkey(buf, off);
  [config, off] = readPubkey(buf, off);
  [walletUsdc, off] = readPubkey(buf, off);
  [collateralShares, off] = readU64(buf, off);
  [creditLimit, off] = readU64(buf, off);
  [creditDrawn, off] = readU64(buf, off);
  [totalDebt, off] = readU64(buf, off);
  [dailySpendLimit, off] = readU64(buf, off);
  [dailySpent, off] = readU64(buf, off);
  [lastDailyReset, off] = readI64(buf, off);
  [healthFactorBps, off] = readU16(buf, off);
  [lastHealthCheck, off] = readI64(buf, off);
  [creditLevel, off] = readU8(buf, off);
  [isFrozen, off] = readBool(buf, off);
  [isLiquidating, off] = readBool(buf, off);
  [totalTrades, off] = readU64(buf, off);
  [totalVolume, off] = readU64(buf, off);
  [totalRepaid, off] = readU64(buf, off);
  [createdAt, off] = readI64(buf, off);
  [bump, off] = readU8(buf, off);
  [usdcBump, off] = readU8(buf, off);
  [ownerType, off] = readU8(buf, off);

  return {
    agent, owner, config, walletUsdc, collateralShares, creditLimit, creditDrawn,
    totalDebt, dailySpendLimit, dailySpent, lastDailyReset, healthFactorBps,
    lastHealthCheck, creditLevel, isFrozen, isLiquidating, totalTrades,
    totalVolume, totalRepaid, createdAt, bump, usdcBump, ownerType,
  };
}

export function deserializeCreditLine(buf: Buffer): CreditLine {
  let off = 0;
  let agent: PublicKey, agentWalletPda: PublicKey;
  let creditLimit: BN, creditDrawn: BN, accruedInterest: BN, totalInterestPaid: BN;
  let originatedAt: BN, lastAccrualAt: BN;
  let interestRateBps: number, bump: number;
  let isActive: boolean;

  [agent, off] = readPubkey(buf, off);
  [agentWalletPda, off] = readPubkey(buf, off);
  [creditLimit, off] = readU64(buf, off);
  [creditDrawn, off] = readU64(buf, off);
  [interestRateBps, off] = readU16(buf, off);
  [accruedInterest, off] = readU64(buf, off);
  [totalInterestPaid, off] = readU64(buf, off);
  [lastAccrualAt, off] = readI64(buf, off);
  [originatedAt, off] = readI64(buf, off);
  [isActive, off] = readBool(buf, off);
  [bump, off] = readU8(buf, off);

  return {
    agent, agentWalletPda, creditLimit, creditDrawn, interestRateBps,
    accruedInterest, totalInterestPaid, lastAccrualAt, originatedAt, isActive, bump,
  };
}

export function deserializeVaultConfig(buf: Buffer): VaultConfig {
  let off = 0;
  let admin: PublicKey, oracle: PublicKey, walletProgram: PublicKey;
  let usdcMint: PublicKey, vaultTokenAccount: PublicKey, insuranceTokenAccount: PublicKey;
  let totalDeposits: BN, totalShares: BN, totalDeployed: BN, totalInterestEarned: BN, totalDefaults: BN, insuranceBalance: BN;
  let utilizationCapBps: number, baseInterestRateBps: number, bump: number, vaultTokenBump: number, insuranceTokenBump: number;
  let lockupSeconds: BN;
  let isPaused: boolean;
  let routerProgram: PublicKey;
  let seniorDeposits: BN, seniorShares: BN, mezzanineDeposits: BN, mezzanineShares: BN;
  let juniorDeposits: BN, juniorShares: BN;
  let treasuryAccount: PublicKey, servicePlanProgram: PublicKey;
  let lastYieldTimestamp: BN;

  [admin, off] = readPubkey(buf, off);
  [oracle, off] = readPubkey(buf, off);
  [walletProgram, off] = readPubkey(buf, off);
  [usdcMint, off] = readPubkey(buf, off);
  [vaultTokenAccount, off] = readPubkey(buf, off);
  [insuranceTokenAccount, off] = readPubkey(buf, off);
  [totalDeposits, off] = readU64(buf, off);
  [totalShares, off] = readU64(buf, off);
  [totalDeployed, off] = readU64(buf, off);
  [totalInterestEarned, off] = readU64(buf, off);
  [totalDefaults, off] = readU64(buf, off);
  [insuranceBalance, off] = readU64(buf, off);
  [utilizationCapBps, off] = readU16(buf, off);
  [baseInterestRateBps, off] = readU16(buf, off);
  [lockupSeconds, off] = readI64(buf, off);
  [isPaused, off] = readBool(buf, off);
  [bump, off] = readU8(buf, off);
  [vaultTokenBump, off] = readU8(buf, off);
  [insuranceTokenBump, off] = readU8(buf, off);
  [routerProgram, off] = readPubkey(buf, off);
  [seniorDeposits, off] = readU64(buf, off);
  [seniorShares, off] = readU64(buf, off);
  [mezzanineDeposits, off] = readU64(buf, off);
  [mezzanineShares, off] = readU64(buf, off);
  [juniorDeposits, off] = readU64(buf, off);
  [juniorShares, off] = readU64(buf, off);
  [treasuryAccount, off] = readPubkey(buf, off);
  [lastYieldTimestamp, off] = readI64(buf, off);
  [servicePlanProgram, off] = readPubkey(buf, off);

  return {
    admin, oracle, walletProgram, usdcMint, vaultTokenAccount, insuranceTokenAccount,
    totalDeposits, totalShares, totalDeployed, totalInterestEarned, totalDefaults, insuranceBalance,
    utilizationCapBps, baseInterestRateBps, lockupSeconds,
    isPaused, bump, vaultTokenBump, insuranceTokenBump, routerProgram,
    seniorDeposits, seniorShares, mezzanineDeposits, mezzanineShares,
    juniorDeposits, juniorShares, treasuryAccount, lastYieldTimestamp, servicePlanProgram,
  };
}

export function deserializeDepositPosition(buf: Buffer): DepositPosition {
  let off = 0;
  let depositor: PublicKey, agentPubkey: PublicKey;
  let shares: BN, depositAmount: BN, depositedAt: BN;
  let tranche: number, bump: number;
  let isCollateral: boolean;

  [depositor, off] = readPubkey(buf, off);
  [shares, off] = readU64(buf, off);
  [depositAmount, off] = readU64(buf, off);
  [depositedAt, off] = readI64(buf, off);
  [isCollateral, off] = readBool(buf, off);
  [agentPubkey, off] = readPubkey(buf, off);
  [tranche, off] = readU8(buf, off);
  [bump, off] = readU8(buf, off);

  return { depositor, shares, depositAmount, depositedAt, isCollateral, agentPubkey, tranche, bump };
}

export function deserializeKrexitScore(buf: Buffer): KrexitScore {
  let off = 0;
  let agent: PublicKey, owner: PublicKey;
  let score: number, creditLevel: number, kyaTier: number;
  let c1Repayment: number, c2Profitability: number, c3Behavioral: number, c4Usage: number, c5Maturity: number;
  let onTimeRepayments: number, lateRepayments: number, missedRepayments: number, liquidations: number, defaults: number;
  let creditCyclesCompleted: number;
  let cumulativeBorrowed: BN, cumulativeRepaid: BN, currentDebt: BN;
  let pnlRatioBps: number, maxDrawdownBps: number, sharpeRatioBps: number;
  let greenTimeBps: number, yellowTimeBps: number, orangeTimeBps: number, redTimeBps: number;
  let venueEntropyBps: number, uniqueVenues: number, totalTransactions: number;
  let avgDailyVolume: BN;
  let registeredAt: BN, lastScoreUpdate: BN, lastCriticalEvent: BN, lastRepayment: BN;
  let historyIndex: number, agentType: number;
  let revenueHealthBps: number, milestoneCompletionRateBps: number;
  let isActive: boolean, isBlacklisted: boolean;
  let bump: number;

  [agent, off] = readPubkey(buf, off);
  [owner, off] = readPubkey(buf, off);
  [score, off] = readU16(buf, off);
  [creditLevel, off] = readU8(buf, off);
  [kyaTier, off] = readU8(buf, off);
  [c1Repayment, off] = readU16(buf, off);
  [c2Profitability, off] = readU16(buf, off);
  [c3Behavioral, off] = readU16(buf, off);
  [c4Usage, off] = readU16(buf, off);
  [c5Maturity, off] = readU16(buf, off);
  [onTimeRepayments, off] = readU32(buf, off);
  [lateRepayments, off] = readU16(buf, off);
  [missedRepayments, off] = readU16(buf, off);
  [liquidations, off] = readU16(buf, off);
  [defaults, off] = readU16(buf, off);
  [creditCyclesCompleted, off] = readU32(buf, off);
  [cumulativeBorrowed, off] = readU64(buf, off);
  [cumulativeRepaid, off] = readU64(buf, off);
  [currentDebt, off] = readU64(buf, off);
  [pnlRatioBps, off] = readI32(buf, off);
  [maxDrawdownBps, off] = readU16(buf, off);
  [sharpeRatioBps, off] = readI16(buf, off);
  [greenTimeBps, off] = readU16(buf, off);
  [yellowTimeBps, off] = readU16(buf, off);
  [orangeTimeBps, off] = readU16(buf, off);
  [redTimeBps, off] = readU16(buf, off);
  [venueEntropyBps, off] = readU16(buf, off);
  [uniqueVenues, off] = readU8(buf, off);
  [totalTransactions, off] = readU32(buf, off);
  [avgDailyVolume, off] = readU64(buf, off);
  [registeredAt, off] = readI64(buf, off);
  [lastScoreUpdate, off] = readI64(buf, off);
  [lastCriticalEvent, off] = readI64(buf, off);
  [lastRepayment, off] = readI64(buf, off);

  const history: ScoreHistoryEntry[] = [];
  for (let i = 0; i < 30; i++) {
    let timestamp: BN;
    let oldScore: number, newScore: number, eventType: number, deltaBps: number;
    [timestamp, off] = readI64(buf, off);
    [oldScore, off] = readU16(buf, off);
    [newScore, off] = readU16(buf, off);
    [eventType, off] = readU8(buf, off);
    [deltaBps, off] = readI16(buf, off);
    history.push({ timestamp, oldScore, newScore, eventType, deltaBps });
  }

  [historyIndex, off] = readU8(buf, off);
  [agentType, off] = readU8(buf, off);
  [revenueHealthBps, off] = readU16(buf, off);
  [milestoneCompletionRateBps, off] = readU16(buf, off);
  [isActive, off] = readBool(buf, off);
  [isBlacklisted, off] = readBool(buf, off);
  [bump, off] = readU8(buf, off);

  return {
    agent, owner, score, creditLevel, kyaTier,
    c1Repayment, c2Profitability, c3Behavioral, c4Usage, c5Maturity,
    onTimeRepayments, lateRepayments, missedRepayments, liquidations, defaults,
    creditCyclesCompleted, cumulativeBorrowed, cumulativeRepaid, currentDebt,
    pnlRatioBps, maxDrawdownBps, sharpeRatioBps,
    greenTimeBps, yellowTimeBps, orangeTimeBps, redTimeBps,
    venueEntropyBps, uniqueVenues, totalTransactions, avgDailyVolume,
    registeredAt, lastScoreUpdate, lastCriticalEvent, lastRepayment,
    history, historyIndex, agentType,
    revenueHealthBps, milestoneCompletionRateBps,
    isActive, isBlacklisted, bump,
  };
}

// Utility functions

export function decodeName(nameBytes: number[]): string {
  const end = nameBytes.indexOf(0);
  const bytes = end === -1 ? nameBytes : nameBytes.slice(0, end);
  return Buffer.from(bytes).toString("utf-8");
}

export function formatUsdc(lamports: BN): string {
  const str = lamports.toString().padStart(7, "0");
  const whole = str.slice(0, -6) || "0";
  const frac = str.slice(-6).slice(0, 2);
  return `$${whole}.${frac}`;
}

export function formatUsdcFull(lamports: BN): string {
  const str = lamports.toString().padStart(7, "0");
  const whole = str.slice(0, -6) || "0";
  const frac = str.slice(-6);
  return `$${whole}.${frac}`;
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}
