import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';
import { env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Program IDs
// ---------------------------------------------------------------------------

export const PROGRAM_IDS = {
  agentRegistry:  new PublicKey(env.SOLANA_REGISTRY_PROGRAM_ID),
  creditVault:    new PublicKey(env.SOLANA_VAULT_PROGRAM_ID),
  agentWallet:    new PublicKey(env.SOLANA_WALLET_PROGRAM_ID),
  venueWhitelist: new PublicKey(env.SOLANA_VENUE_PROGRAM_ID),
  paymentRouter:  new PublicKey(env.SOLANA_ROUTER_PROGRAM_ID),
} as const;

// ---------------------------------------------------------------------------
// Account Seeds (mirrors Rust constants exactly)
// ---------------------------------------------------------------------------

export const SEEDS = {
  // krexa-agent-registry
  registryConfig: Buffer.from('registry_config'),
  agentProfile:   (agent: PublicKey) => [Buffer.from('agent_profile'), agent.toBuffer()],

  // krexa-credit-vault
  vaultConfig:    Buffer.from('vault_config'),
  vaultUsdc:      Buffer.from('vault_usdc'),
  insuranceUsdc:  Buffer.from('insurance_usdc'),
  deposit:        (depositor: PublicKey) => [Buffer.from('deposit'), depositor.toBuffer()],
  collateral:     (agent: PublicKey)    => [Buffer.from('collateral'), agent.toBuffer()],
  creditLine:     (agent: PublicKey)    => [Buffer.from('credit_line'), agent.toBuffer()],

  // krexa-agent-wallet
  walletConfig:      Buffer.from('wallet_config'),
  agentWallet:       (agent: PublicKey) => [Buffer.from('agent_wallet'), agent.toBuffer()],
  walletUsdc:        (agent: PublicKey) => [Buffer.from('wallet_usdc'), agent.toBuffer()],
  ownershipTransfer: (agent: PublicKey) => [Buffer.from('ownership_transfer'), agent.toBuffer()],

  // krexa-agent-registry
  profileTransfer:   (agent: PublicKey) => [Buffer.from('profile_transfer'), agent.toBuffer()],

  // krexa-payment-router
  routerConfig:   Buffer.from('router_config'),
  settlement:     (merchant: PublicKey) => [Buffer.from('settlement'), merchant.toBuffer()],
} as const;

// ---------------------------------------------------------------------------
// PDA Derivation Helpers
// ---------------------------------------------------------------------------

function findPda(seeds: (Buffer | Uint8Array)[], programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

// Registry
export const registryConfigPda = () =>
  findPda([SEEDS.registryConfig], PROGRAM_IDS.agentRegistry);

export const agentProfilePda = (agent: PublicKey) =>
  findPda(SEEDS.agentProfile(agent), PROGRAM_IDS.agentRegistry);

// Credit Vault
export const vaultConfigPda = () =>
  findPda([SEEDS.vaultConfig], PROGRAM_IDS.creditVault);

export const vaultUsdcPda = () =>
  findPda([SEEDS.vaultUsdc], PROGRAM_IDS.creditVault);

export const insuranceUsdcPda = () =>
  findPda([SEEDS.insuranceUsdc], PROGRAM_IDS.creditVault);

export const depositPositionPda = (depositor: PublicKey) =>
  findPda(SEEDS.deposit(depositor), PROGRAM_IDS.creditVault);

export const collateralPositionPda = (agent: PublicKey) =>
  findPda(SEEDS.collateral(agent), PROGRAM_IDS.creditVault);

export const creditLinePda = (agent: PublicKey) =>
  findPda(SEEDS.creditLine(agent), PROGRAM_IDS.creditVault);

// Agent Wallet
export const walletConfigPda = () =>
  findPda([SEEDS.walletConfig], PROGRAM_IDS.agentWallet);

export const agentWalletPda = (agent: PublicKey) =>
  findPda(SEEDS.agentWallet(agent), PROGRAM_IDS.agentWallet);

export const walletUsdcPda = (agent: PublicKey) =>
  findPda(SEEDS.walletUsdc(agent), PROGRAM_IDS.agentWallet);

export const ownershipTransferPda = (agent: PublicKey) =>
  findPda(SEEDS.ownershipTransfer(agent), PROGRAM_IDS.agentWallet);

export const profileTransferPda = (agent: PublicKey) =>
  findPda(SEEDS.profileTransfer(agent), PROGRAM_IDS.agentRegistry);

// Payment Router
export const routerConfigPda = () =>
  findPda([SEEDS.routerConfig], PROGRAM_IDS.paymentRouter);

export const settlementPda = (merchant: PublicKey) =>
  findPda(SEEDS.settlement(merchant), PROGRAM_IDS.paymentRouter);

// ---------------------------------------------------------------------------
// Instruction Discriminators  (sha256("global:<name>")[0..8])
// ---------------------------------------------------------------------------

function disc(name: string): Buffer {
  return createHash('sha256')
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

export const DISCRIMINATORS = {
  // krexa-agent-registry
  registerAgent:         disc('register_agent'),
  updateKya:             disc('update_kya'),
  updateCreditScore:     disc('update_credit_score'),
  recordLiquidation:     disc('record_liquidation'),

  // krexa-credit-vault
  initializeVault:       disc('initialize_vault'),
  depositCollateral:     disc('deposit_collateral'),
  withdrawCollateral:    disc('withdraw_collateral'),
  extendCredit:          disc('extend_credit'),
  receiveRepayment:      disc('receive_repayment'),

  // krexa-agent-wallet
  createWallet:              disc('create_wallet'),
  createWalletMultisig:      disc('create_wallet_multisig'),
  deposit:                   disc('deposit'),
  requestCredit:             disc('request_credit'),
  executeTrade:              disc('execute_trade'),
  payX402:                   disc('pay_x402'),
  withdraw:                  disc('withdraw'),
  repay:                     disc('repay'),
  checkHealth:               disc('check_health'),
  deleverage:                disc('deleverage'),
  liquidate:                 disc('liquidate'),
  proposeOwnershipTransfer:  disc('propose_ownership_transfer'),
  acceptOwnershipTransfer:   disc('accept_ownership_transfer'),
  cancelOwnershipTransfer:   disc('cancel_ownership_transfer'),

  // krexa-agent-registry
  proposeProfileTransfer: disc('propose_profile_transfer'),
  acceptProfileTransfer:  disc('accept_profile_transfer'),
  cancelProfileTransfer:  disc('cancel_profile_transfer'),
  migrateProfileV2:       disc('migrate_profile_v2'),

  // krexa-payment-router
  activateSettlement:    disc('activate_settlement'),
  executePayment:        disc('execute_payment'),
  updateSplit:           disc('update_split'),
  deactivateSettlement:  disc('deactivate_settlement'),
} as const;

// ---------------------------------------------------------------------------
// Account Discriminators  (sha256("account:<Name>")[0..8])
// ---------------------------------------------------------------------------

function accountDisc(name: string): Buffer {
  return createHash('sha256')
    .update(`account:${name}`)
    .digest()
    .subarray(0, 8);
}

export const ACCOUNT_DISCRIMINATORS = {
  AgentProfile:              accountDisc('AgentProfile'),
  RegistryConfig:            accountDisc('RegistryConfig'),
  AgentWallet:               accountDisc('AgentWallet'),
  WalletConfig:              accountDisc('WalletConfig'),
  VaultConfig:               accountDisc('VaultConfig'),
  CreditLine:                accountDisc('CreditLine'),
  DepositPosition:           accountDisc('DepositPosition'),
  RouterConfig:              accountDisc('RouterConfig'),
  MerchantSettlement:        accountDisc('MerchantSettlement'),
  OwnershipTransfer:         accountDisc('OwnershipTransfer'),
  ProfileOwnershipTransfer:  accountDisc('ProfileOwnershipTransfer'),
} as const;
