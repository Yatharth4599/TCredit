import { PublicKey } from "@solana/web3.js";
import { PROGRAM_IDS, PDA_SEEDS } from "./constants.js";

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

export function findVaultConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.VAULT_CONFIG],
    PROGRAM_IDS.CREDIT_VAULT
  );
}

export function findVaultUsdc(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc")],
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

export function findKrexitScore(agent: PublicKey): [PublicKey, number] {
  const [agentProfilePda] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.AGENT_PROFILE, agent.toBuffer()],
    PROGRAM_IDS.AGENT_REGISTRY
  );
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.KREXIT_SCORE, agentProfilePda.toBuffer()],
    PROGRAM_IDS.SCORE
  );
}

export function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  );
  return ata;
}
