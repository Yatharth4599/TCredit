import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";

interface Wallet {
  signTransaction<T>(tx: T): Promise<T>;
  signAllTransactions<T>(txs: T[]): Promise<T[]>;
  publicKey: PublicKey;
}
import BN from "bn.js";
import {
  PROGRAM_IDS,
  type AgentProfile,
  type AgentWallet,
  type VaultConfig,
  type CreditLine,
  type DepositPosition,
  type ServicePlan,
  type RevenueValidator,
  type VaultStats,
  type AgentHealth,
  type LPPosition,
  type CreditTerms,
  type Milestone,
  type KrexitScore,
  type ScoreHistoryEntry,
  CreditLevel,
  KyaTier,
  Tranche,
  WalletStatus,
  PROTOCOL_CONSTANTS,
} from "./types.js";
import * as pda from "./pda.js";
import {
  lamportsToUsdc,
  calculateHealthFactor,
  calculateSimpleInterest,
  getCreditTerms,
} from "./utils.js";

export interface KrexaClientConfig {
  connection: Connection;
  wallet?: Wallet;
  /** Override default program IDs (e.g. for devnet/localnet). */
  programIds?: Partial<typeof PROGRAM_IDS>;
}

/**
 * KrexaClient — direct Solana program interaction.
 *
 * Read-only operations work without a wallet.
 * Write operations require a wallet to be provided.
 */
export class KrexaClient {
  readonly connection: Connection;
  readonly provider: AnchorProvider | null;
  readonly ids: typeof PROGRAM_IDS;

  constructor(config: KrexaClientConfig) {
    this.connection = config.connection;
    this.ids = { ...PROGRAM_IDS, ...config.programIds } as typeof PROGRAM_IDS;

    if (config.wallet) {
      this.provider = new AnchorProvider(
        config.connection,
        config.wallet,
        { commitment: "confirmed" }
      );
    } else {
      this.provider = null;
    }
  }

  // ─── Account Fetchers ──────────────────────────────────────────────────────

  get agent() { return new AgentModule(this); }
  get vault() { return new VaultModule(this); }
  get lp() { return new LPModule(this); }
  get score() { return new ScoreModule(this); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Module
// ─────────────────────────────────────────────────────────────────────────────

class AgentModule {
  constructor(private client: KrexaClient) {}

  /** Fetch an agent's on-chain profile. */
  async getProfile(agent: PublicKey): Promise<AgentProfile | null> {
    const [profilePda] = pda.findAgentProfile(agent);
    const info = await this.client.connection.getAccountInfo(profilePda);
    if (!info) return null;
    // Skip 8-byte Anchor discriminator
    return deserializeAgentProfile(info.data.slice(8));
  }

  /** Fetch an agent's wallet state. */
  async getWallet(agent: PublicKey): Promise<AgentWallet | null> {
    const [walletPda] = pda.findAgentWallet(agent);
    const info = await this.client.connection.getAccountInfo(walletPda);
    if (!info) return null;
    return deserializeAgentWallet(info.data.slice(8));
  }

  /** Compute the agent's health status. */
  async getHealth(agent: PublicKey): Promise<AgentHealth | null> {
    const wallet = await this.getWallet(agent);
    if (!wallet) return null;

    const walletBalance = new BN(
      (await this.client.connection.getTokenAccountBalance(wallet.walletUsdc)).value.amount
    );

    // Estimate collateral value from vault
    let collateralValue = new BN(0);
    if (wallet.collateralShares.gt(new BN(0))) {
      const [vaultCfg] = pda.findVaultConfig();
      const vaultInfo = await this.client.connection.getAccountInfo(vaultCfg);
      if (vaultInfo) {
        // Simplified: collateral value ≈ shares (1:1 at init)
        collateralValue = wallet.collateralShares;
      }
    }

    const hfBps = calculateHealthFactor(walletBalance, collateralValue, wallet.totalDebt);

    let status = WalletStatus.Active;
    if (wallet.isLiquidating) status = WalletStatus.Liquidating;
    else if (hfBps < PROTOCOL_CONSTANTS.HF_DANGER) status = WalletStatus.Deleveraging;
    else if (hfBps < PROTOCOL_CONSTANTS.HF_WARNING) status = WalletStatus.Warning;

    // Fetch credit line for interest breakdown
    let accruedInterest = new BN(0);
    const [clPda] = pda.findCreditLine(agent);
    const clInfo = await this.client.connection.getAccountInfo(clPda);
    if (clInfo) {
      const cl = deserializeCreditLine(clInfo.data.slice(8));
      accruedInterest = cl.accruedInterest;
    }

    return {
      healthFactorBps: hfBps,
      healthFactor: (hfBps / PROTOCOL_CONSTANTS.HF_DECIMALS).toFixed(4),
      status,
      walletBalance,
      collateralValue,
      totalDebt: wallet.totalDebt,
      creditDrawn: wallet.creditDrawn,
      accruedInterest,
    };
  }

  /** Get credit terms for an agent based on their profile. */
  async getTerms(agent: PublicKey): Promise<CreditTerms | null> {
    const profile = await this.getProfile(agent);
    if (!profile) return null;

    const level = profile.creditLevel;
    const terms = getCreditTerms(level);
    const kyaRequired = level <= 2 ? KyaTier.Basic : KyaTier.Enhanced;

    return {
      creditLevel: level as CreditLevel,
      maxCredit: terms.maxCredit,
      interestRateBps: terms.interestRateBps,
      interestRateDaily: terms.interestRateDaily,
      interestRateAnnual: terms.interestRateAnnual,
      navTriggerBps: terms.navTriggerBps,
      kyaRequired,
      collateralRequired: terms.collateralRequired,
      leverageRatio: terms.leverageRatio,
    };
  }

  /** Get credit line details. */
  async getCreditLine(agent: PublicKey): Promise<CreditLine | null> {
    const [clPda] = pda.findCreditLine(agent);
    const info = await this.client.connection.getAccountInfo(clPda);
    if (!info) return null;
    return deserializeCreditLine(info.data.slice(8));
  }

  /** Get service plan for Type B agents. */
  async getServicePlan(agent: PublicKey): Promise<ServicePlan | null> {
    const [planPda] = pda.findServicePlan(agent);
    const info = await this.client.connection.getAccountInfo(planPda);
    if (!info) return null;
    return deserializeServicePlan(info.data.slice(8));
  }

  /** Get revenue validator for an agent. */
  async getRevenueValidator(agent: PublicKey): Promise<RevenueValidator | null> {
    const [valPda] = pda.findRevenueValidator(agent);
    const info = await this.client.connection.getAccountInfo(valPda);
    if (!info) return null;
    return deserializeRevenueValidator(info.data.slice(8));
  }

  /** Check if agent is eligible for a level upgrade. */
  async checkLevelUpgrade(agent: PublicKey): Promise<{
    currentLevel: CreditLevel;
    nextLevel: CreditLevel | null;
    eligible: boolean;
    requirements: Array<{ name: string; met: boolean; current: string; required: string }>;
  }> {
    const profile = await this.getProfile(agent);
    if (!profile) throw new Error("Agent profile not found");

    const currentLevel = profile.creditLevel as CreditLevel;
    if (currentLevel >= CreditLevel.Elite) {
      return { currentLevel, nextLevel: null, eligible: false, requirements: [] };
    }

    const nextLevel = (currentLevel + 1) as CreditLevel;
    const requirements: Array<{ name: string; met: boolean; current: string; required: string }> = [];

    // KYA requirement
    const requiredKya = nextLevel <= 2 ? KyaTier.Basic : KyaTier.Enhanced;
    requirements.push({
      name: "KYA Tier",
      met: profile.kyaTier >= requiredKya,
      current: KyaTier[profile.kyaTier] ?? "None",
      required: KyaTier[requiredKya],
    });

    // Score requirement (heuristic thresholds)
    const scoreThresholds = [0, 200, 400, 550, 700];
    requirements.push({
      name: "Credit Score",
      met: profile.creditScore >= scoreThresholds[nextLevel],
      current: profile.creditScore.toString(),
      required: scoreThresholds[nextLevel].toString(),
    });

    // No liquidations for L3+
    if (nextLevel >= 3) {
      requirements.push({
        name: "No Recent Liquidations",
        met: profile.liquidationCount === 0,
        current: profile.liquidationCount.toString(),
        required: "0",
      });
    }

    const eligible = requirements.every((r) => r.met);
    return { currentLevel, nextLevel, eligible, requirements };
  }

  /** Estimate time to repay current debt. */
  async estimateRepaymentTime(agent: PublicKey): Promise<{
    currentDebt: BN;
    dailyInterest: BN;
    avgDailyRevenue: BN;
    estimatedDays: number;
    estimatedDate: Date;
  } | null> {
    const wallet = await this.getWallet(agent);
    if (!wallet || wallet.totalDebt.isZero()) return null;

    const cl = await this.getCreditLine(agent);
    const rateBps = cl?.interestRateBps ?? PROTOCOL_CONSTANTS.LEVEL_1_RATE_BPS;
    const dailyInterest = calculateSimpleInterest(wallet.creditDrawn, rateBps, 86400);

    // Estimate avg daily revenue from service plan if available
    const plan = await this.getServicePlan(agent);
    const avgDailyRevenue = plan?.projectedRevenue ?? new BN(0);

    let estimatedDays = 0;
    if (avgDailyRevenue.gt(dailyInterest)) {
      // days = totalDebt / (avgDailyRevenue - dailyInterest)
      estimatedDays = wallet.totalDebt
        .div(avgDailyRevenue.sub(dailyInterest))
        .toNumber();
    } else {
      estimatedDays = Infinity;
    }

    const estimatedDate = new Date();
    if (isFinite(estimatedDays)) {
      estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);
    }

    return {
      currentDebt: wallet.totalDebt,
      dailyInterest,
      avgDailyRevenue,
      estimatedDays,
      estimatedDate,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vault Module
// ─────────────────────────────────────────────────────────────────────────────

class VaultModule {
  constructor(private client: KrexaClient) {}

  /** Fetch vault configuration and compute stats. */
  async getStats(): Promise<VaultStats | null> {
    const [vaultPda] = pda.findVaultConfig();
    const info = await this.client.connection.getAccountInfo(vaultPda);
    if (!info) return null;

    const cfg = deserializeVaultConfig(info.data.slice(8));
    const availableLiquidity = cfg.totalDeposits.sub(cfg.totalDeployed);
    const utilizationBps = cfg.totalDeposits.isZero()
      ? 0
      : cfg.totalDeployed.mul(new BN(10_000)).div(cfg.totalDeposits).toNumber();

    return {
      totalDeposits: cfg.totalDeposits,
      totalBorrowed: cfg.totalBorrowed,
      availableLiquidity,
      utilizationBps,
      utilizationPct: (utilizationBps / 100).toFixed(2) + "%",
      insuranceBalance: cfg.insuranceBalance,
      isPaused: cfg.isPaused,
      tranches: {
        senior: { deposits: cfg.seniorDeposits, shares: cfg.seniorShares, aprBps: PROTOCOL_CONSTANTS.SENIOR_APR_BPS },
        mezzanine: { deposits: cfg.mezzanineDeposits, shares: cfg.mezzanineShares, aprBps: PROTOCOL_CONSTANTS.MEZZANINE_APR_BPS },
        junior: { deposits: cfg.juniorDeposits, shares: cfg.juniorShares, aprBps: PROTOCOL_CONSTANTS.JUNIOR_APR_BPS },
      },
    };
  }

  /** Get tranche-specific stats. */
  async getTrancheStats(tranche: Tranche): Promise<{
    deposits: BN; shares: BN; aprBps: number; sharePrice: string; utilizationBps: number;
  } | null> {
    const stats = await this.getStats();
    if (!stats) return null;

    const t = tranche === Tranche.Senior ? stats.tranches.senior
      : tranche === Tranche.Mezzanine ? stats.tranches.mezzanine
      : stats.tranches.junior;

    const sharePrice = t.shares.isZero()
      ? "1.000000"
      : lamportsToUsdc(t.deposits.mul(new BN(1_000_000)).div(t.shares));

    return {
      ...t,
      sharePrice,
      utilizationBps: stats.utilizationBps,
    };
  }

  /** Get revenue breakdown for the protocol. */
  async getRevenueBreakdown(): Promise<{
    dailyAgentRevenue: BN;
    dailyProtocolFee: BN;
    dailySeniorYield: BN;
    dailyMezzYield: BN;
    dailyJuniorYield: BN;
    dailySurplus: BN;
    dailyInsurance: BN;
    dailyTreasury: BN;
  } | null> {
    const stats = await this.getStats();
    if (!stats) return null;

    // Estimate daily revenue from current utilization and blended rate
    // Blended rate ≈ weighted average of active credit lines
    const blendedRateBps = PROTOCOL_CONSTANTS.LEVEL_2_RATE_BPS; // default estimate
    const dailyAgentRevenue = calculateSimpleInterest(stats.totalBorrowed, blendedRateBps, 86400);
    const dailyProtocolFee = dailyAgentRevenue.mul(new BN(PROTOCOL_CONSTANTS.PROTOCOL_FEE_BPS)).div(new BN(10_000));

    // Tranche yields (owed amount per day = deposits × APR / 365)
    const dailySeniorYield = calculateSimpleInterest(stats.tranches.senior.deposits, PROTOCOL_CONSTANTS.SENIOR_APR_BPS, 86400);
    const dailyMezzYield = calculateSimpleInterest(stats.tranches.mezzanine.deposits, PROTOCOL_CONSTANTS.MEZZANINE_APR_BPS, 86400);
    const dailyJuniorYield = calculateSimpleInterest(stats.tranches.junior.deposits, PROTOCOL_CONSTANTS.JUNIOR_APR_BPS, 86400);

    const totalTrancheYield = dailySeniorYield.add(dailyMezzYield).add(dailyJuniorYield);
    const afterFee = dailyAgentRevenue.sub(dailyProtocolFee);
    const dailySurplus = afterFee.gt(totalTrancheYield) ? afterFee.sub(totalTrancheYield) : new BN(0);

    // Surplus split (simplified: assume pre-target)
    const dailyInsurance = dailySurplus.mul(new BN(4_000)).div(new BN(10_000));
    const dailyTreasury = dailySurplus.sub(dailyInsurance);

    return {
      dailyAgentRevenue,
      dailyProtocolFee,
      dailySeniorYield,
      dailyMezzYield,
      dailyJuniorYield,
      dailySurplus,
      dailyInsurance,
      dailyTreasury,
    };
  }

  /** Get loss buffer status. */
  async getLossBufferStatus(): Promise<{
    insuranceBalance: BN;
    insuranceCapacity: number;
    juniorBalance: BN;
    juniorCapacity: number;
    mezzBalance: BN;
    mezzCapacity: number;
    totalDefaultsBeforeSeniorLoss: number;
  } | null> {
    const stats = await this.getStats();
    if (!stats) return null;

    // Average L2 default = $20,000 USDC
    const avgDefault = new BN(PROTOCOL_CONSTANTS.LEVEL_2_MAX_CREDIT);

    const insuranceCapacity = avgDefault.isZero() ? 0 : stats.insuranceBalance.div(avgDefault).toNumber();
    const juniorCapacity = avgDefault.isZero() ? 0 : stats.tranches.junior.deposits.div(avgDefault).toNumber();
    const mezzCapacity = avgDefault.isZero() ? 0 : stats.tranches.mezzanine.deposits.div(avgDefault).toNumber();

    return {
      insuranceBalance: stats.insuranceBalance,
      insuranceCapacity,
      juniorBalance: stats.tranches.junior.deposits,
      juniorCapacity,
      mezzBalance: stats.tranches.mezzanine.deposits,
      mezzCapacity,
      totalDefaultsBeforeSeniorLoss: insuranceCapacity + juniorCapacity + mezzCapacity,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LP Module
// ─────────────────────────────────────────────────────────────────────────────

class LPModule {
  constructor(private client: KrexaClient) {}

  /** Get LP position for a given owner and tranche. */
  async getPosition(owner: PublicKey, tranche: Tranche): Promise<LPPosition | null> {
    const [posPda] = pda.findLpDeposit(owner, tranche);
    const info = await this.client.connection.getAccountInfo(posPda);
    if (!info) return null;

    const pos = deserializeDepositPosition(info.data.slice(8));
    if (pos.isCollateral) return null; // Not an LP position

    // Estimate current value
    const stats = await this.client.vault.getTrancheStats(tranche);
    let estimatedValue = pos.depositAmount;
    let estimatedYield = new BN(0);
    if (stats && !stats.shares.isZero()) {
      estimatedValue = pos.shares.mul(stats.deposits).div(stats.shares);
      estimatedYield = estimatedValue.sub(pos.depositAmount);
    }

    return {
      owner: pos.depositor,
      tranche,
      depositAmount: pos.depositAmount,
      shares: pos.shares,
      depositedAt: pos.depositedAt,
      estimatedValue,
      estimatedYield,
    };
  }

  /** Get all LP positions for an owner across all tranches. */
  async getAllPositions(owner: PublicKey): Promise<Map<Tranche, LPPosition>> {
    const positions = new Map<Tranche, LPPosition>();
    const results = await Promise.allSettled([
      this.getPosition(owner, Tranche.Senior),
      this.getPosition(owner, Tranche.Mezzanine),
      this.getPosition(owner, Tranche.Junior),
    ]);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled" && result.value) {
        positions.set(i as Tranche, result.value);
      }
    }
    return positions;
  }

  /** Preview a deposit — estimate shares received and effective APY. */
  async previewDeposit(tranche: Tranche, amount: BN): Promise<{
    sharesReceived: BN;
    effectiveApyBps: number;
    dailyYield: BN;
  }> {
    const stats = await this.client.vault.getTrancheStats(tranche);
    let sharesReceived: BN;

    if (!stats || stats.shares.isZero()) {
      sharesReceived = amount; // 1:1 at init
    } else {
      sharesReceived = amount.mul(stats.shares).div(stats.deposits);
    }

    const aprBps = stats?.aprBps ?? PROTOCOL_CONSTANTS.SENIOR_APR_BPS;
    const dailyYield = calculateSimpleInterest(amount, aprBps, 86400);

    return {
      sharesReceived,
      effectiveApyBps: aprBps,
      dailyYield,
    };
  }

  /** Preview a withdrawal — estimate USDC received. */
  async previewWithdraw(tranche: Tranche, shares: BN): Promise<{
    usdcReceived: BN;
    sharePrice: string;
  }> {
    const stats = await this.client.vault.getTrancheStats(tranche);
    let usdcReceived: BN;

    if (!stats || stats.shares.isZero()) {
      usdcReceived = shares;
    } else {
      usdcReceived = shares.mul(stats.deposits).div(stats.shares);
    }

    return {
      usdcReceived,
      sharePrice: stats?.sharePrice ?? "1.000000",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Module
// ─────────────────────────────────────────────────────────────────────────────

class ScoreModule {
  constructor(private client: KrexaClient) {}

  /** Fetch an agent's krexit score. */
  async getScore(agent: PublicKey): Promise<KrexitScore | null> {
    const [scorePda] = pda.findKrexitScore(agent);
    const info = await this.client.connection.getAccountInfo(scorePda);
    if (!info) return null;
    return deserializeKrexitScore(info.data.slice(8));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Borsh deserialization helpers (manual, matching Anchor account layout)
// ─────────────────────────────────────────────────────────────────────────────

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

function deserializeAgentProfile(buf: Buffer): AgentProfile {
  let off = 0;
  let agent: PublicKey, owner: PublicKey, walletPda: PublicKey;
  let creditScore: number, creditLevel: number, kyaTier: number, bump: number, agentType: number, liquidationCount: number;
  let hasWallet: boolean, isActive: boolean;
  let registeredAt: BN, kyaVerifiedAt: BN, scoreUpdatedAt: BN;
  let totalVolume: BN, totalTrades: BN, totalRepaid: BN, totalBorrowed: BN;
  let name: number[];

  // Matches krexa-agent-registry AgentProfile struct layout exactly
  [agent, off]          = readPubkey(buf, off);        // 32
  [owner, off]          = readPubkey(buf, off);        // 32
  [name, off]           = readBytes(buf, off, 32);     // 32
  [creditScore, off]    = readU16(buf, off);           // 2
  [creditLevel, off]    = readU8(buf, off);            // 1
  [kyaTier, off]        = readU8(buf, off);            // 1
  [kyaVerifiedAt, off]  = readI64(buf, off);           // 8
  [scoreUpdatedAt, off] = readI64(buf, off);           // 8
  [totalVolume, off]    = readU64(buf, off);           // 8
  [totalTrades, off]    = readU64(buf, off);           // 8
  [totalRepaid, off]    = readU64(buf, off);           // 8
  [totalBorrowed, off]  = readU64(buf, off);           // 8
  [liquidationCount, off] = readU8(buf, off);          // 1
  [walletPda, off]      = readPubkey(buf, off);        // 32
  [hasWallet, off]      = readBool(buf, off);          // 1
  [isActive, off]       = readBool(buf, off);          // 1
  [registeredAt, off]   = readI64(buf, off);           // 8
  [bump, off]           = readU8(buf, off);            // 1
  // agent_type added in later version — read if buffer allows
  agentType = off < buf.length ? (([agentType, off] = readU8(buf, off)), agentType) : 0;

  return {
    agent, owner, name, creditScore, creditLevel, kyaTier,
    kyaVerifiedAt, scoreUpdatedAt, totalVolume, totalTrades, totalRepaid, totalBorrowed,
    liquidationCount, walletPda, hasWallet, isActive, registeredAt, bump, agentType,
  };
}

function deserializeAgentWallet(buf: Buffer): AgentWallet {
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

function deserializeVaultConfig(buf: Buffer): VaultConfig {
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

  // Matches krexa-credit-vault VaultConfig struct layout exactly (lib.rs lines 19-59)
  [admin, off]               = readPubkey(buf, off);  // 32
  [oracle, off]              = readPubkey(buf, off);  // 32
  [walletProgram, off]       = readPubkey(buf, off);  // 32
  [usdcMint, off]            = readPubkey(buf, off);  // 32
  [vaultTokenAccount, off]   = readPubkey(buf, off);  // 32
  [insuranceTokenAccount, off] = readPubkey(buf, off); // 32
  [totalDeposits, off]       = readU64(buf, off);     // 8
  [totalShares, off]         = readU64(buf, off);     // 8
  [totalDeployed, off]       = readU64(buf, off);     // 8
  [totalInterestEarned, off] = readU64(buf, off);     // 8
  [totalDefaults, off]       = readU64(buf, off);     // 8
  [insuranceBalance, off]    = readU64(buf, off);     // 8
  [utilizationCapBps, off]   = readU16(buf, off);     // 2
  [baseInterestRateBps, off] = readU16(buf, off);     // 2
  [lockupSeconds, off]       = readI64(buf, off);     // 8
  [isPaused, off]            = readBool(buf, off);    // 1
  [bump, off]                = readU8(buf, off);      // 1
  [vaultTokenBump, off]      = readU8(buf, off);      // 1
  [insuranceTokenBump, off]  = readU8(buf, off);      // 1
  [routerProgram, off]       = readPubkey(buf, off);  // 32
  [seniorDeposits, off]      = readU64(buf, off);     // 8
  [seniorShares, off]        = readU64(buf, off);     // 8
  [mezzanineDeposits, off]   = readU64(buf, off);     // 8
  [mezzanineShares, off]     = readU64(buf, off);     // 8
  [juniorDeposits, off]      = readU64(buf, off);     // 8
  [juniorShares, off]        = readU64(buf, off);     // 8
  [treasuryAccount, off]     = readPubkey(buf, off);  // 32
  [lastYieldTimestamp, off]  = readI64(buf, off);     // 8
  [servicePlanProgram, off]  = readPubkey(buf, off);  // 32

  return {
    admin, oracle, walletProgram, usdcMint, vaultTokenAccount, insuranceTokenAccount,
    totalDeposits, totalShares, totalDeployed, totalInterestEarned, totalDefaults, insuranceBalance,
    utilizationCapBps, baseInterestRateBps, lockupSeconds,
    isPaused, bump, vaultTokenBump, insuranceTokenBump, routerProgram,
    seniorDeposits, seniorShares, mezzanineDeposits, mezzanineShares,
    juniorDeposits, juniorShares, treasuryAccount, lastYieldTimestamp, servicePlanProgram,
  };
}

function deserializeCreditLine(buf: Buffer): CreditLine {
  let off = 0;
  let agent: PublicKey, agentWalletPda: PublicKey;
  let creditLimit: BN, creditDrawn: BN, accruedInterest: BN, totalInterestPaid: BN;
  let originatedAt: BN, lastAccrualAt: BN;
  let interestRateBps: number, bump: number;
  let isActive: boolean;

  // Matches krexa-credit-vault CreditLine struct layout exactly (lib.rs lines 126-138)
  [agent, off]           = readPubkey(buf, off);  // 32
  [agentWalletPda, off]  = readPubkey(buf, off);  // 32
  [creditLimit, off]     = readU64(buf, off);     // 8
  [creditDrawn, off]     = readU64(buf, off);     // 8
  [interestRateBps, off] = readU16(buf, off);     // 2
  [accruedInterest, off] = readU64(buf, off);     // 8
  [totalInterestPaid, off] = readU64(buf, off);   // 8
  [lastAccrualAt, off]   = readI64(buf, off);     // 8
  [originatedAt, off]    = readI64(buf, off);     // 8
  [isActive, off]        = readBool(buf, off);    // 1
  [bump, off]            = readU8(buf, off);      // 1

  return {
    agent, agentWalletPda, creditLimit, creditDrawn, interestRateBps,
    accruedInterest, totalInterestPaid, lastAccrualAt, originatedAt, isActive, bump,
  };
}

function deserializeDepositPosition(buf: Buffer): DepositPosition {
  let off = 0;
  let depositor: PublicKey, agentPubkey: PublicKey;
  let shares: BN, depositAmount: BN, depositedAt: BN;
  let tranche: number, bump: number;
  let isCollateral: boolean;

  // Matches krexa-credit-vault DepositPosition struct layout exactly (lib.rs lines 107-116)
  [depositor, off]    = readPubkey(buf, off);  // 32
  [shares, off]       = readU64(buf, off);     // 8
  [depositAmount, off] = readU64(buf, off);    // 8
  [depositedAt, off]  = readI64(buf, off);     // 8
  [isCollateral, off] = readBool(buf, off);    // 1
  [agentPubkey, off]  = readPubkey(buf, off);  // 32
  [tranche, off]      = readU8(buf, off);      // 1
  [bump, off]         = readU8(buf, off);      // 1

  return { depositor, shares, depositAmount, depositedAt, isCollateral, agentPubkey, tranche, bump };
}

function deserializeServicePlan(buf: Buffer): ServicePlan {
  let off = 0;
  let agent: PublicKey, owner: PublicKey;
  let totalCredit: BN, projectedRevenue: BN, cumulativeRevenue: BN, lastRevenueAt: BN, windDownStartedAt: BN, createdAt: BN;
  let numMilestones: number, healthStatus: number, zeroRevenueDays: number, windDownStatus: number, bump: number;

  [agent, off] = readPubkey(buf, off);
  [owner, off] = readPubkey(buf, off);
  [totalCredit, off] = readU64(buf, off);

  // Milestones: 8 fixed entries
  const milestones: Milestone[] = [];
  for (let i = 0; i < 8; i++) {
    let amount: BN, conditionValue: BN, disbursedAt: BN;
    let condition: number;
    let isDisbursed: boolean;
    [amount, off] = readU64(buf, off);
    [condition, off] = readU8(buf, off);
    [conditionValue, off] = readU64(buf, off);
    [isDisbursed, off] = readBool(buf, off);
    [disbursedAt, off] = readI64(buf, off);
    milestones.push({ amount, condition, conditionValue, isDisbursed, disbursedAt });
  }

  [numMilestones, off] = readU8(buf, off);
  [projectedRevenue, off] = readU64(buf, off);
  [cumulativeRevenue, off] = readU64(buf, off);
  [healthStatus, off] = readU8(buf, off);
  [zeroRevenueDays, off] = readU8(buf, off);
  [lastRevenueAt, off] = readI64(buf, off);
  [windDownStartedAt, off] = readI64(buf, off);
  [windDownStatus, off] = readU8(buf, off);
  [createdAt, off] = readI64(buf, off);
  [bump, off] = readU8(buf, off);

  return {
    agent, owner, totalCredit, milestones, numMilestones, projectedRevenue,
    cumulativeRevenue, healthStatus, zeroRevenueDays, lastRevenueAt,
    windDownStartedAt, windDownStatus, createdAt, bump,
  };
}

function deserializeRevenueValidator(buf: Buffer): RevenueValidator {
  let off = 0;
  let agent: PublicKey;
  let expectedDailyRevenue: BN, totalCredit: BN, cumulativeValidatedRevenue: BN, totalDisbursed: BN, lastDisbursementTs: BN;
  let numRegisteredSources: number, numAssociatedWallets: number, violationCount: number, bump: number;

  [agent, off] = readPubkey(buf, off);

  const registeredSources: PublicKey[] = [];
  for (let i = 0; i < 30; i++) {
    let pk: PublicKey;
    [pk, off] = readPubkey(buf, off);
    registeredSources.push(pk);
  }
  [numRegisteredSources, off] = readU8(buf, off);

  const associatedWallets: PublicKey[] = [];
  for (let i = 0; i < 10; i++) {
    let pk: PublicKey;
    [pk, off] = readPubkey(buf, off);
    associatedWallets.push(pk);
  }
  [numAssociatedWallets, off] = readU8(buf, off);

  [expectedDailyRevenue, off] = readU64(buf, off);
  [totalCredit, off] = readU64(buf, off);
  [cumulativeValidatedRevenue, off] = readU64(buf, off);
  [totalDisbursed, off] = readU64(buf, off);
  [lastDisbursementTs, off] = readI64(buf, off);
  [violationCount, off] = readU8(buf, off);
  [bump, off] = readU8(buf, off);

  return {
    agent, registeredSources, numRegisteredSources, associatedWallets, numAssociatedWallets,
    expectedDailyRevenue, totalCredit, cumulativeValidatedRevenue, totalDisbursed,
    lastDisbursementTs, violationCount, bump,
  };
}

function deserializeKrexitScore(buf: Buffer): KrexitScore {
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

  // History: 30 fixed entries, each 15 bytes
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

export { AgentModule, VaultModule, LPModule, ScoreModule };
