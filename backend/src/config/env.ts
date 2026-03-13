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
  SOLANA_REGISTRY_PROGRAM_ID: z.string().optional().default('KrXAgReg11111111111111111111111111111111111'),
  SOLANA_VAULT_PROGRAM_ID:    z.string().optional().default('KrXAcvt111111111111111111111111111111111111'),
  SOLANA_WALLET_PROGRAM_ID:   z.string().optional().default('KrXAWaT111111111111111111111111111111111111'),
  SOLANA_VENUE_PROGRAM_ID:    z.string().optional().default('KrXAvwT111111111111111111111111111111111111'),
  SOLANA_ROUTER_PROGRAM_ID:   z.string().optional().default('KrXAprt111111111111111111111111111111111111'),

  // USDC mint on the target network (devnet / mainnet)
  SOLANA_USDC_MINT: z.string().optional().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),

  // Oracle signing keypair (base58-encoded secret key)
  SOLANA_ORACLE_PRIVATE_KEY: z.string().optional().default(''),

  // Keeper signing keypair (base58-encoded secret key)
  SOLANA_KEEPER_PRIVATE_KEY: z.string().optional().default(''),

  // KYA — Sumsub integration (optional for dev)
  SUMSUB_API_KEY: z.string().optional().default(''),

  // CORS
  CORS_ORIGIN: z.string().optional().default(''),

  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
