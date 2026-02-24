import { useEffect, useRef, useState, useMemo } from 'react'
import s from './WaterfallFlow.module.css'

const TIER_ICONS = [
  // Shield — Senior Capital
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" opacity="0.6"/></svg>,
  // Droplets — Liquidity Pools
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/><path d="M8 14a4 4 0 004 4" opacity="0.5"/></svg>,
  // Users — Community Investors
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" opacity="0.5"/></svg>,
  // Lock — Risk Buffer
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1" fill="currentColor" opacity="0.5"/></svg>,
]

const TIER_BADGES = ['Paid First', 'Auto-Split', 'Yield+', 'First-Loss']

const TIERS = [
  { name: 'Senior Capital', desc: 'Institutional lending partners with priority repayment rights', color: '#FF6B35', fillPct: 80 },
  { name: 'Liquidity Pools', desc: 'TigerPay Alpha + co-owned partner pools', color: '#3b82f6', fillPct: 64 },
  { name: 'Community Investors', desc: 'Vault investors earning higher yield at higher risk', color: '#34d399', fillPct: 45 },
  { name: 'Risk Buffer', desc: 'Community staking layer — absorbs defaults first', color: 'rgba(255,255,255,0.35)', fillPct: 30 },
]

const COUNTER_TARGETS = [400, 80, 20]
const COUNTER_LABELS = ['Senior (Jupiter)', 'Liquidity Pools', 'Community']
const COUNTER_DELAYS = [300, 2200, 3600]
const COUNTER_DURATIONS = [1800, 1300, 1000]

interface Bill {
  wave: number
  settled: boolean
  x: number
  delay: number
  duration: number
  rotation: number
  size: number
  drift: number
}

function generateBills(): Bill[] {
  const bills: Bill[] = []
  // Wave 0: Rain into Senior (10 falling + 4 settled)
  for (let i = 0; i < 10; i++) {
    bills.push({ wave: 0, settled: false, x: 8 + Math.random() * 84, delay: Math.random() * 0.8, duration: 1.0 + Math.random() * 0.7, rotation: -45 + Math.random() * 90, size: 0.8 + Math.random() * 0.5, drift: -20 + Math.random() * 40 })
  }
  for (let i = 0; i < 4; i++) {
    bills.push({ wave: 0, settled: true, x: 18 + Math.random() * 64, delay: 0.1 + Math.random() * 0.5, duration: 1.3 + Math.random() * 0.4, rotation: -12 + Math.random() * 24, size: 0.85 + Math.random() * 0.3, drift: -10 + Math.random() * 20 })
  }
  // Wave 1: Overflow to Liquidity (4 falling + 2 settled)
  for (let i = 0; i < 4; i++) {
    bills.push({ wave: 1, settled: false, x: 25 + Math.random() * 50, delay: 2.0 + Math.random() * 0.5, duration: 0.7 + Math.random() * 0.4, rotation: -30 + Math.random() * 60, size: 0.75 + Math.random() * 0.4, drift: -15 + Math.random() * 30 })
  }
  for (let i = 0; i < 2; i++) {
    bills.push({ wave: 1, settled: true, x: 30 + Math.random() * 40, delay: 2.1 + Math.random() * 0.4, duration: 0.9 + Math.random() * 0.3, rotation: -8 + Math.random() * 16, size: 0.8 + Math.random() * 0.3, drift: -8 + Math.random() * 16 })
  }
  // Wave 2: Trickle to Community (2 falling + 1 settled)
  for (let i = 0; i < 2; i++) {
    bills.push({ wave: 2, settled: false, x: 30 + Math.random() * 40, delay: 3.5 + Math.random() * 0.3, duration: 0.6 + Math.random() * 0.3, rotation: -20 + Math.random() * 40, size: 0.7 + Math.random() * 0.3, drift: -10 + Math.random() * 20 })
  }
  bills.push({ wave: 2, settled: true, x: 35 + Math.random() * 30, delay: 3.6, duration: 0.8, rotation: 4, size: 0.75, drift: 5 })
  // Wave 3: Single drip to Risk Buffer
  bills.push({ wave: 3, settled: false, x: 40 + Math.random() * 20, delay: 4.5, duration: 0.5, rotation: 6, size: 0.65, drift: 3 })
  return bills
}

export default function WaterfallFlow() {
  const ref = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [counters, setCounters] = useState([0, 0, 0])
  const animRef = useRef(0)
  const startRef = useRef(0)
  const bills = useMemo(generateBills, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPlaying(false)
        requestAnimationFrame(() => requestAnimationFrame(() => setPlaying(true)))
      } else {
        setPlaying(false)
        setCounters([0, 0, 0])
        cancelAnimationFrame(animRef.current)
      }
    }, { threshold: 0.2 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing) return
    startRef.current = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const next = COUNTER_TARGETS.map((target, i) => {
        const t = Math.max(0, elapsed - COUNTER_DELAYS[i])
        const p = Math.min(1, t / COUNTER_DURATIONS[i])
        const eased = 1 - Math.pow(1 - p, 3)
        return Math.round(target * eased)
      })
      setCounters(next)
      if (elapsed < COUNTER_DELAYS[2] + COUNTER_DURATIONS[2]) {
        animRef.current = requestAnimationFrame(tick)
      }
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [playing])

  const cls = playing ? `${s.wrap} ${s.playing}` : s.wrap

  return (
    <div ref={ref} className={cls}>
      {/* ── Left: text + counters ── */}
      <div className={s.left}>
        <div className={s.counterBox}>
          <h4 className={s.counterTitle}>Example: AED 500K Gym Loan</h4>
          <div className={s.counterGrid}>
            {COUNTER_TARGETS.map((_, i) => (
              <div key={i} className={s.counterItem}>
                <span className={`${s.counterValue} ${counters[i] >= COUNTER_TARGETS[i] ? s.counterDone : ''}`}>
                  {counters[i]}K
                </span>
                <span className={s.counterLabel}>{COUNTER_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <ul className={s.bullets}>
          <li className={s.bullet0}><span className={s.check}>✓</span> Repayment cascades top-down automatically</li>
          <li className={s.bullet1}><span className={s.check}>✓</span> Senior lenders are paid first — lowest risk</li>
          <li className={s.bullet2}><span className={s.check}>✓</span> Community layer absorbs first losses</li>
          <li className={s.bullet3}><span className={s.check}>✓</span> Smart-contract enforced — no manual routing</li>
        </ul>
      </div>

      {/* ── Right: animated waterfall tower ── */}
      <div className={s.tower}>
        {/* Dollar bill particles */}
        {bills.map((b, i) => (
          <div
            key={i}
            className={`${s.bill} ${s[`w${b.wave}`]} ${b.settled ? s.settled : ''}`}
            style={{
              left: `${b.x}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              '--rot': `${b.rotation}deg`,
              '--drift': `${b.drift}px`,
              '--sz': b.size,
            } as any}
          >
            <span className={s.billSymbol}>$</span>
          </div>
        ))}

        {/* Tier cards with fill bars + connectors */}
        {TIERS.map((tier, i) => (
          <div key={i}>
            {i > 0 && (
              <div className={`${s.connector} ${s[`c${i}`]}`}>
                <div className={s.connDot} />
                <div className={`${s.connDot} ${s.connDot2}`} />
                <span className={s.connArrow}>▾</span>
              </div>
            )}
            <div className={`${s.tierCard} ${s[`t${i}`]}`}>
              <div className={s.tierFill} style={{ background: tier.color }} />
              <div className={s.tierShimmer} />
              <div className={s.tierAccent} style={{ background: tier.color }} />
              <div className={s.tierBody}>
                <div className={s.tierRow}>
                  <span className={s.tierName}>
                    <span className={s.tierIcon} style={{ color: tier.color }}>{TIER_ICONS[i]}</span>
                    {tier.name}
                  </span>
                  <span className={s.tierBadge} style={{ borderColor: tier.color, color: tier.color }}>{TIER_BADGES[i]}</span>
                </div>
                <span className={s.tierDesc}>{tier.desc}</span>
                <div className={s.tierBar}>
                  <div className={s.tierBarFill} style={{ background: tier.color }} />
                  <span className={s.tierBarLabel} style={{ color: tier.color }}>{tier.fillPct}%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
