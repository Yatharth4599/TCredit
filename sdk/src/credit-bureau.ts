/**
 * Credit Bureau SDK — query agent credit scores, reports, and history.
 *
 * krexa.creditBureau.getScore(agentPubkey)
 * krexa.creditBureau.getReport(agentPubkey)
 * krexa.creditBureau.getHistory(agentPubkey, { page, pageSize })
 * krexa.creditBureau.verifyAttestation(agentPubkey, score, timestamp)
 */

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BureauScore {
  agent: string;
  score: number;
  level: number;
  lastUpdated: string | null;
  isExpired: boolean;
  attestationHash: string | null;
}

export interface BureauReport {
  agent: string;
  score: number;
  level: number;
  components: Record<string, number> | null;
  activeCreditLine: {
    creditLimit: string;
    creditDrawn: string;
    accruedInterest: string;
    interestRateBps: number;
    isActive: boolean;
  } | null;
  wallet: {
    healthFactorBps: number;
    isFrozen: boolean;
    isLiquidating: boolean;
    totalTrades: string;
    totalVolume: string;
    totalRepaid: string;
  } | null;
  paymentHistory: {
    totalBorrowed: string;
    totalRepaid: string;
    liquidationCount: number;
    repaymentRate: number;
  };
  riskFlags: string[];
  scoreHistory30d: Array<{ score: number; level: number; snapshotAt: string }>;
  legalAgreementSigned: boolean;
  lastUpdated: string | null;
}

export interface BureauEvent {
  type: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface BureauHistory {
  events: BureauEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HistoryOptions {
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Namespace factory
// ---------------------------------------------------------------------------

async function req<T>(baseUrl: string, path: string, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${baseUrl}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Krexa Credit Bureau error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export function createCreditBureauNamespace(apiBase: string, apiKey?: string) {
  return {
    /**
     * Get an agent's credit score (free tier — no API key required).
     */
    getScore: (agentPubkey: string) =>
      req<BureauScore>(apiBase, `/credit-bureau/${agentPubkey}/score`, apiKey),

    /**
     * Get a full credit report (paid tier — API key required).
     */
    getReport: (agentPubkey: string) =>
      req<BureauReport>(apiBase, `/credit-bureau/${agentPubkey}/report`, apiKey),

    /**
     * Get credit event history (paid tier — API key required).
     */
    getHistory: (agentPubkey: string, opts?: HistoryOptions) => {
      const params = new URLSearchParams();
      if (opts?.page) params.set('page', String(opts.page));
      if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
      const qs = params.toString();
      return req<BureauHistory>(
        apiBase,
        `/credit-bureau/${agentPubkey}/history${qs ? `?${qs}` : ''}`,
        apiKey,
      );
    },

    /**
     * Verify a score attestation hash matches the expected inputs.
     * Returns true if the hash matches keccak256(agent, score, level, timestamp).
     */
    verifyAttestation: (
      agentPubkey: string,
      score: number,
      level: number,
      timestamp: number,
      expectedHash: string,
    ): boolean => {
      const data = Buffer.concat([
        Buffer.from(agentPubkey),
        Buffer.from(score.toString()),
        Buffer.from(level.toString()),
        Buffer.from(timestamp.toString()),
      ]);
      const computed = createHash('sha256').update(data).digest('hex');
      return computed === expectedHash;
    },
  };
}
