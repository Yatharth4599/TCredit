/**
 * Chain-agnostic Agent namespace for KrexaSDK.
 *
 * Routes calls to:
 *  Solana  →  /api/v1/solana/wallets/*  and  /api/v1/solana/credit/*
 *  Base    →  /api/v1/wallets/*  (existing Base routes)
 */
import type {
  Chain, AgentWalletState, CreditLineState, CreditEligibility, KyaStatus, KyaSubmitResult,
  CreditScore, AgentStatus, TradeParams, PayX402Params, WithdrawParams,
  RepayParams, DepositParams, RequestCreditParams, OperationResult,
  SolanaVaultStats, SwapQuoteParams, SwapQuoteResult, PortfolioResult, YieldOpportunity,
} from './types.js';

export class KrexaError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'KrexaError';
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function req<T>(
  baseUrl: string,
  path: string,
  apiKey: string | undefined,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new KrexaError(res.status, `Krexa API ${res.status}: ${body}`, body);
  }
  return res.json() as Promise<T>;
}

function get<T>(baseUrl: string, path: string, apiKey?: string) {
  return req<T>(baseUrl, path, apiKey);
}
function post<T>(baseUrl: string, path: string, apiKey: string | undefined, body: unknown) {
  return req<T>(baseUrl, path, apiKey, { method: 'POST', body: JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// USD → base units conversion
// ---------------------------------------------------------------------------

function toBase(usdc: number): string {
  return Math.round(usdc * 1_000_000).toString();
}

// ---------------------------------------------------------------------------
// Agent namespace
// ---------------------------------------------------------------------------

export function createAgentNamespace(
  baseUrl: string,
  apiKey: string | undefined,
  chain: Chain,
  agentAddress: string | undefined,
) {
  const b = baseUrl;
  const a = agentAddress;

  function requireAgent(): string {
    if (!a) throw new KrexaError(400, 'agentAddress required — pass it in KrexaSDK config');
    return a;
  }

  return {
    /**
     * Create a new agent wallet PDA (Solana) or agent wallet contract (Base).
     * Returns an unsigned transaction for the owner to sign.
     */
    async createWallet(params: {
      ownerAddress: string;
      dailySpendLimitUsdc?: number;
      agentType?: number;
      chain?: Chain;
    }): Promise<OperationResult> {
      const c = params.chain ?? chain;
      if (c === 'solana') {
        return post<OperationResult>(b, '/solana/wallets/create', apiKey, {
          agent: params.ownerAddress,  // agent = owner in simple case
          owner: params.ownerAddress,
          dailySpendLimitUsdc: params.dailySpendLimitUsdc ?? 500,
          agentType: params.agentType,
        });
      }
      return post<OperationResult>(b, '/wallets/create', apiKey, {
        operator: params.ownerAddress,
        dailyLimitUsdc: params.dailySpendLimitUsdc ?? 500,
      });
    },

    /** Deposit USDC as collateral (builds unsigned tx). */
    async deposit(params: DepositParams): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain === 'solana') {
        return post<OperationResult>(b, `/solana/wallets/${agent}/deposit`, apiKey, {
          amount: toBase(params.amount),
          ownerAddress: params.ownerAddress,
        });
      }
      return post<OperationResult>(b, `/wallets/${agent}/deposit`, apiKey, {
        amountUsdc: params.amount.toString(),
      });
    },

    /** Request a credit line draw. Returns unsigned tx or status. */
    async requestCredit(params: RequestCreditParams): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain === 'solana') {
        return post<OperationResult>(b, `/solana/credit/${agent}/request`, apiKey, {
          amount: toBase(params.amount),
          rateBps: params.rateBps,
          creditLevel: params.creditLevel,
          collateralValueUsdc: params.collateralValueUsdc
            ? toBase(params.collateralValueUsdc)
            : '0',
        });
      }
      return post<OperationResult>(b, `/credit/${agent}/draw`, apiKey, {
        amount: toBase(params.amount),
      });
    },

    /** Execute a token trade through a whitelisted venue. */
    async trade(params: TradeParams): Promise<OperationResult> {
      const agent = requireAgent();
      return post<OperationResult>(b, `/solana/wallets/${agent}/trade`, apiKey, {
        venue: params.venue,
        from: params.from,
        to: params.to,
        amount: toBase(params.amount),
      });
    },

    /** Get a swap quote without executing. */
    async quote(params: SwapQuoteParams): Promise<SwapQuoteResult> {
      const agent = requireAgent();
      return post<SwapQuoteResult>(b, `/solana/trading/${agent}/quote`, apiKey, {
        from: params.from,
        to: params.to,
        amount: params.amount,
        slippageBps: params.slippageBps,
      });
    },

    /** Execute a swap and get unsigned transaction. */
    async swap(params: SwapQuoteParams & { ownerAddress: string }): Promise<OperationResult> {
      const agent = requireAgent();
      return post<OperationResult>(b, `/solana/trading/${agent}/swap`, apiKey, {
        from: params.from,
        to: params.to,
        amount: params.amount,
        slippageBps: params.slippageBps,
        ownerAddress: params.ownerAddress,
      });
    },

    /** Get token portfolio with USD values. */
    async portfolio(): Promise<PortfolioResult> {
      const agent = requireAgent();
      return get<PortfolioResult>(b, `/solana/trading/${agent}/portfolio`, apiKey);
    },

    /** Scan for top yield opportunities on Solana. */
    async yieldScan(params?: { limit?: number; minTvl?: number; token?: string }): Promise<{ opportunities: YieldOpportunity[]; count: number }> {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.minTvl) qs.set('minTvl', String(params.minTvl));
      if (params?.token) qs.set('token', params.token);
      const query = qs.toString();
      return get(b, `/solana/trading/yield${query ? `?${query}` : ''}`, apiKey);
    },

    /** Make an x402 payment to a merchant. */
    async payX402(params: PayX402Params): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain === 'solana') {
        return post<OperationResult>(b, `/solana/wallets/${agent}/pay`, apiKey, {
          recipient: params.recipient,
          amount: toBase(params.amount),
          paymentId: params.paymentId,
        });
      }
      return post<OperationResult>(b, '/oracle/payment', apiKey, {
        from: agent,
        to: params.recipient,
        amount: toBase(params.amount),
        paymentId: params.paymentId,
      });
    },

    /** Withdraw USDC from the agent wallet (respects credit health buffer). */
    async withdraw(params: WithdrawParams): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain === 'solana') {
        return post<OperationResult>(b, `/solana/wallets/${agent}/withdraw`, apiKey, {
          amount: toBase(params.amount),
          toAddress: params.toAddress,
        });
      }
      return post<OperationResult>(b, `/wallets/${agent}/transfer`, apiKey, {
        to: params.toAddress,
        amountUsdc: params.amount.toString(),
      });
    },

    /** Repay outstanding credit. */
    async repay(params: RepayParams): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain === 'solana') {
        return post<OperationResult>(b, `/solana/credit/${agent}/repay`, apiKey, {
          amount: toBase(params.amount),
          callerPubkey: params.callerAddress,
        });
      }
      return post<OperationResult>(b, `/credit/${agent}/repay`, apiKey, {
        amount: toBase(params.amount),
      });
    },

    /** Get full agent status: wallet, credit, health, KYA, balance. */
    async getStatus(): Promise<AgentStatus> {
      const agent = requireAgent();
      if (chain === 'solana') {
        const [wallet, credit, eligibility, kya, balance] = await Promise.allSettled([
          get<{ onChain: AgentWalletState }>(b, `/solana/wallets/${agent}`, apiKey)
            .then((r) => r.onChain).catch(() => null),
          get<CreditLineState>(b, `/solana/credit/${agent}/line`, apiKey).catch(() => null),
          get<CreditEligibility>(b, `/solana/credit/${agent}/eligibility`, apiKey).catch(() => null),
          get<KyaStatus>(b, `/solana/kya/${agent}/status`, apiKey).catch(() => null),
          get<{ balanceBaseUnits: string; balanceUsdc: string }>(
            b, `/solana/wallets/${agent}/balance`, apiKey,
          ).catch(() => null),
        ]);

        return {
          wallet: wallet.status === 'fulfilled' ? wallet.value : null,
          credit: credit.status === 'fulfilled' ? credit.value : null,
          eligibility: eligibility.status === 'fulfilled' ? eligibility.value : null,
          kya: kya.status === 'fulfilled' ? kya.value : null,
          balance: balance.status === 'fulfilled' ? balance.value : null,
        };
      }

      // Base chain status
      const [wallet, balance] = await Promise.allSettled([
        get<AgentWalletState>(b, `/wallets/${agent}`, apiKey).catch(() => null),
        get<{ balanceUsdc: string }>(b, `/wallets/${agent}/balance`, apiKey)
          .then((r) => ({ balanceBaseUnits: r.balanceUsdc, balanceUsdc: r.balanceUsdc }))
          .catch(() => null),
      ]);
      return {
        wallet: wallet.status === 'fulfilled' ? wallet.value : null,
        credit: null,
        eligibility: null,
        kya: null,
        balance: balance.status === 'fulfilled' ? balance.value : null,
      };
    },

    /** Get current USDC balance. */
    async getBalance(): Promise<{ balanceBaseUnits: string; balanceUsdc: string }> {
      const agent = requireAgent();
      if (chain === 'solana') {
        return get(b, `/solana/wallets/${agent}/balance`, apiKey);
      }
      const r = await get<{ balanceUsdc: string }>(b, `/wallets/${agent}/balance`, apiKey);
      return { balanceBaseUnits: r.balanceUsdc, balanceUsdc: r.balanceUsdc };
    },

    /** Get health factor and risk status. */
    async getHealth() {
      const agent = requireAgent();
      if (chain !== 'solana') throw new KrexaError(400, 'Health factor only available on Solana');
      return get(b, `/solana/wallets/${agent}/health`, apiKey);
    },

    /**
     * Propose an ownership transfer to a new address.
     * Returns an unsigned transaction for the current owner to sign.
     */
    async proposeOwnershipTransfer(params: {
      ownerAddress: string;
      newOwner: string;
      newOwnerType?: 'eoa' | 'multisig';
    }): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain !== 'solana') throw new KrexaError(400, 'Ownership transfer only available on Solana');
      return post<OperationResult>(b, `/solana/wallets/${agent}/propose-transfer`, apiKey, {
        owner: params.ownerAddress,
        newOwner: params.newOwner,
        newOwnerType: params.newOwnerType === 'multisig' ? 1 : 0,
      });
    },

    /**
     * Accept a pending ownership transfer. Must be called by the proposed new owner.
     * Returns an unsigned transaction for the new owner to sign.
     */
    async acceptOwnershipTransfer(params: {
      newOwner: string;
      rentReceiver?: string;
    }): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain !== 'solana') throw new KrexaError(400, 'Ownership transfer only available on Solana');
      return post<OperationResult>(b, `/solana/wallets/${agent}/accept-transfer`, apiKey, {
        newOwner: params.newOwner,
        rentReceiver: params.rentReceiver,
      });
    },

    /**
     * Cancel a pending ownership transfer. Must be called by the current owner.
     * Returns an unsigned transaction for the current owner to sign.
     */
    async cancelOwnershipTransfer(params: {
      ownerAddress: string;
    }): Promise<OperationResult> {
      const agent = requireAgent();
      if (chain !== 'solana') throw new KrexaError(400, 'Ownership transfer only available on Solana');
      return post<OperationResult>(b, `/solana/wallets/${agent}/cancel-transfer`, apiKey, {
        owner: params.ownerAddress,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Credit namespace
// ---------------------------------------------------------------------------

export function createCreditNamespace(
  baseUrl: string,
  apiKey: string | undefined,
  chain: Chain,
  agentAddress: string | undefined,
) {
  const b = baseUrl;
  const a = agentAddress;

  function requireAgent(): string {
    if (!a) throw new KrexaError(400, 'agentAddress required');
    return a;
  }

  return {
    /** Check if the agent is eligible for credit and at what level. */
    async checkEligibility(): Promise<CreditEligibility> {
      const agent = requireAgent();
      if (chain === 'solana') {
        return get<CreditEligibility>(b, `/solana/credit/${agent}/eligibility`, apiKey);
      }
      // Base fallback: use merchant credit tier
      const profile = await get<{ creditTierNum: number; creditValid: boolean }>(
        b, `/merchants/${agent}`, apiKey,
      );
      return {
        eligible: profile.creditValid,
        creditLevel: profile.creditTierNum,
        maxCreditUsdc: 0,
        reason: profile.creditValid ? 'Credit active' : 'Credit not active',
        agentPubkey: agent,
        creditScore: 0,
        kyaTier: 0,
      };
    },

    /** Get current credit score and level history. */
    async getScore(): Promise<CreditScore> {
      const agent = requireAgent();
      if (chain === 'solana') {
        const [profile, history] = await Promise.all([
          get<{ creditScore: number; creditLevel: number }>(
            b, `/solana/kya/${agent}/status`, apiKey,
          ).catch(() => ({ creditScore: 0, creditLevel: 0 })),
          get<{ snapshots: CreditScore['history'] }>(
            b, `/solana/credit/${agent}/score-history`, apiKey,
          ).catch(() => ({ snapshots: [] })),
        ]);
        return {
          agentPubkey: agent,
          score: (profile as { onChainTier?: number; creditScore?: number }).creditScore ?? 0,
          level: (profile as { onChainLevel?: number; creditLevel?: number }).creditLevel
                 ?? (profile as { onChainLevel?: number }).onChainLevel ?? 0,
          history: history.snapshots ?? [],
        };
      }
      const m = await get<{ creditTierNum: number }>(b, `/merchants/${agent}/stats`, apiKey);
      return { agentPubkey: agent, score: m.creditTierNum * 100, level: m.creditTierNum, history: [] };
    },

    /** Get active credit line state. */
    async getLine(): Promise<CreditLineState> {
      const agent = requireAgent();
      if (chain !== 'solana') throw new KrexaError(400, 'Credit line details only available on Solana');
      return get<CreditLineState>(b, `/solana/credit/${agent}/line`, apiKey);
    },

    /** Get Solana credit vault stats (TVL, utilisation, etc.). */
    async getVaultStats(): Promise<SolanaVaultStats> {
      if (chain !== 'solana') throw new KrexaError(400, 'Vault stats only available on Solana');
      return get<SolanaVaultStats>(b, '/solana/vault/stats', apiKey);
    },
  };
}

// ---------------------------------------------------------------------------
// KYA namespace
// ---------------------------------------------------------------------------

export function createKyaNamespace(
  baseUrl: string,
  apiKey: string | undefined,
  chain: Chain,
  agentAddress: string | undefined,
) {
  const b = baseUrl;
  const a = agentAddress;

  function requireAgent(): string {
    if (!a) throw new KrexaError(400, 'agentAddress required');
    return a;
  }

  return {
    /**
     * Basic KYA (tier 1) — automated owner-signature verification.
     * Pass the owner's base64-encoded signature of the agent public key.
     */
    async submitBasic(params: {
      ownerPubkey: string;
      ownerSignature: string;
      codeRepoUrl?: string;
      metadata?: Record<string, unknown>;
    }): Promise<KyaSubmitResult> {
      const agent = requireAgent();
      return post<KyaSubmitResult>(b, `/solana/kya/${agent}/basic`, apiKey, {
        ownerPubkey: params.ownerPubkey,
        ownerSignature: params.ownerSignature,
        codeRepoUrl: params.codeRepoUrl,
        metadata: params.metadata,
      });
    },

    /**
     * Enhanced KYA (tier 2) — requires a Sumsub applicant ID from the
     * owner completing a KYC flow via the Sumsub frontend SDK.
     */
    async submitEnhanced(params: {
      ownerPubkey: string;
      sumsubApplicantId: string;
    }): Promise<KyaSubmitResult> {
      const agent = requireAgent();
      return post<KyaSubmitResult>(b, `/solana/kya/${agent}/enhanced`, apiKey, params);
    },

    /** Get current on-chain KYA tier and verification history. */
    async getStatus(): Promise<KyaStatus> {
      const agent = requireAgent();
      return get<KyaStatus>(b, `/solana/kya/${agent}/status`, apiKey);
    },
  };
}
