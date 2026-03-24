import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { KrexaClient } from '../sdk'
import { config } from '../config'

export interface ScorePreview {
  score: number
  breakdown: Record<string, number>
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
  type: 'undercollateralized' | 'collateralized'
  description?: string
  ltv?: number
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

// ── RPC endpoints ─────────────────────────────────────────────────────────────
const MAINNET_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
]
const DEVNET_RPCS = [
  'https://api.devnet.solana.com',
]

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

async function solanaRpcOne(url: string, method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
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

// Fire all endpoints in parallel, wait up to 6s, pick the richest result
async function solanaRpc(method: string, params: unknown[], rpcs = MAINNET_RPCS): Promise<unknown> {
  const settled = await withTimeout(
    Promise.allSettled(rpcs.map(url => solanaRpcOne(url, method, params))),
    6000,
    [] as PromiseSettledResult<unknown>[],
  )
  // Pick the best fulfilled result (largest array, or first non-null)
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
    // Fetch account info and first page of sigs in parallel
    const [acctResult, firstSigsResult] = await Promise.allSettled([
      solanaRpc('getAccountInfo', [address, { encoding: 'base64' }], rpcs),
      solanaRpc('getSignaturesForAddress', [address, { limit: 50 }], rpcs),
    ])

    // Account info → lamports
    let lamports = 0
    if (acctResult.status === 'fulfilled' && acctResult.value) {
      const v = acctResult.value as { value?: { lamports?: number } }
      lamports = v?.value?.lamports ?? 0
    }

    // Paginate backwards until we reach the oldest transaction (< 1000 in a page)
    type Sig = { blockTime?: number | null; signature: string }
    let allSigs: Sig[] = []

    if (firstSigsResult.status === 'fulfilled' && Array.isArray(firstSigsResult.value)) {
      allSigs = firstSigsResult.value as Sig[]

      // Paginate to find true wallet age (up to 20 pages × 50 = 1,000 txs)
      let page = 0
      while (allSigs.length === (page + 1) * 50 && page < 19) {
        const cursor = allSigs[allSigs.length - 1].signature
        const older = await solanaRpc('getSignaturesForAddress', [
          address,
          { limit: 50, before: cursor },
        ], rpcs).catch(() => null)
        if (!Array.isArray(older) || older.length === 0) break
        allSigs = [...allSigs, ...(older as Sig[])]
        page++
      }
    }

    const txCount = allSigs.length
    const sigsOk = firstSigsResult.status === 'fulfilled'

    // Find the oldest non-null blockTime (last in the array = chronologically first)
    let walletAgeDays = 0
    for (let i = allSigs.length - 1; i >= 0; i--) {
      if (allSigs[i].blockTime) {
        walletAgeDays = (Date.now() / 1000 - allSigs[i].blockTime!) / 86400
        break
      }
    }

    // If sigs fetch failed but we know the wallet exists (has lamports), still return partial data
    // so we can at least score balance + existence
    if (!sigsOk && lamports === 0) return null  // nothing useful
    const tokenAccounts = Math.min(10, Math.floor(txCount / 5))
    return { lamports, txCount, walletAgeDays, tokenAccounts }
  } catch {
    return null
  }
}

function computePreviewFromStats(stats: {
  lamports: number; txCount: number; walletAgeDays: number; tokenAccounts: number
}, network: string): ScorePreview {
  const solBalance = stats.lamports / 1e9
  const base = 200
  const ageScore = Math.min(150, Math.floor(stats.walletAgeDays / 30) * 30)
  const activityScore = stats.txCount > 0
    ? Math.min(100, stats.txCount)
    : Math.min(100, stats.tokenAccounts * 10)
  const balanceScore = Math.min(50, Math.floor(solBalance * 5))
  const existenceScore = stats.lamports > 0 ? 50 : 0
  const tokenDiversity = stats.tokenAccounts >= 3 ? 30 : stats.tokenAccounts >= 1 ? 10 : 0
  const score = Math.min(600, base + ageScore + activityScore + balanceScore + existenceScore + tokenDiversity)
  const activitySource = stats.txCount > 0
    ? `${stats.txCount} transactions`
    : stats.tokenAccounts > 0 ? `${stats.tokenAccounts} token accounts` : '0 transactions'

  return {
    score,
    network,
    txCount: stats.txCount,
    walletAgeDays: Math.round(stats.walletAgeDays),
    breakdown: { base, walletAge: ageScore, transactionActivity: activityScore, solBalance: balanceScore, accountExists: existenceScore, tokenDiversity },
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

      // No on-chain score — fetch mainnet activity (backend proxy preferred) + backend score preview
      // Backend proxy is more reliable (server-side RPC, no CORS/rate-limit issues)
      type ActivityStats = { lamports: number; txCount: number; walletAgeDays: number; tokenAccounts: number }

      const [backendResp, proxyResult, browserResult] = await Promise.allSettled([
        withTimeout(
          fetch(`${config.apiUrl}/api/v1/solana/score/${address}`).then(r => r.ok ? r.json() : null),
          10000, null
        ),
        withTimeout(
          fetch(`${config.apiUrl}/api/v1/mainnet/activity/${address}`)
            .then(r => r.ok ? r.json() as Promise<ActivityStats> : null),
          12000, null
        ),
        // Browser-side fallback in case backend proxy is down
        withTimeout(fetchNetworkActivity(address, MAINNET_RPCS), 10000, null),
      ])

      const backendData = backendResp.status === 'fulfilled' ? backendResp.value : null
      const proxyStats: ActivityStats | null = proxyResult.status === 'fulfilled' ? proxyResult.value : null
      const browserStats = browserResult.status === 'fulfilled' ? browserResult.value : null

      // Use whichever source returned MORE transactions (backend proxy or browser RPC)
      const mainnetStats = (() => {
        if (proxyStats && browserStats) return proxyStats.txCount >= browserStats.txCount ? proxyStats : browserStats
        return proxyStats ?? browserStats
      })()

      // Compute preview from mainnet activity
      const mainnetPreview = mainnetStats
        ? computePreviewFromStats(mainnetStats, 'mainnet')
        : null

      // Use whichever preview has a higher score; fall back to a base-200 default
      const backendPreview: ScorePreview | null = backendData?.preview ?? null
      const bestPreview: ScorePreview = (() => {
        if (mainnetPreview && (!backendPreview || mainnetPreview.score >= backendPreview.score)) return mainnetPreview
        if (backendPreview) return backendPreview
        if (mainnetStats) return computePreviewFromStats(mainnetStats, 'mainnet')
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

      // Credit eligibility from the best available score
      const creditPreview: CreditPreview = backendData?.creditPreview ?? computeCreditPreview(bestPreview.score)

      return {
        profile,
        score: null,
        health,
        wallet,
        source: 'preview',
        preview: bestPreview,
        creditPreview,
        isRegistered: backendData?.isRegistered ?? false,
      }
    },
    enabled: !!address && address.length >= 32,
    staleTime: 30_000,
    retry: 1,
  })
}

// ── Credit level definitions (mirrors backend constants) ────────────────────
const LEVEL_DEFS = [
  { level: 1, minScore: 400, minKya: 1, maxUsdc: 200_000_000,     type: 'undercollateralized' as const, description: 'Starter — up to $200, no collateral required' },
  { level: 2, minScore: 500, minKya: 2, maxUsdc: 10_000_000_000,  type: 'collateralized'       as const, description: 'Established — up to $10,000, 5× collateral required',  ltv: 5  },
  { level: 3, minScore: 650, minKya: 2, maxUsdc: 100_000_000_000, type: 'collateralized'       as const, description: 'Trusted — up to $100,000, 10× collateral required',    ltv: 10 },
  { level: 4, minScore: 750, minKya: 3, maxUsdc: 500_000_000_000, type: 'undercollateralized' as const, description: 'Elite — up to $500,000, no collateral required' },
] as const

function computeCreditPreview(score: number): CreditPreview {
  const eligibleLevel = [...LEVEL_DEFS].reverse().find(l => score >= l.minScore) ?? null
  const levels: CreditLevelPreview[] = LEVEL_DEFS.map(l => ({
    level: l.level, minScore: l.minScore, minKya: l.minKya,
    maxUsd: l.maxUsdc / 1_000_000, type: l.type,
    description: l.description,
    ...('ltv' in l ? { ltv: l.ltv } : {}),
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
