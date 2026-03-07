/**
 * HTTP client wrapping the Krexa backend API.
 * All MCP tools delegate to this client for data.
 */

import { config } from './config.js';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${config.apiUrl}${path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['X-API-Key'] = config.apiKey;
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Krexa API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export async function getBalance(address: string) {
  return request<{ address: string; balanceUsdc: string }>(`/balance/${address}`);
}

// ---------------------------------------------------------------------------
// Merchants / Credit
// ---------------------------------------------------------------------------

export async function getMerchantStats(address: string) {
  return request<{
    agent: string;
    creditScore: number;
    creditTier: string;
    isRegistered: boolean;
    vaultCount: number;
    totalBorrowed: string;
    totalRepaid: string;
  }>(`/merchants/${address}/stats`);
}

export async function getMerchantVaults(address: string) {
  return request<{ vaults: Array<{
    address: string;
    state: string;
    targetAmount: string;
    totalFunded: string;
    totalRepaid: string;
    totalToRepay: string;
    tranchesReleased: number;
    numTranches: number;
  }>; total: number }>(`/merchants/${address}/vaults`);
}

export async function getSettlement(address: string) {
  return request<{
    vault: string;
    repaymentRateBps: number;
    totalRouted: string;
    totalPayments: number;
    active: boolean;
    lastPaymentAt: string | null;
  }>(`/merchants/${address}/settlement`);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function executePayment(body: {
  from: string;
  to: string;
  amount: string;
}) {
  return request<{
    status: string;
    txHash: string | null;
    paymentId: string;
  }>('/oracle/payment', { method: 'POST', body });
}

// ---------------------------------------------------------------------------
// Vaults
// ---------------------------------------------------------------------------

export async function getVaultDetail(address: string) {
  return request<{
    address: string;
    agent: string;
    state: string;
    targetAmount: string;
    totalFunded: string;
    totalRepaid: string;
    totalToRepay: string;
    interestRateBps: number;
    tranchesReleased: number;
    numTranches: number;
  }>(`/vaults/${address}`);
}

export async function releaseTranche(vaultAddress: string) {
  return request<{ to: string; data: string }>(`/vaults/${vaultAddress}/release-tranche`, {
    method: 'POST',
  });
}
