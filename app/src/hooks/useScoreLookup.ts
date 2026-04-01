import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { KrexaClient } from '../sdk'
import { config } from '../config'

export interface ScoreComponents {
  c1Repayment: number
  c2Profitability: number
  c3Behavioral: number
  c4Usage: number
  c5Maturity: number
}

export interface ScorePreview {
  score: number
  breakdown: Record<string, number>
  components?: ScoreComponents
  note: string
  network?: string
  txCount?: number
  walletAgeDays?: number
}

export interface CreditLevelPreview {
  level: number
  minScore: number
  minKya: number
  maxUsd: number
  type: 'revenue-enforced'
  description?: string
  qualified: boolean
  pointsNeeded: number
}

export interface CreditPreview {
  estimatedLevel: number
  type: string
  maxCreditUsd: number
  description: string
  kyaRequired: number
  nextLevel: {
    level: number
    minScore: number
    pointsNeeded: number
    maxCreditUsd: number
    type: string
  } | null
  levels: CreditLevelPreview[]
  note: string
}

export interface ScoreLookupResult {
  profile: Awaited<ReturnType<KrexaClient['agent']['getProfile']>>
  score: Awaited<ReturnType<KrexaClient['score']['getScore']>>
  health: Awaited<ReturnType<KrexaClient['agent']['getHealth']>> | null
  wallet: Awaited<ReturnType<KrexaClient['agent']['getWallet']>> | null
  preview?: ScorePreview | null
  creditPreview?: CreditPreview | null
  isRegistered?: boolean
  source?: 'on-chain' | 'preview'
}

// ── RPC endpoints (browser fallback only) ────────────────────────────────────
const MAINNET_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
]

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

async function solanaRpcOne(url: string, method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { result?: unknown; error?: unknown }
    if (json.error) throw new Error(JSON.stringify(json.error))
    return json.result
  } finally {
    clearTimeout(timer)
  }
}

async function solanaRpc(method: string, params: unknown[], rpcs = MAINNET_RPCS): Promise<unknown> {
  const settled = await Promise.allSettled(rpcs.map(url => solanaRpcOne(url, method, params)))
  let best: unknown = undefined
  for (const r of settled) {
    if (r.status !== 'fulfilled' || r.value == null) continue
    if (best === undefined) { best = r.value; continue }
    if (Array.isArray(r.value) && Array.isArray(best) && r.value.length > best.length) {
      best = r.value
    }
  }
  if (best !== undefined) return best
  throw new Error(`All ${rpcs.length} RPC endpoints failed for ${method}`)
}

async function fetchNetworkActivity(address: string, rpcs: string[]): Promise<{
  lamports: number
  txCount: number
  walletAgeDays: number
  tokenAccounts: number
} | null> {
  try {
    const [acctResult, firstSigsResult] = await Promise.allSettled([
      solanaRpc('getAccountInfo', [address, { encoding: 'base64' }], rpcs),
      solanaRpc('getSignaturesForAddress', [address, { limit: 200 }], rpcs),
    ])

    let lamports = 0
    if (acctResult.status === 'fulfilled' && acctResult.value) {
      const v = acctResult.value as { value?: { lamports?: number } }
      lamports = v?.value?.lamports ?? 0
    }

    type Sig = { blockTime?: number | null; signature: string }
    let allSigs: Sig[] = []

    if (firstSigsResult.status === 'fulfilled' && Array.isArray(firstSigsResult.value)) {
      allSigs = firstSigsResult.value as Sig[]

      let page = 0
      while (allSigs.length === (page + 1) * 200 && page < 4) {
        const cursor = allSigs[allSigs.length - 1].signature
        const older = await solanaRpc('getSignaturesForAddress', [
          address,
          { limit: 200, before: cursor },
        ], rpcs).catch(() => null)
        if (!Array.isArray(older) || older.length === 0) break
        allSigs = [...allSigs, ...(older as Sig[])]
        page++
      }
    }

    const txCount = allSigs.length
    const sigsOk = firstSigsResult.status === 'fulfilled'

    let walletAgeDays = 0
    for (let i = allSigs.length - 1; i >= 0; i--) {
      if (allSigs[i].blockTime) {
        walletAgeDays = (Date.now() / 1000 - allSigs[i].blockTime!) / 86400
        break
      }
    }

    if (!sigsOk && lamports === 0) return null
    const tokenAccounts = Math.min(10, Math.floor(txCount / 5))
    return { lamports, txCount, walletAgeDays, tokenAccounts }
  } catch {
    return null
  }
}

// ── 5-Component Krexit Score (client-side fallback) ──────────────────────────
// S = 200 + 650 × (0.30×C₁ + 0.25×C₂ + 0.20×C₃ + 0.15×C₄ + 0.10×C₅)

function compute5ComponentPreview(stats: {
  lamports: number; txCount: number; walletAgeDays: number; tokenAccounts: number
}, network: string): ScorePreview {
  const solBalance = stats.lamports / 1e9

  // C₁ Repayment History: default 0.70 (benefit of doubt)
  const c1 = 0.70
  // C₂ Profitability: min(1, solBalance / 20)
  const c2 = Math.min(1, solBalance / 20)
  // C₃ Behavioral Health: default 0.50 (neutral)
  const c3 = 0.50
  // C₄ Usage Patterns: simplified — min(1, tokenAccounts / 10) (no getTransaction from browser)
  const c4 = Math.min(1, stats.tokenAccounts / 10)
  // C₅ Account Maturity: 0.4×min(1,age/180) + 0.3×min(1,txCount/200) + 0.3×min(1,tokenAccounts/10)
  const c5 = 0.4 * Math.min(1, stats.walletAgeDays / 180)
           + 0.3 * Math.min(1, stats.txCount / 200)
           + 0.3 * Math.min(1, stats.tokenAccounts / 10)

  const weighted = 0.30 * c1 + 0.25 * c2 + 0.20 * c3 + 0.15 * c4 + 0.10 * c5
  const score = Math.min(850, Math.max(200, Math.round(200 + 650 * weighted)))

  const toBps = (v: number) => Math.round(v * 10000)
  const activitySource = stats.txCount > 0
    ? `${stats.txCount} transactions`
    : stats.tokenAccounts > 0 ? `${stats.tokenAccounts} token accounts` : '0 transactions'

  return {
    score,
    network,
    txCount: stats.txCount,
    walletAgeDays: Math.round(stats.walletAgeDays),
    breakdown: {
      base: 200,
      walletAge: Math.round(c5 * 0.4 * 650 * 0.10),
      transactionActivity: Math.round((0.30 * c1 + 0.15 * c4) * 650),
      solBalance: Math.round(c2 * 0.25 * 650),
      accountExists: stats.lamports > 0 ? 50 : 0,
      tokenDiversity: Math.round(c4 * 0.15 * 650),
    },
    components: {
      c1Repayment: toBps(c1),
      c2Profitability: toBps(c2),
      c3Behavioral: toBps(c3),
      c4Usage: toBps(c4),
      c5Maturity: toBps(c5),
    },
    note: `Preview score based on ${activitySource} over ${Math.round(stats.walletAgeDays)} days on ${network}. Register as a Krexa agent for a full 5-component Krexit Score.`,
  }
}

export function useScoreLookup(address: string | null) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['score-lookup', address],
    queryFn: async (): Promise<ScoreLookupResult | null> => {
      if (!address) return null
      const pubkey = new PublicKey(address)
      const client = new KrexaClient({ connection })

      const [profile, score, health, wallet] = await Promise.all([
        client.agent.getProfile(pubkey),
        client.score.getScore(pubkey),
        client.agent.getHealth(pubkey).catch(() => null),
        client.agent.getWallet(pubkey).catch(() => null),
      ])

      // On-chain score — return it directly
      if (score) {
        return { profile, score, health, wallet, source: 'on-chain' }
      }

      // No on-chain score — try backend first, then browser fallback
      // Step 1: Try backend score endpoint (most reliable — server-side RPC)
      let backendData: Record<string, unknown> | null = null
      try {
        backendData = await withTimeout(
          fetch(`${config.apiUrl}/api/v1/solana/score/${address}`).then(r => r.ok ? r.json() : null),
          15000, null
        )
      } catch { /* ignore */ }

      const backendPreview: ScorePreview | null = backendData?.preview
        ? backendData.preview as ScorePreview
        : null

      // Step 2: If backend returned a preview with components, use it directly
      if (backendPreview && backendPreview.components) {
        const creditPreview: CreditPreview = backendData?.creditPreview as CreditPreview
          ?? computeCreditPreview(backendPreview.score)

        return {
          profile,
          score: null,
          health,
          wallet,
          source: 'preview',
          preview: backendPreview,
          creditPreview,
          isRegistered: (backendData?.isRegistered as boolean) ?? false,
        }
      }

      // Step 3: Backend failed or didn't return components — browser fallback
      const browserStats = await withTimeout(fetchNetworkActivity(address, MAINNET_RPCS), 30000, null)

      const bestPreview: ScorePreview = (() => {
        // If we have browser stats, compute 5-component score client-side
        if (browserStats) {
          const browserPreview = compute5ComponentPreview(browserStats, 'mainnet')
          // Use whichever is higher between backend (if any) and browser
          if (backendPreview && backendPreview.score >= browserPreview.score) return backendPreview
          return browserPreview
        }
        // Only backend preview available (no components)
        if (backendPreview) return backendPreview
        // All failed — safe base-score default
        return {
          score: 200,
          network: 'unknown',
          txCount: 0,
          walletAgeDays: 0,
          breakdown: { base: 200, walletAge: 0, transactionActivity: 0, solBalance: 0, accountExists: 0, tokenDiversity: 0 },
          note: 'Unable to fetch on-chain data. Register as a Krexa agent to get a full score.',
        }
      })()

      const creditPreview: CreditPreview = backendData?.creditPreview as CreditPreview
        ?? computeCreditPreview(bestPreview.score)

      return {
        profile,
        score: null,
        health,
        wallet,
        source: 'preview',
        preview: bestPreview,
        creditPreview,
        isRegistered: (backendData?.isRegistered as boolean) ?? false,
      }
    },
    enabled: !!address && address.length >= 32,
    staleTime: 30_000,
    retry: 1,
  })
}

// ── Credit level definitions (mirrors backend constants) ────────────────────
const LEVEL_DEFS = [
  { level: 1, minScore: 400, minKya: 1, maxUsdc: 500_000_000,     type: 'revenue-enforced' as const, description: 'Micro — up to $500, zero collateral. 0.10%/day' },
  { level: 2, minScore: 500, minKya: 2, maxUsdc: 20_000_000_000,  type: 'revenue-enforced' as const, description: 'Standard — up to $20K, zero collateral. 0.08%/day' },
  { level: 3, minScore: 650, minKya: 2, maxUsdc: 50_000_000_000,  type: 'revenue-enforced' as const, description: 'Growth — up to $50K, zero collateral. 0.07%/day' },
  { level: 4, minScore: 750, minKya: 3, maxUsdc: 500_000_000_000, type: 'revenue-enforced' as const, description: 'Prime — up to $500K, zero collateral. 0.06%/day' },
] as const

function computeCreditPreview(score: number): CreditPreview {
  const eligibleLevel = [...LEVEL_DEFS].reverse().find(l => score >= l.minScore) ?? null
  const levels: CreditLevelPreview[] = LEVEL_DEFS.map(l => ({
    level: l.level, minScore: l.minScore, minKya: l.minKya,
    maxUsd: l.maxUsdc / 1_000_000, type: l.type,
    description: l.description,
    qualified: score >= l.minScore,
    pointsNeeded: Math.max(0, l.minScore - score),
  }))

  const nextLevel = LEVEL_DEFS.find(l => score < l.minScore) ?? null

  return {
    estimatedLevel: eligibleLevel?.level ?? 0,
    type: eligibleLevel?.type ?? 'none',
    maxCreditUsd: eligibleLevel ? eligibleLevel.maxUsdc / 1_000_000 : 0,
    description: eligibleLevel?.description ?? 'Score below 400 — not yet eligible for any credit level',
    kyaRequired: eligibleLevel?.minKya ?? 1,
    nextLevel: nextLevel ? {
      level: nextLevel.level, minScore: nextLevel.minScore,
      pointsNeeded: Math.max(0, nextLevel.minScore - score),
      maxCreditUsd: nextLevel.maxUsdc / 1_000_000, type: nextLevel.type,
    } : null,
    levels,
    note: score < 400
      ? 'Register as a Krexa agent and complete KYA to unlock credit. Building on-chain history increases your score.'
      : `With score ${score} and basic KYA you qualify for Level ${eligibleLevel!.level} credit. Register to activate.`,
  }
}
