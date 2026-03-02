import { env } from './env.js';
import type { Address } from 'viem';

export {
  AgentRegistryABI,
  PaymentRouterABI,
  VaultFactoryABI,
  MerchantVaultABI,
  LiquidityPoolABI,
  MilestoneRegistryABI,
} from './abis.js';

export const addresses = {
  agentRegistry: env.AGENT_REGISTRY_ADDRESS as Address,
  paymentRouter: env.PAYMENT_ROUTER_ADDRESS as Address,
  vaultFactory: env.VAULT_FACTORY_ADDRESS as Address,
  seniorPool: env.SENIOR_POOL_ADDRESS as Address,
  generalPool: env.GENERAL_POOL_ADDRESS as Address,
  milestoneRegistry: env.MILESTONE_REGISTRY_ADDRESS as Address,
  usdc: env.USDC_ADDRESS as Address,
} as const;
