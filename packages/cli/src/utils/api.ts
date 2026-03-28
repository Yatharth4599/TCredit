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
