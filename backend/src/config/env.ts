import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  BASE_RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().default(84532),

  AGENT_REGISTRY_ADDRESS: z.string().startsWith('0x'),
  PAYMENT_ROUTER_ADDRESS: z.string().startsWith('0x'),
  VAULT_FACTORY_ADDRESS: z.string().startsWith('0x'),
  SENIOR_POOL_ADDRESS: z.string().startsWith('0x'),
  GENERAL_POOL_ADDRESS: z.string().startsWith('0x'),
  MILESTONE_REGISTRY_ADDRESS: z.string().startsWith('0x'),
  USDC_ADDRESS: z.string().startsWith('0x'),

  ORACLE_PRIVATE_KEY: z.string().optional().default(''),

  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
