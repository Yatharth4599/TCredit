import { PublicKey } from "@solana/web3.js";
import { PROGRAM_IDS, PDA_SEEDS } from "./types.js";

export function findRegistryConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.REGISTRY_CONFIG],
    PROGRAM_IDS.AGENT_REGISTRY
  );
}

export function findAgentProfile(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.AGENT_PROFILE, agent.toBuffer()],
    PROGRAM_IDS.AGENT_REGISTRY
  );
}

export function findWalletConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.WALLET_CONFIG],
    PROGRAM_IDS.AGENT_WALLET
  );
}

export function findAgentWallet(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.AGENT_WALLET, agent.toBuffer()],
    PROGRAM_IDS.AGENT_WALLET
  );
}

export function findWalletUsdc(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.WALLET_USDC, agent.toBuffer()],
    PROGRAM_IDS.AGENT_WALLET
  );
}

export function findVenueExposure(agent: PublicKey, venue: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.VENUE_EXPOSURE, agent.toBuffer(), venue.toBuffer()],
    PROGRAM_IDS.AGENT_WALLET
  );
}

export function findOwnershipTransfer(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.OWNERSHIP_TRANSFER, agent.toBuffer()],
    PROGRAM_IDS.AGENT_WALLET
  );
}

export function findVaultConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.VAULT_CONFIG],
    PROGRAM_IDS.CREDIT_VAULT
  );
}

export function findLpDeposit(owner: PublicKey, tranche: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.LP_DEPOSIT, owner.toBuffer(), Buffer.from([tranche])],
    PROGRAM_IDS.CREDIT_VAULT
  );
}

export function findCollateral(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.COLLATERAL, agent.toBuffer()],
    PROGRAM_IDS.CREDIT_VAULT
  );
}

export function findCreditLine(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.CREDIT_LINE, agent.toBuffer()],
    PROGRAM_IDS.CREDIT_VAULT
  );
}

export function findWhitelistConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.WHITELIST_CONFIG],
    PROGRAM_IDS.VENUE_WHITELIST
  );
}

export function findVenue(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.VENUE, programId.toBuffer()],
    PROGRAM_IDS.VENUE_WHITELIST
  );
}

export function findRouterConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.ROUTER_CONFIG],
    PROGRAM_IDS.PAYMENT_ROUTER
  );
}

export function findSettlement(merchant: PublicKey, agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.SETTLEMENT, merchant.toBuffer(), agent.toBuffer()],
    PROGRAM_IDS.PAYMENT_ROUTER
  );
}

export function findRevenueValidator(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.REVENUE_VALIDATOR, agent.toBuffer()],
    PROGRAM_IDS.PAYMENT_ROUTER
  );
}

export function findPaymentHistory(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.PAYMENT_HISTORY, agent.toBuffer()],
    PROGRAM_IDS.PAYMENT_ROUTER
  );
}

export function findGlobalBlocklist(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.GLOBAL_BLOCKLIST],
    PROGRAM_IDS.PAYMENT_ROUTER
  );
}

export function findPlatformWhitelist(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.PLATFORM_WHITELIST],
    PROGRAM_IDS.PAYMENT_ROUTER
  );
}

export function findServicePlanConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.SERVICE_PLAN_CONFIG],
    PROGRAM_IDS.SERVICE_PLAN
  );
}

export function findServicePlan(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.SERVICE_PLAN, agent.toBuffer()],
    PROGRAM_IDS.SERVICE_PLAN
  );
}

export function findExpenseDestination(plan: PublicKey, destination: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.EXPENSE_DESTINATION, plan.toBuffer(), destination.toBuffer()],
    PROGRAM_IDS.SERVICE_PLAN
  );
}
