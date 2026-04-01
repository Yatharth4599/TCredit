import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export const PROGRAM_IDS = {
  AGENT_REGISTRY: new PublicKey("ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG"),
  CREDIT_VAULT: new PublicKey("26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N"),
  AGENT_WALLET: new PublicKey("35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6"),
  VENUE_WHITELIST: new PublicKey("HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua"),
  PAYMENT_ROUTER: new PublicKey("2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8"),
  SERVICE_PLAN: new PublicKey("Eqc48c6TtKAPRosTMoC6Nasi85iqdLuzwbu6WBrsPFdt"),
  SCORE: new PublicKey("2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh"),
} as const;

export const USDC_MINT = new PublicKey("H2SYsnzdRXrXpHpcDkedARksoxiQLGXjtAvkJg158ETP");

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
export const DEFAULT_API_URL = "https://tcredit-backend.onrender.com/api/v1";

export const PDA_SEEDS = {
  REGISTRY_CONFIG: Buffer.from("registry_config"),
  AGENT_PROFILE: Buffer.from("agent_profile"),
  WALLET_CONFIG: Buffer.from("wallet_config"),
  AGENT_WALLET: Buffer.from("agent_wallet"),
  WALLET_USDC: Buffer.from("wallet_usdc"),
  VAULT_CONFIG: Buffer.from("vault_config"),
  LP_DEPOSIT: Buffer.from("lp_deposit"),
  COLLATERAL: Buffer.from("collateral"),
  CREDIT_LINE: Buffer.from("credit_line"),
  KREXIT_SCORE: Buffer.from("krexit_score"),
  VENUE_EXPOSURE: Buffer.from("venue_exposure"),
  OWNERSHIP_TRANSFER: Buffer.from("ownership_transfer"),
  WHITELIST_CONFIG: Buffer.from("whitelist_config"),
  VENUE: Buffer.from("venue"),
  ROUTER_CONFIG: Buffer.from("router_config"),
  SETTLEMENT: Buffer.from("settlement"),
  REVENUE_VALIDATOR: Buffer.from("revenue_validator"),
  PAYMENT_HISTORY: Buffer.from("payment_history"),
  GLOBAL_BLOCKLIST: Buffer.from("global_blocklist"),
  PLATFORM_WHITELIST: Buffer.from("platform_whitelist"),
  SERVICE_PLAN_CONFIG: Buffer.from("service_plan_config"),
  SERVICE_PLAN: Buffer.from("service_plan"),
  EXPENSE_DESTINATION: Buffer.from("expense_dest"),
} as const;

export const PROTOCOL = {
  MAX_CREDIT_SCORE: 850,
  MIN_CREDIT_SCORE: 200,
  DEFAULT_CREDIT_SCORE: 400,
  HF_HEALTHY: 15_000,
  HF_WARNING: 13_000,
  HF_DANGER: 12_000,
  HF_LIQUIDATION: 10_500,
  HF_DECIMALS: 10_000,
  BPS_DENOMINATOR: 10_000,
  SECONDS_PER_YEAR: 31_536_000,
  USDC_DECIMALS: 6,
  USDC_ONE: 1_000_000,
  LEVEL_1_MAX_CREDIT: 500_000_000,
  LEVEL_2_MAX_CREDIT: 20_000_000_000,
  LEVEL_3_MAX_CREDIT: 50_000_000_000,
  LEVEL_4_MAX_CREDIT: 500_000_000_000,
  LEVEL_1_RATE_BPS: 3_650,
  LEVEL_2_RATE_BPS: 2_920,
  LEVEL_3_RATE_BPS: 2_190,
  LEVEL_4_RATE_BPS: 1_825,
  LEVEL_1_NAV_TRIGGER_BPS: 9_000,
  LEVEL_2_NAV_TRIGGER_BPS: 8_500,
  LEVEL_3_NAV_TRIGGER_BPS: 8_000,
  LEVEL_4_NAV_TRIGGER_BPS: 8_000,
  SENIOR_APR_BPS: 1_000,
  MEZZANINE_APR_BPS: 1_200,
  JUNIOR_APR_BPS: 2_000,
};

export const CREDIT_LEVELS = [
  { name: "L0 (KYA Only)", maxCredit: 0, rateBps: 0, scoreMin: 0 },
  { name: "L1 (Micro)", maxCredit: 500, rateBps: 3_650, scoreMin: 200 },
  { name: "L2 (Standard)", maxCredit: 20_000, rateBps: 2_920, scoreMin: 500 },
  { name: "L3 (Growth)", maxCredit: 50_000, rateBps: 2_190, scoreMin: 650 },
  { name: "L4 (Prime)", maxCredit: 500_000, rateBps: 1_825, scoreMin: 750 },
];

export const AGENT_TYPES = ["Trader", "Service", "Hybrid"] as const;

/**
 * Load oracle keypair from environment variable.
 * NEVER hardcode private keys — this reads from SOLANA_ORACLE_PRIVATE_KEY env var.
 * Only needed for local test scripts; production commands use backend oracle co-signature.
 */
export function getOracleKeypair(): Keypair {
  const key = process.env.SOLANA_ORACLE_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "SOLANA_ORACLE_PRIVATE_KEY env var required for oracle operations. " +
      "Set it to the base58-encoded private key, or use the backend API for oracle co-signatures."
    );
  }
  return Keypair.fromSecretKey(bs58.decode(key));
}
