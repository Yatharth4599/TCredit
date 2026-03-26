import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),

  // EVM / Base fields (optional — Krexa is now Solana-native)
  BASE_RPC_URL: z.string().optional().default('https://sepolia.base.org'),
  CHAIN_ID: z.coerce.number().default(84532),

  AGENT_REGISTRY_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  PAYMENT_ROUTER_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  VAULT_FACTORY_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  SENIOR_POOL_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  GENERAL_POOL_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  MILESTONE_REGISTRY_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  USDC_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),

  KREXA_402_FACILITATOR_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  AGENT_WALLET_FACTORY_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),
  AGENT_IDENTITY_ADDRESS: z.string().optional().default('0x0000000000000000000000000000000000000000'),

  ORACLE_PRIVATE_KEY: z.string().optional().default(''),

  // Kickstart (EasyA) integration
  KICKSTART_API_URL: z.string().url().optional().default('https://kickstart.easya.io/api'),
  KICKSTART_FACTORY_ADDRESS: z.string().startsWith('0x').optional().default('0x07DFAEC8e182C5eF79844ADc70708C1c15aA60fb'),
  BASE_MAINNET_RPC_URL: z.string().url().optional().default('https://mainnet.base.org'),

  // Polymarket Trader Credit
  TRADER_VAULT_FACTORY_ADDRESS: z.string().optional().default(''),

  // ── Solana ────────────────────────────────────────────────────────────────
  SOLANA_RPC_URL: z.string().url().optional().default('https://api.devnet.solana.com'),

  // Solana program IDs (Anchor placeholder IDs by default — replace after deployment)
  SOLANA_REGISTRY_PROGRAM_ID: z.string().optional().default('ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG'),
  SOLANA_VAULT_PROGRAM_ID:    z.string().optional().default('26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N'),
  SOLANA_WALLET_PROGRAM_ID:   z.string().optional().default('35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6'),
  SOLANA_VENUE_PROGRAM_ID:    z.string().optional().default('HyWQrHG14Sw6KpKYSMiBDmVj5u7PXfLWvim6FHbBLmua'),
  SOLANA_ROUTER_PROGRAM_ID:   z.string().optional().default('2Zy3d7C28Z9dfazdysKVBQUXnvvWNshxtDEFKftG83u8'),

  // USDC mint on the target network (devnet / mainnet)
  SOLANA_USDC_MINT: z.string().optional().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),

  // Oracle signing keypair (base58-encoded secret key)
  SOLANA_ORACLE_PRIVATE_KEY: z.string().optional().default(''),

  // Keeper signing keypair (base58-encoded secret key)
  SOLANA_KEEPER_PRIVATE_KEY: z.string().optional().default(''),

  // Mainnet RPC (for score previews — recommend Helius free tier)
  SOLANA_MAINNET_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),

  // Score program ID
  SOLANA_SCORE_PROGRAM_ID: z.string().optional().default('2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh'),

  // Faucet keypair — has USDC mint authority on devnet (base58-encoded)
  SOLANA_FAUCET_PRIVATE_KEY: z.string().optional().default(''),

  // KYA — Sumsub integration (optional for dev)
  SUMSUB_API_KEY: z.string().optional().default(''),

  // CORS
  CORS_ORIGIN: z.string().optional().default(''),

  // Admin IP allowlist (comma-separated, e.g. "1.2.3.4,5.6.7.8")
  // If empty, IP filtering is disabled (dev mode). Set in production.
  ADMIN_IP_ALLOWLIST: z.string().optional().default(''),

  // Service intervals (ms)
  KEEPER_POLL_INTERVAL_MS: z.coerce.number().optional().default(2_000),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().optional().default(15_000),
  INDEXER_MAX_BLOCKS_PER_POLL: z.coerce.number().optional().default(2_000),

  // Structured logging level
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),

  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

// Production guard: warn if critical Solana keys are missing (server still starts for demo)
if (env.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!env.SOLANA_ORACLE_PRIVATE_KEY) missing.push('SOLANA_ORACLE_PRIVATE_KEY');
  if (!env.SOLANA_KEEPER_PRIVATE_KEY) missing.push('SOLANA_KEEPER_PRIVATE_KEY');
  if (missing.length > 0) {
    console.warn(`[WARN] Missing Solana signing keys — oracle/keeper operations will be disabled: ${missing.join(', ')}`);
  }
}
