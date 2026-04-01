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

function encodePathSegment(value: string, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return encodeURIComponent(value);
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

  // BUG-106: Runtime validation — don't blindly trust backend JSON shape
  const data = await res.json();
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response from backend: expected JSON object');
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export async function getBalance(address: string) {
  return request<{ address: string; balanceUsdc: string }>(`/balance/${encodePathSegment(address, 'address')}`);
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
  }>(`/merchants/${encodePathSegment(address, 'address')}/stats`);
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
  }>; total: number }>(`/merchants/${encodePathSegment(address, 'address')}/vaults`);
}

export async function getSettlement(address: string) {
  return request<{
    vault: string;
    repaymentRateBps: number;
    totalRouted: string;
    totalPayments: number;
    active: boolean;
    lastPaymentAt: string | null;
  }>(`/merchants/${encodePathSegment(address, 'address')}/settlement`);
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
// Agent Wallets
// ---------------------------------------------------------------------------

export async function getWalletStatus(address: string) {
  const [detail, balance] = await Promise.all([
    request<{
      address: string;
      owner: string;
      operator: string;
      dailyLimit: string;
      perTxLimit: string;
      spentToday: string;
      frozen: boolean;
      whitelistEnabled: boolean;
      creditVault: string;
      remainingDaily: string;
    }>(`/wallets/${encodePathSegment(address, 'wallet address')}`),
    request<{ address: string; balanceUsdc: string }>(`/wallets/${encodePathSegment(address, 'wallet address')}/balance`),
  ]);

  // Convert wei values to human-readable USDC (6 decimals)
  const toUsdc = (wei: string) => {
    const n = Number(BigInt(wei)) / 1e6;
    return n.toFixed(2);
  };

  return {
    address: detail.address,
    owner: detail.owner,
    operator: detail.operator,
    dailyLimit: toUsdc(detail.dailyLimit),
    perTxLimit: toUsdc(detail.perTxLimit),
    spentToday: toUsdc(detail.spentToday),
    frozen: detail.frozen,
    whitelistEnabled: detail.whitelistEnabled,
    creditVault: detail.creditVault,
    remainingDaily: toUsdc(detail.remainingDaily),
    balanceUsdc: toUsdc(balance.balanceUsdc),
  };
}

export async function buildWalletTransfer(walletAddress: string, to: string, amountUsdc: string) {
  return request<{ to: string; data: string; description: string }>(`/wallets/${encodePathSegment(walletAddress, 'wallet address')}/transfer`, {
    method: 'POST',
    body: { to, amountUsdc },
  });
}

export async function buildWalletDeposit(walletAddress: string, amountUsdc: string) {
  return request<{ to: string; data: string; description: string }>(`/wallets/${encodePathSegment(walletAddress, 'wallet address')}/deposit`, {
    method: 'POST',
    body: { amountUsdc },
  });
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
  }>(`/vaults/${encodePathSegment(address, 'vault address')}`);
}

export async function releaseTranche(vaultAddress: string) {
  return request<{ to: string; data: string }>(`/vaults/${encodePathSegment(vaultAddress, 'vault address')}/release-tranche`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Kickstart (EasyA)
// ---------------------------------------------------------------------------

export async function uploadKickstartMetadata(body: {
  name: string;
  ticker: string;
  description: string;
  imageUrl?: string;
}) {
  return request<{ uri: string; description: string }>('/kickstart/upload-metadata', {
    method: 'POST',
    body,
  });
}

export async function buildCreateToken(body: {
  name: string;
  symbol: string;
  uri: string;
  initialBuyEth?: string;
  deadlineSeconds?: number;
}) {
  return request<{ to: string; data: string; value: string; chainId: number; description: string }>(
    '/kickstart/create-token',
    { method: 'POST', body },
  );
}

export async function buildBuyToken(body: {
  curveAddress: string;
  ethAmount: string;
  minTokensOut?: string;
}) {
  return request<{ to: string; data: string; value: string; chainId: number; description: string }>(
    '/kickstart/buy-token',
    { method: 'POST', body },
  );
}

export async function buildCreditAndLaunch(body: {
  vaultAddress?: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  initialBuyEth?: string;
}) {
  return request<{
    steps: Array<{
      step: number;
      network: string;
      chainId: number;
      action: string;
      description: string;
      tx?: { to: string; data: string; value?: string };
      note?: string;
    }>;
    totalSteps: number;
    note: string;
  }>('/kickstart/credit-and-launch', { method: 'POST', body });
}

export async function getKickstartTokens(start?: number, count?: number) {
  return request<{ tokens: Array<{ curve: string; token: string | null }>; total: number }>(
    '/kickstart/tokens',
    { params: { start: String(start ?? 0), count: String(count ?? 20) } },
  );
}
