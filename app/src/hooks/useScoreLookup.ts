import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Connection } from '@solana/web3.js'
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

// ── Mainnet RPC (browser-side — not blocked like server IPs) ─────────────────
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com'
const mainnetConn = new Connection(MAINNET_RPC, 'confirmed')

async function fetchMainnetActivity(address: string): Promise<{
  lamports: number
  txCount: number
  walletAgeDays: number
  tokenAccounts: number
} | null> {
  try {
    const pk = new PublicKey(address)
    const [accountInfo, sigs, tokenAccts] = await Promise.allSettled([
      mainnetConn.getAccountInfo(pk),
      mainnetConn.getSignaturesForAddress(pk, { limit: 100 }),
      mainnetConn.getParsedTokenAccountsByOwner(pk, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      }),
    ])
    const lamports = accountInfo.status === 'fulfilled' ? (accountInfo.value?.lamports ?? 0) : 0
    const signatures = sigs.status === 'fulfilled' ? sigs.value : []
    const tokenCount = tokenAccts.status === 'fulfilled' ? tokenAccts.value.value.length : 0

    let walletAgeDays = 0
    if (signatures.length > 0) {
      const oldest = signatures[signatures.length - 1]
      if (oldest.blockTime) walletAgeDays = (Date.now() / 1000 - oldest.blockTime) / 86400
    }

    return { lamports, txCount: signatures.length, walletAgeDays, tokenAccounts: tokenCount }
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

      // No on-chain score — fetch backend preview (devnet) + mainnet in parallel
      const [backendResp, mainnetStats] = await Promise.allSettled([
        fetch(`${config.apiUrl}/api/v1/solana/score/${address}`).then(r => r.ok ? r.json() : null),
        fetchMainnetActivity(address),
      ])

      const backendData = backendResp.status === 'fulfilled' ? backendResp.value : null
      const mainnet = mainnetStats.status === 'fulfilled' ? mainnetStats.value : null

      // Compute mainnet preview client-side (browser can hit mainnet-beta freely)
      const mainnetPreview = mainnet && (mainnet.lamports > 0 || mainnet.txCount > 0 || mainnet.tokenAccounts > 0)
        ? computePreviewFromStats(mainnet, 'mainnet')
        : null

      // Use whichever preview has a higher score
      const backendPreview: ScorePreview | null = backendData?.preview ?? null
      const bestPreview = mainnetPreview && (!backendPreview || mainnetPreview.score > backendPreview.score)
        ? mainnetPreview
        : backendPreview

      // Credit preview always comes from backend (uses the best score for evaluation)
      // If mainnet preview is better, re-fetch with the mainnet score override
      let creditPreview: CreditPreview | null = backendData?.creditPreview ?? null
      if (mainnetPreview && mainnetPreview.score > (backendPreview?.score ?? 0) && bestPreview) {
        // Recompute credit eligibility client-side with mainnet score
        creditPreview = computeCreditPreview(bestPreview.score)
      }

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
