import { getApiUrl } from "./config.js";

async function fetchJson(path: string, options?: RequestInit): Promise<any> {
  const url = `${getApiUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getScore(agent: string): Promise<any> {
  return fetchJson(`/solana/score/${agent}`);
}

export async function getCreditEligibility(agent: string): Promise<any> {
  return fetchJson(`/solana/credit/${agent}/eligibility`);
}

export async function getCreditLine(agent: string): Promise<any> {
  return fetchJson(`/solana/credit/${agent}/line`);
}

export async function getVaultStats(): Promise<any> {
  return fetchJson(`/solana/vault/stats`);
}

export async function requestFaucet(recipient: string, amountUsdc?: number): Promise<any> {
  return fetchJson(`/solana/faucet/usdc`, {
    method: "POST",
    body: JSON.stringify({ recipient, amountUsdc }),
  });
}

export async function signCredit(params: {
  agentPubkey: string;
  agentOrOwnerPubkey: string;
  amount: string;
  rateBps?: number;
  creditLevel?: number;
  collateralValueUsdc?: string;
}): Promise<any> {
  return fetchJson(`/solana/oracle/sign-credit`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getWalletInfo(agent: string): Promise<any> {
  return fetchJson(`/solana/wallets/${agent}`);
}

export async function getWalletBalance(agent: string): Promise<any> {
  return fetchJson(`/solana/wallets/${agent}/balance`);
}

export async function getScoreBreakdown(agent: string): Promise<any> {
  return fetchJson(`/solana/credit/${agent}/score-breakdown`);
}

export async function getLpPosition(depositor: string): Promise<any> {
  return fetchJson(`/solana/vault/lp/${depositor}`);
}

// Trading
export async function getSwapQuote(agent: string, body: {
  from: string; to: string; amount: number; slippageBps?: number;
}): Promise<any> {
  return fetchJson(`/solana/trading/${agent}/quote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function executeSwap(agent: string, body: {
  from: string; to: string; amount: number; slippageBps?: number; ownerAddress: string;
}): Promise<any> {
  return fetchJson(`/solana/trading/${agent}/swap`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPortfolio(agent: string): Promise<any> {
  return fetchJson(`/solana/trading/${agent}/portfolio`);
}

export async function requestKyaVerification(agentPubkey: string, tier: number): Promise<any> {
  return fetchJson(`/solana/oracle/kya-verify`, {
    method: "POST",
    body: JSON.stringify({ agentPubkey, tier }),
  });
}

export async function activateSettlement(params: {
  agentPubkey: string;
  splitBps: number;
}): Promise<any> {
  return fetchJson(`/solana/oracle/activate-settlement`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function scanYields(params?: {
  limit?: number; minTvl?: number; token?: string;
}): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.minTvl) qs.set("minTvl", String(params.minTvl));
  if (params?.token) qs.set("token", params.token);
  const query = qs.toString();
  return fetchJson(`/solana/trading/yield${query ? `?${query}` : ""}`);
}

export async function getTokenPrice(token: string): Promise<any> {
  return fetchJson(`/solana/trading/price/${encodeURIComponent(token)}`);
}

export async function getLpPools(params?: { token?: string; limit?: number }): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.token) qs.set("token", params.token);
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return fetchJson(`/solana/trading/pools${query ? `?${query}` : ""}`);
}

export async function getHistory(agent: string, params?: { limit?: number; type?: string }): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.type && params.type !== "all") qs.set("type", params.type);
  const query = qs.toString();
  return fetchJson(`/solana/wallets/${agent}/history${query ? `?${query}` : ""}`);
}
