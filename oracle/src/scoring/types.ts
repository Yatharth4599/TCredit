import { PublicKey } from "@solana/web3.js";

export interface AgentData {
  agentPubkey: PublicKey;
  agentType: "Trader" | "Service" | "Hybrid";
  registeredAt: number;

  repaymentEvents: Array<{
    type: "on_time" | "early" | "late" | "missed" | "liquidation" | "default";
    timestamp: number;
    amount: number;
  }>;

  currentDebt: number;
  walletValue: number;
  originalCredit: number;
  cumulativeRevenue: number;
  cumulativeExpenses: number;
  dailyPnlHistory: number[];

  navHistory: Array<{
    timestamp: number;
    zone: "Green" | "Yellow" | "Orange" | "Red";
  }>;

  revenueHealthHistory: Array<{
    timestamp: number;
    health: "Green" | "Yellow" | "Orange" | "Red";
  }>;

  transactions: Array<{
    venue: string;
    timestamp: number;
    volume: number;
  }>;

  creditCyclesCompleted: number;
  lifetimeVolume: number;

  // Computed metrics (set by engine — legacy, no longer computed)
  pnlRatio?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  greenTimePct?: number;
  yellowTimePct?: number;
  orangeTimePct?: number;
  redTimePct?: number;
  venueEntropy?: number;
  uniqueVenues?: number;
  avgDailyVolume?: number;
  revenueHealthRatio?: number;
  milestoneCompletionRate?: number;
}

export interface ScoreResult {
  score: number;            // 200-850 final Krexit Score
  level: number;            // 1-4 credit level
  fairscaleBase: number;    // FairScale-derived base (200-850) or 400 default
  modifierTotal: number;    // sum of on-chain Krexa adjustments
  attestationHash: string;  // FairScale payload_hash for audit trail
}
