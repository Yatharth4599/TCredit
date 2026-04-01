// ── FairScale Credit API Client ──────────────────────────────────────────────
//
// FairScale is the primary scoring authority for the Krexit Score.
// Their credit_score (0-100) maps directly to Krexit 200-850.
// On-chain Krexa data provides modifiers on top.
//
// Graceful fallback: if env vars missing or API fails, returns null.
// Without FairScale, agents get a default base of 400 (L1 only).

// ── Types (matched to actual FairScale v3 API response) ─────────────────────

export interface FairScaleRiskFlag {
  type: 'positive' | 'warning' | 'critical'
  signal: string
  detail: string
}

export interface FairScaleReport {
  wallet: string
  credit_score: number                    // 0-100
  risk_band: 'prime' | 'near_prime' | 'subprime' | 'deep_subprime' | 'decline'
  fairscore?: number                      // 0-100 (FairScale's own score)
  fairscore_tier?: string

  // Confidence — top-level on /credit, nested in underwriting on /credit/quick
  confidence?: { score: number; level: string }

  underwriting: {
    lending_terms: {
      recommendation: string
      suggested_apr_range: { low: number; high: number }
      collateral_ratio: number
      max_credit_line: number
      max_term_days: number
    }
    risk_flags: FairScaleRiskFlag[]
    data_confidence?: { score: number; level: string; summary: string }
  }

  affordability: {
    total_assets_usd: number
    debt_service_ratio: number
    existing_debt_usd: number
    avg_monthly_income: number
    wallet_age_days: number
    tx_count: number
    has_credit_history: boolean
    liquidations: number
  }

  attestation?: {
    type: string
    payload_hash: string
    verify_url: string
    note?: string
  }

  meta: {
    provider: string
    version: string
    layer: string
    amount_assessed: number
    scored_at: string
    cached: boolean
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract confidence score from either top-level or nested location */
export function getConfidenceScore(report: FairScaleReport): number {
  return report.confidence?.score
    ?? report.underwriting?.data_confidence?.score
    ?? 0
}

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: FairScaleReport
  ts: number
  type: 'quick' | 'full'
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const HEX_64_RE = /^[a-fA-F0-9]{64}$/
const RISK_BANDS = new Set<FairScaleReport['risk_band']>([
  'prime',
  'near_prime',
  'subprime',
  'deep_subprime',
  'decline',
])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function parseRiskFlags(v: unknown): FairScaleRiskFlag[] {
  if (!Array.isArray(v)) return []
  const out: FairScaleRiskFlag[] = []
  for (const item of v) {
    if (!isRecord(item)) continue
    const type = item.type
    const signal = item.signal
    const detail = item.detail
    if (
      (type === 'positive' || type === 'warning' || type === 'critical') &&
      typeof signal === 'string' &&
      typeof detail === 'string'
    ) {
      out.push({ type, signal, detail })
    }
  }
  return out
}

function parseUnderwriting(v: unknown): FairScaleReport['underwriting'] | null {
  if (!isRecord(v)) return null
  const terms = v.lending_terms
  if (!isRecord(terms)) return null

  const maxCreditLine = terms.max_credit_line
  if (!isFiniteNumber(maxCreditLine) || maxCreditLine < 0) {
    return null
  }

  const apr = terms.suggested_apr_range
  const aprLow = isRecord(apr) && isFiniteNumber(apr.low) ? apr.low : 0
  const aprHigh = isRecord(apr) && isFiniteNumber(apr.high) ? apr.high : 0

  let dataConfidence: FairScaleReport['underwriting']['data_confidence'] | undefined
  if (isRecord(v.data_confidence)) {
    if (
      isFiniteNumber(v.data_confidence.score) &&
      typeof v.data_confidence.level === 'string' &&
      typeof v.data_confidence.summary === 'string'
    ) {
      dataConfidence = {
        score: v.data_confidence.score,
        level: v.data_confidence.level,
        summary: v.data_confidence.summary,
      }
    }
  }

  return {
    lending_terms: {
      recommendation: typeof terms.recommendation === 'string' ? terms.recommendation : '',
      suggested_apr_range: { low: aprLow, high: aprHigh },
      collateral_ratio: isFiniteNumber(terms.collateral_ratio) ? terms.collateral_ratio : 0,
      max_credit_line: maxCreditLine,
      max_term_days: isFiniteNumber(terms.max_term_days) ? terms.max_term_days : 0,
    },
    risk_flags: parseRiskFlags(v.risk_flags),
    data_confidence: dataConfidence,
  }
}

function validateFairScaleReport(raw: unknown): FairScaleReport | null {
  if (!isRecord(raw)) return null

  const creditScore = raw.credit_score
  if (!isFiniteNumber(creditScore) || creditScore < 0 || creditScore > 100) {
    return null
  }

  const riskBand = raw.risk_band
  if (typeof riskBand !== 'string' || !RISK_BANDS.has(riskBand as FairScaleReport['risk_band'])) {
    return null
  }

  const underwriting = parseUnderwriting(raw.underwriting)
  if (!underwriting) return null

  let confidence: FairScaleReport['confidence'] | undefined
  if (isRecord(raw.confidence) && isFiniteNumber(raw.confidence.score) && typeof raw.confidence.level === 'string') {
    confidence = { score: raw.confidence.score, level: raw.confidence.level }
  }

  let attestation: FairScaleReport['attestation'] | undefined
  if (isRecord(raw.attestation)) {
    const payloadHash = raw.attestation.payload_hash
    const verifyUrl = raw.attestation.verify_url
    const attType = raw.attestation.type
    if (
      typeof payloadHash === 'string' &&
      HEX_64_RE.test(payloadHash) &&
      typeof verifyUrl === 'string' &&
      typeof attType === 'string'
    ) {
      attestation = {
        type: attType,
        payload_hash: payloadHash,
        verify_url: verifyUrl,
        note: typeof raw.attestation.note === 'string' ? raw.attestation.note : undefined,
      }
    }
  }

  const report: FairScaleReport = {
    wallet: typeof raw.wallet === 'string' ? raw.wallet : '',
    credit_score: creditScore,
    risk_band: riskBand as FairScaleReport['risk_band'],
    fairscore: isFiniteNumber(raw.fairscore) ? raw.fairscore : undefined,
    fairscore_tier: typeof raw.fairscore_tier === 'string' ? raw.fairscore_tier : undefined,
    confidence,
    underwriting,
    affordability: isRecord(raw.affordability)
      ? {
          total_assets_usd: isFiniteNumber(raw.affordability.total_assets_usd) ? raw.affordability.total_assets_usd : 0,
          debt_service_ratio: isFiniteNumber(raw.affordability.debt_service_ratio) ? raw.affordability.debt_service_ratio : 0,
          existing_debt_usd: isFiniteNumber(raw.affordability.existing_debt_usd) ? raw.affordability.existing_debt_usd : 0,
          avg_monthly_income: isFiniteNumber(raw.affordability.avg_monthly_income) ? raw.affordability.avg_monthly_income : 0,
          wallet_age_days: isFiniteNumber(raw.affordability.wallet_age_days) ? raw.affordability.wallet_age_days : 0,
          tx_count: isFiniteNumber(raw.affordability.tx_count) ? raw.affordability.tx_count : 0,
          has_credit_history: raw.affordability.has_credit_history === true,
          liquidations: isFiniteNumber(raw.affordability.liquidations) ? raw.affordability.liquidations : 0,
        }
      : {
          total_assets_usd: 0,
          debt_service_ratio: 0,
          existing_debt_usd: 0,
          avg_monthly_income: 0,
          wallet_age_days: 0,
          tx_count: 0,
          has_credit_history: false,
          liquidations: 0,
        },
    attestation,
    meta: isRecord(raw.meta)
      ? {
          provider: typeof raw.meta.provider === 'string' ? raw.meta.provider : 'fairscale',
          version: typeof raw.meta.version === 'string' ? raw.meta.version : 'unknown',
          layer: typeof raw.meta.layer === 'string' ? raw.meta.layer : 'unknown',
          amount_assessed: isFiniteNumber(raw.meta.amount_assessed) ? raw.meta.amount_assessed : 0,
          scored_at: typeof raw.meta.scored_at === 'string' ? raw.meta.scored_at : new Date().toISOString(),
          cached: raw.meta.cached === true,
        }
      : {
          provider: 'fairscale',
          version: 'unknown',
          layer: 'unknown',
          amount_assessed: 0,
          scored_at: new Date().toISOString(),
          cached: false,
        },
  }

  if (!report.wallet || report.wallet.length > 64) {
    return null
  }
  return report
}

// ── HTTP Client ──────────────────────────────────────────────────────────────

async function callFairScale(
  endpoint: string,
  wallet: string,
  amount: number,
  timeoutMs: number,
  reportType: 'quick' | 'full',
): Promise<FairScaleReport | null> {
  const baseUrl = process.env.FAIRSCALE_API_URL
  const apiKey = process.env.FAIRSCALE_API_KEY
  if (!baseUrl || !apiKey) return null
  if (!wallet || wallet.length > 64) {
    console.warn(`[FairScale] ${endpoint} invalid wallet input`)
    return null
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.warn(`[FairScale] ${endpoint} invalid amount input`)
    return null
  }

  const cacheKey = `${wallet.toLowerCase()}:${Math.round(amount)}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (reportType === 'quick' || cached.type === 'full') return cached.data
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const base = new URL(baseUrl)
    const url = new URL(endpoint, base)
    url.searchParams.set('wallet', wallet)
    url.searchParams.set('amount', String(amount))
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey },
      signal: controller.signal,
    })

    if (!res.ok) {
      console.warn(`[FairScale] ${endpoint} returned ${res.status}`)
      return null
    }

    const raw = await res.json() as unknown
    const data = validateFairScaleReport(raw)
    if (!data) {
      console.warn(`[FairScale] ${endpoint} returned invalid payload shape`)
      return null
    }
    cache.set(cacheKey, { data, ts: Date.now(), type: reportType })
    const evictTimer = setTimeout(() => cache.delete(cacheKey), CACHE_TTL)
    if (typeof evictTimer === 'object' && 'unref' in evictTimer) evictTimer.unref()
    return data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`[FairScale] ${endpoint} timed out after ${timeoutMs}ms`)
    } else {
      console.warn(`[FairScale] ${endpoint} failed:`, err instanceof Error ? err.message : err)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchQuickReport(wallet: string, loanAmount: number): Promise<FairScaleReport | null> {
  return callFairScale('/credit/quick', wallet, loanAmount, 5000, 'quick')
}

export async function fetchFullReport(wallet: string, loanAmount: number): Promise<FairScaleReport | null> {
  return callFairScale('/credit', wallet, loanAmount, 20000, 'full')
}
