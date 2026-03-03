import type {
  HealthResponse, Vault, VaultDetail, Investor, WaterfallData, Milestone,
  TrancheResponse, VaultEvent, MerchantProfile, MerchantStats,
  Pool, PoolsSummary, Allocation, PortfolioInvestment, PortfolioSummary,
  PlatformStats, PlatformConfig, OraclePayment, UnsignedTx,
  CreateVaultParams, ApiKey,
} from './types.js';

export interface TCreditConfig {
  baseUrl: string;
  apiKey?: string;
}

async function request<T>(baseUrl: string, path: string, apiKey?: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...init?.headers } });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TCredit API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
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
      detail: (address: string) => get<VaultDetail>(`/vaults/${address}`),
      investors: (address: string) =>
        get<{ investors: Investor[]; total: number }>(`/vaults/${address}/investors`),
      waterfall: (address: string) => get<WaterfallData>(`/vaults/${address}/waterfall`),
      milestones: (address: string) =>
        get<{ milestones: Milestone[]; total: number }>(`/vaults/${address}/milestones`),
      tranches: (address: string) => get<TrancheResponse>(`/vaults/${address}/tranches`),
      repayments: (address: string) =>
        get<{ repayments: VaultEvent[]; total: number }>(`/vaults/${address}/repayments`),
      create: (params: CreateVaultParams) => post<UnsignedTx>('/vaults/create', params),
      submitMilestone: (address: string, trancheIndex: number, evidenceHash: string) =>
        post<UnsignedTx>(`/vaults/${address}/milestone/submit`, { trancheIndex, evidenceHash }),
      voteMilestone: (address: string, trancheIndex: number, approve: boolean) =>
        post<UnsignedTx>(`/vaults/${address}/milestone/vote`, { trancheIndex, approve }),
    },

    merchants: {
      profile: (address: string) => get<MerchantProfile>(`/merchants/${address}`),
      vaults: (address: string) =>
        get<{ vaults: Vault[]; total: number }>(`/merchants/${address}/vaults`),
      stats: (address: string) => get<MerchantStats>(`/merchants/${address}/stats`),
      register: (metadataURI: string) => post<UnsignedTx>('/merchants/register', { metadataURI }),
      updateCreditScore: (address: string, score: number) =>
        post<UnsignedTx>(`/merchants/${address}/credit-score`, { score }),
    },

    pools: {
      list: () =>
        get<{ pools: Pool[]; total: number; summary: PoolsSummary }>('/pools'),
      detail: (address: string) => get<Pool>(`/pools/${address}`),
      allocation: (poolAddress: string, vaultAddress: string) =>
        get<Allocation>(`/pools/${poolAddress}/allocation/${vaultAddress}`),
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
          `/portfolio/${address}`
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
        patch<ApiKey>(`/admin/keys/${id}`, data),
      deleteKey: (id: string) => del<{ deleted: boolean }>(`/admin/keys/${id}`),
    },
  };
}

export function createTCreditClient(config: TCreditConfig) {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  return createNamespace(`${baseUrl}/api/v1`, config.apiKey);
}

export type TCreditClient = ReturnType<typeof createTCreditClient>;
