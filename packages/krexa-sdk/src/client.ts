import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
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

    // Legal agreement for L3+
    if (nextLevel >= 3) {
      const hasAgreement = profile.legalAgreementSignedAt.gt(new BN(0));
      requirements.push({
        name: "Legal Agreement Signed",
        met: hasAgreement,
        current: hasAgreement ? "Yes" : "No",
        required: "Yes",
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
    const availableLiquidity = cfg.totalDeposits.sub(cfg.totalBorrowed);
    const utilizationBps = cfg.totalDeposits.isZero()
      ? 0
      : cfg.totalBorrowed.mul(new BN(10_000)).div(cfg.totalDeposits).toNumber();

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
      owner: pos.owner,
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
  let ownerType: number, creditScore: number, creditLevel: number, kyaTier: number, bump: number, agentType: number, liquidationCount: number;
  let isActive: boolean;
  let registeredAt: BN, lastScoreUpdate: BN, legalAgreementSignedAt: BN, attestationAt: BN, totalVolume: BN, totalTrades: BN, totalRepaid: BN, totalBorrowed: BN;
  let name: number[], legalAgreementHash: number[], attestationHash: number[];

  [agent, off] = readPubkey(buf, off);
  [owner, off] = readPubkey(buf, off);
  [ownerType, off] = readU8(buf, off);
  [name, off] = readBytes(buf, off, 32);
  [creditScore, off] = readU16(buf, off);
  [creditLevel, off] = readU8(buf, off);
  [kyaTier, off] = readU8(buf, off);
  [isActive, off] = readBool(buf, off);
  [registeredAt, off] = readI64(buf, off);
  [lastScoreUpdate, off] = readI64(buf, off);
  [legalAgreementHash, off] = readBytes(buf, off, 32);
  [legalAgreementSignedAt, off] = readI64(buf, off);
  [attestationHash, off] = readBytes(buf, off, 32);
  [attestationAt, off] = readI64(buf, off);
  [walletPda, off] = readPubkey(buf, off);
  [liquidationCount, off] = readU16(buf, off);
  [totalVolume, off] = readU64(buf, off);
  [totalTrades, off] = readU64(buf, off);
  [totalRepaid, off] = readU64(buf, off);
  [totalBorrowed, off] = readU64(buf, off);
  [agentType, off] = readU8(buf, off);
  [bump, off] = readU8(buf, off);

  return {
    agent, owner, ownerType, name, creditScore, creditLevel, kyaTier, isActive,
    registeredAt, lastScoreUpdate, legalAgreementHash, legalAgreementSignedAt,
    attestationHash, attestationAt, walletPda, liquidationCount,
    totalVolume, totalTrades, totalRepaid, totalBorrowed, agentType, bump,
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
  let admin: PublicKey, oracle: PublicKey, walletProgram: PublicKey, routerProgram: PublicKey;
  let usdcMint: PublicKey, vaultTokenAccount: PublicKey, insuranceTokenAccount: PublicKey, treasuryAccount: PublicKey;
  let totalDeposits: BN, totalBorrowed: BN, totalRepaid: BN, insuranceBalance: BN, lockupSeconds: BN;
  let utilizationCapBps: number, baseInterestRateBps: number, bump: number;
  let isPaused: boolean;
  let seniorDeposits: BN, seniorShares: BN, mezzanineDeposits: BN, mezzanineShares: BN;
  let juniorDeposits: BN, juniorShares: BN;
  let servicePlanProgram: PublicKey;

  [admin, off] = readPubkey(buf, off);
  [oracle, off] = readPubkey(buf, off);
  [walletProgram, off] = readPubkey(buf, off);
  [routerProgram, off] = readPubkey(buf, off);
  [usdcMint, off] = readPubkey(buf, off);
  [vaultTokenAccount, off] = readPubkey(buf, off);
  [insuranceTokenAccount, off] = readPubkey(buf, off);
  [totalDeposits, off] = readU64(buf, off);
  [totalBorrowed, off] = readU64(buf, off);
  [totalRepaid, off] = readU64(buf, off);
  [insuranceBalance, off] = readU64(buf, off);
  [utilizationCapBps, off] = readU16(buf, off);
  [baseInterestRateBps, off] = readU16(buf, off);
  [lockupSeconds, off] = readI64(buf, off);
  [treasuryAccount, off] = readPubkey(buf, off);
  [isPaused, off] = readBool(buf, off);
  [bump, off] = readU8(buf, off);
  [seniorDeposits, off] = readU64(buf, off);
  [seniorShares, off] = readU64(buf, off);
  [mezzanineDeposits, off] = readU64(buf, off);
  [mezzanineShares, off] = readU64(buf, off);
  [juniorDeposits, off] = readU64(buf, off);
  [juniorShares, off] = readU64(buf, off);
  [servicePlanProgram, off] = readPubkey(buf, off);

  return {
    admin, oracle, walletProgram, routerProgram, usdcMint, vaultTokenAccount,
    insuranceTokenAccount, totalDeposits, totalBorrowed, totalRepaid, insuranceBalance,
    utilizationCapBps, baseInterestRateBps, lockupSeconds, treasuryAccount,
    isPaused, bump, seniorDeposits, seniorShares, mezzanineDeposits, mezzanineShares,
    juniorDeposits, juniorShares, servicePlanProgram,
  };
}

function deserializeCreditLine(buf: Buffer): CreditLine {
  let off = 0;
  let agent: PublicKey;
  let creditLimit: BN, creditDrawn: BN, accruedInterest: BN, originatedAt: BN, lastAccrualAt: BN;
  let interestRateBps: number, creditLevel: number, bump: number;
  let isActive: boolean;

  [agent, off] = readPubkey(buf, off);
  [creditLimit, off] = readU64(buf, off);
  [creditDrawn, off] = readU64(buf, off);
  [accruedInterest, off] = readU64(buf, off);
  [interestRateBps, off] = readU16(buf, off);
  [originatedAt, off] = readI64(buf, off);
  [lastAccrualAt, off] = readI64(buf, off);
  [creditLevel, off] = readU8(buf, off);
  [isActive, off] = readBool(buf, off);
  [bump, off] = readU8(buf, off);

  return {
    agent, creditLimit, creditDrawn, accruedInterest, interestRateBps,
    originatedAt, lastAccrualAt, creditLevel, isActive, bump,
  };
}

function deserializeDepositPosition(buf: Buffer): DepositPosition {
  let off = 0;
  let owner: PublicKey;
  let depositAmount: BN, shares: BN, depositedAt: BN;
  let tranche: number, bump: number;
  let isCollateral: boolean;

  [owner, off] = readPubkey(buf, off);
  [depositAmount, off] = readU64(buf, off);
  [shares, off] = readU64(buf, off);
  [depositedAt, off] = readI64(buf, off);
  [tranche, off] = readU8(buf, off);
  [isCollateral, off] = readBool(buf, off);
  [bump, off] = readU8(buf, off);

  return { owner, depositAmount, shares, depositedAt, tranche, isCollateral, bump };
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

export { AgentModule, VaultModule, LPModule };
