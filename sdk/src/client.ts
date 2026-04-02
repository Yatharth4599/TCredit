import type {
  HealthResponse, Vault, VaultDetail, Investor, WaterfallData, Milestone,
  TrancheResponse, VaultEvent, MerchantProfile, MerchantStats,
  Pool, PoolsSummary, Allocation, PortfolioInvestment, PortfolioSummary,
  PlatformStats, PlatformConfig, OraclePayment, UnsignedTx,
  CreateVaultParams, ApiKey,
} from './types.js';

export interface KrexaConfig {
  baseUrl: string;
  apiKey?: string;
}

function encodePathSegment(value: string, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return encodeURIComponent(value);
}

async function request<T>(baseUrl: string, path: string, apiKey?: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...init?.headers } });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Krexa API error ${res.status}: ${body}`);
  }

  // BUG-099 fix: runtime type check on response body
  const data = await res.json();
  if (data === null || data === undefined) throw new Error('Krexa API returned empty response');
  if (typeof data !== 'object') {
    throw new Error(`Krexa API returned unexpected type: ${typeof data}`);
  }
  return data as T;
}

function createNamespace(baseUrl: string, apiKey?: string) {
  const get = <T>(path: string) => request<T>(baseUrl, path, apiKey);
  const post = <T>(path: string, body: unknown) =>
    request<T>(baseUrl, path, apiKey, { method: 'POST', body: JSON.stringify(body) });
  const patch = <T>(path: string, body: unknown) =>
    request<T>(baseUrl, path, apiKey, { method: 'PATCH', body: JSON.stringify(body) });
  const del = <T>(path: string) =>
    request<T>(baseUrl, path, apiKey, { method: 'DELETE' });

  return {
    health: {
      check: () => get<HealthResponse>('/health'),
    },

    vaults: {
      list: (params?: { state?: string; agent?: string }) => {
        const qs = new URLSearchParams(params as Record<string, string>).toString();
        return get<{ vaults: Vault[]; total: number }>(`/vaults${qs ? `?${qs}` : ''}`);
      },
      detail: (address: string) => get<VaultDetail>(`/vaults/${encodePathSegment(address, 'vault address')}`),
      investors: (address: string) =>
        get<{ investors: Investor[]; total: number }>(`/vaults/${encodePathSegment(address, 'vault address')}/investors`),
      waterfall: (address: string) => get<WaterfallData>(`/vaults/${encodePathSegment(address, 'vault address')}/waterfall`),
      milestones: (address: string) =>
        get<{ milestones: Milestone[]; total: number }>(`/vaults/${encodePathSegment(address, 'vault address')}/milestones`),
      tranches: (address: string) => get<TrancheResponse>(`/vaults/${encodePathSegment(address, 'vault address')}/tranches`),
      repayments: (address: string) =>
        get<{ repayments: VaultEvent[]; total: number }>(`/vaults/${encodePathSegment(address, 'vault address')}/repayments`),
      create: (params: CreateVaultParams) => post<UnsignedTx>('/vaults/create', params),
      submitMilestone: (address: string, trancheIndex: number, evidenceHash: string) =>
        post<UnsignedTx>(`/vaults/${encodePathSegment(address, 'vault address')}/milestone/submit`, { trancheIndex, evidenceHash }),
      voteMilestone: (address: string, trancheIndex: number, approve: boolean) =>
        post<UnsignedTx>(`/vaults/${encodePathSegment(address, 'vault address')}/milestone/vote`, { trancheIndex, approve }),
    },

    merchants: {
      profile: (address: string) => get<MerchantProfile>(`/merchants/${encodePathSegment(address, 'merchant address')}`),
      vaults: (address: string) =>
        get<{ vaults: Vault[]; total: number }>(`/merchants/${encodePathSegment(address, 'merchant address')}/vaults`),
      stats: (address: string) => get<MerchantStats>(`/merchants/${encodePathSegment(address, 'merchant address')}/stats`),
      register: (metadataURI: string) => post<UnsignedTx>('/merchants/register', { metadataURI }),
      updateCreditScore: (address: string, score: number) =>
        post<UnsignedTx>(`/merchants/${encodePathSegment(address, 'merchant address')}/credit-score`, { score }),
    },

    pools: {
      list: () =>
        get<{ pools: Pool[]; total: number; summary: PoolsSummary }>('/pools'),
      detail: (address: string) => get<Pool>(`/pools/${encodePathSegment(address, 'pool address')}`),
      allocation: (poolAddress: string, vaultAddress: string) =>
        get<Allocation>(`/pools/${encodePathSegment(poolAddress, 'pool address')}/allocation/${encodePathSegment(vaultAddress, 'vault address')}`),
      deposit: (poolAddress: string, amount: string) =>
        post<UnsignedTx>('/pools/deposit', { poolAddress, amount }),
      withdraw: (poolAddress: string, amount: string) =>
        post<UnsignedTx>('/pools/withdraw', { poolAddress, amount }),
      allocate: (poolAddress: string, vaultAddress: string, amount: string) =>
        post<UnsignedTx>('/pools/allocate', { poolAddress, vaultAddress, amount }),
    },

    investments: {
      portfolio: (address: string) =>
        get<{ investments: PortfolioInvestment[]; total: number; summary: PortfolioSummary }>(
          `/portfolio/${encodePathSegment(address, 'portfolio address')}`
        ),
      invest: (vaultAddress: string, amount: string) =>
        post<UnsignedTx>('/invest', { vaultAddress, amount }),
      claim: (vaultAddress: string) => post<UnsignedTx>('/claim', { vaultAddress }),
      refund: (vaultAddress: string) => post<UnsignedTx>('/refund', { vaultAddress }),
    },

    platform: {
      stats: () => get<PlatformStats>('/platform/stats'),
      config: () => get<PlatformConfig>('/platform/config'),
      indexerHealth: () => get<unknown>('/platform/indexer'),
      keeperHealth: () => get<unknown>('/platform/keeper'),
    },

    oracle: {
      submitPayment: (from: string, to: string, amount: string, paymentId?: string) =>
        post<unknown>('/oracle/payment', { from, to, amount, paymentId }),
      health: () => get<unknown>('/oracle/health'),
      payments: (params?: { status?: string; vault?: string; limit?: number }) => {
        const qs = new URLSearchParams(params as Record<string, string>).toString();
        return get<{ payments: OraclePayment[]; total: number }>(
          `/oracle/payments${qs ? `?${qs}` : ''}`
        );
      },
    },

    admin: {
      listKeys: () => get<{ keys: ApiKey[]; total: number }>('/admin/keys'),
      createKey: (name: string, rateLimit?: number) =>
        post<ApiKey>('/admin/keys', { name, rateLimit }),
      updateKey: (id: string, data: { name?: string; rateLimit?: number; active?: boolean }) =>
        patch<ApiKey>(`/admin/keys/${encodePathSegment(id, 'api key id')}`, data),
      deleteKey: (id: string) => del<{ deleted: boolean }>(`/admin/keys/${encodePathSegment(id, 'api key id')}`),
    },
  };
}

export function createKrexaClient(config: KrexaConfig) {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  return createNamespace(`${baseUrl}/api/v1`, config.apiKey);
}

export type KrexaClient = ReturnType<typeof createKrexaClient>;

// ─────────────────────────────────────────────────────────────────────────────
// KrexaSDK — chain-agnostic class-based interface
// ─────────────────────────────────────────────────────────────────────────────

import type { Chain } from './types.js';
import {
  createAgentNamespace,
  createCreditNamespace,
  createKyaNamespace,
  KrexaError,
} from './agent.js';
import { createCreditBureauNamespace } from './credit-bureau.js';

export interface KrexaSDKConfig {
  /** Krexa API key (required for authenticated endpoints). */
  apiKey?: string;
  /**
   * Base URL of the Krexa backend.
   * Defaults to https://api.krexa.xyz
   */
  baseUrl?: string;
  /**
   * Target chain. Defaults to "solana".
   * Determines which backend endpoints are called.
   */
  chain?: Chain;
  /**
   * The agent's public key / EVM address.
   * Required for all agent-specific operations.
   */
  agentAddress?: string;
}

/**
 * KrexaSDK — the primary entry point for AI agents.
 *
 * ```ts
 * const krexa = new KrexaSDK({
 *   apiKey: process.env.KREXA_API_KEY,
 *   agentAddress: process.env.AGENT_PUBKEY,
 *   chain: 'solana',
 * });
 *
 * await krexa.agent.getStatus();
 * await krexa.credit.checkEligibility();
 * await krexa.agent.trade({
 *   venue: 'jupiter',
 *   from: 'USDC',
 *   to: 'SOL',
 *   amount: 100,
 *   ownerAddress: process.env.OWNER_PUBKEY!,
 * });
 * ```
 */
export class KrexaSDK {
  private readonly _apiBase: string;
  private readonly _apiKey: string | undefined;
  private readonly _chain: Chain;
  private readonly _agentAddress: string | undefined;

  /** Access agent wallet operations. */
  readonly agent: ReturnType<typeof createAgentNamespace>;

  /** Access credit line operations. */
  readonly credit: ReturnType<typeof createCreditNamespace>;

  /** Access KYA verification operations. */
  readonly kya: ReturnType<typeof createKyaNamespace>;

  /** Access Credit Bureau — score lookups, reports, and history. */
  readonly creditBureau: ReturnType<typeof createCreditBureauNamespace>;

  /** Low-level access to the full Krexa REST client. */
  readonly raw: KrexaClient;

  constructor(config: KrexaSDKConfig = {}) {
    // BUG-042: warn when using non-default base URL
    if (config.baseUrl && !config.baseUrl.includes('krexa.xyz')) {
      console.warn(`[KrexaSDK] WARNING: Using non-default baseUrl "${config.baseUrl}"`);
    }
    this._apiBase = (config.baseUrl ?? 'https://api.krexa.xyz').replace(/\/$/, '') + '/api/v1';
    this._apiKey = config.apiKey;
    this._chain = config.chain ?? 'solana';
    this._agentAddress = config.agentAddress;

    this.agent  = createAgentNamespace(this._apiBase, this._apiKey, this._chain, this._agentAddress);
    this.credit = createCreditNamespace(this._apiBase, this._apiKey, this._chain, this._agentAddress);
    this.kya    = createKyaNamespace(this._apiBase, this._apiKey, this._chain, this._agentAddress);
    this.creditBureau = createCreditBureauNamespace(this._apiBase, this._apiKey);

    this.raw = createKrexaClient({
      baseUrl: config.baseUrl ?? 'https://api.krexa.xyz',
      apiKey: config.apiKey,
    });
  }

  /** Current chain. */
  get chain(): Chain { return this._chain; }

  /** Agent address in use. */
  get agentAddress(): string | undefined { return this._agentAddress; }

  /** Check API + chain health. */
  health() {
    return this.raw.health.check();
  }
}

export { KrexaError };
