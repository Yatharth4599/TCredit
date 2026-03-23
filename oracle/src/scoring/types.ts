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

  // Computed metrics (set by engine)
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
  score: number;
  level: number;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
}
