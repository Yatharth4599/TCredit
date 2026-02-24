import { useEffect, useRef, useState } from 'react'
import s from './WaterfallFlow.module.css'

const TIERS = [
  { name: 'Senior Capital',      desc: 'Institutional lending partners with priority repayment rights', color: '#FF6B35', fillPct: 80, badge: 'PAID FIRST',  delay: 0,    connDelay: 800  },
  { name: 'Liquidity Pools',     desc: 'TigerPay Alpha + co-owned partner pools',                       color: '#3b82f6', fillPct: 64, badge: 'AUTO-SPLIT', delay: 1100, connDelay: 1900 },
  { name: 'Community Investors', desc: 'Vault investors earning higher yield at higher risk',            color: '#34d399', fillPct: 45, badge: 'YIELD+',     delay: 2200, connDelay: null  },
] as const

const TIER_ICONS = [
  <svg key="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" opacity="0.7"/></svg>,
  <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/><path d="M8 14a4 4 0 004 4" opacity="0.5"/></svg>,
  <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" opacity="0.5"/></svg>,
]

const COUNTER_CONFIG = [
  { target: 400, label: 'Senior (Jupiter)', delay: 200,  duration: 700 },
  { target: 80,  label: 'Liquidity Pools',  delay: 1300, duration: 700 },
  { target: 20,  label: 'Community',        delay: 2400, duration: 600 },
]

function PadlockIcon({ color }: { color: string }) {
  return (
    <svg className={s.padlock} width="32" height="36" viewBox="0 0 32 36" fill="none">
      <g className={s.padlockShackle}>
        <path d="M9 16V11a7 7 0 0114 0v5" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      </g>
      <rect x="3" y="15" width="26" height="18" rx="4" fill={`${color}22`} stroke={color} strokeWidth="2"/>
      <circle cx="16" cy="24" r="3" fill={color} opacity="0.8"/>
    </svg>
  )
}

export default function WaterfallFlow() {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'idle' | 'playing'>('idle')
  const [unlockedTiers, setUnlockedTiers] = useState([false, false, false])
  const [litConns, setLitConns] = useState([false, false])
  const [counters, setCounters] = useState([0, 0, 0])
  const [cascade, setCascade] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const animRef = useRef(0)
  const startRef = useRef(0)

  function reset() {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
    cancelAnimationFrame(animRef.current)
    setPhase('idle')
    setUnlockedTiers([false, false, false])
    setLitConns([false, false])
    setCounters([0, 0, 0])
    setCascade(false)
    setFooterVisible(false)
  }

  function play() {
    setPhase('playing')
    TIERS.forEach((tier, i) => {
      timerRefs.current.push(setTimeout(() => {
        setUnlockedTiers(prev => { const n = [...prev]; n[i] = true; return n })
      }, tier.delay))
      if (tier.connDelay !== null) {
        const cd = tier.connDelay
        timerRefs.current.push(setTimeout(() => {
          setLitConns(prev => { const n = [...prev]; n[i] = true; return n })
        }, cd))
      }
    })
    timerRefs.current.push(setTimeout(() => setCascade(true), 3000))
    timerRefs.current.push(setTimeout(() => setFooterVisible(true), 3200))

    startRef.current = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const next = COUNTER_CONFIG.map(({ target, delay, duration }) => {
        const t = Math.max(0, elapsed - delay)
        const p = Math.min(1, t / duration)
        return Math.round(target * (1 - Math.pow(1 - p, 3)))
      })
      setCounters(next)
      const lastEnd = COUNTER_CONFIG[2].delay + COUNTER_CONFIG[2].duration
      if (elapsed < lastEnd) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        reset()
        requestAnimationFrame(() => requestAnimationFrame(() => play()))
      } else {
        reset()
      }
    }, { threshold: 0.2 })
    observer.observe(el)
    return () => { observer.disconnect(); reset() }
  }, [])

  return (
    <div ref={ref} className={`${s.wrap} ${phase === 'playing' ? s.playing : ''}`}>

      {/* ── Left panel ── */}
      <div className={s.left}>
        <div className={s.counterBox}>
          <h4 className={s.counterTitle}>Example: AED 500K Gym Loan</h4>
          <div className={s.counterGrid}>
            {COUNTER_CONFIG.map((c, i) => (
              <div key={i} className={s.counterItem}>
                <span className={`${s.counterValue} ${counters[i] >= c.target ? s.counterDone : ''}`}>
                  {counters[i]}K
                </span>
                <span className={s.counterLabel}>{c.label}</span>
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
        <p className={`${s.footerNote} ${footerVisible ? s.footerNoteVisible : ''}`}>
          ✦ Smart-contract enforced · No manual routing
        </p>
      </div>

      {/* ── Right: tier stack ── */}
      <div className={s.tower}>
        {TIERS.map((tier, i) => {
          const unlocked = unlockedTiers[i]
          return (
            <div key={i}>
              {i > 0 && (
                <div
                  className={`${s.connector} ${litConns[i - 1] ? s.connLit : ''}`}
                  style={{ '--conn-color': TIERS[i - 1].color } as React.CSSProperties}
                >
                  <div
                    className={`${s.connDot} ${litConns[i - 1] ? s.connDotPlay : ''}`}
                    style={{ background: TIERS[i - 1].color, boxShadow: `0 0 10px ${TIERS[i - 1].color}` }}
                  />
                </div>
              )}

              <div
                className={`${s.tierCard} ${unlocked ? s.tierUnlocked : s.tierLocked}`}
                style={{ '--tier-color': tier.color } as React.CSSProperties}
              >
                {/* Vault door overlay — clips upward on unlock */}
                <div className={`${s.vaultDoor} ${unlocked ? s.vaultDoorOpen : ''}`} />

                {/* Border flash on unlock */}
                {unlocked && (
                  <div className={s.borderFlash} style={{ '--flash-color': tier.color } as React.CSSProperties} />
                )}

                {/* Padlock — fades out on unlock */}
                <div className={`${s.padlockWrap} ${unlocked ? s.padlockUnlocking : ''}`}>
                  <PadlockIcon color={tier.color} />
                </div>

                {/* Card content — fades in on unlock */}
                <div className={`${s.tierContent} ${unlocked ? s.tierContentVisible : ''}`}>
                  <div className={s.tierFill} style={{ background: tier.color }} />
                  <div className={s.tierShimmer} />
                  <div className={s.tierAccent} style={{ background: tier.color }} />
                  <div className={s.tierBody}>
                    <div className={s.tierRow}>
                      <span className={s.tierName}>
                        <span className={s.tierIcon} style={{ color: tier.color }}>{TIER_ICONS[i]}</span>
                        {tier.name}
                      </span>
                      <span
                        className={`${s.tierBadge} ${unlocked ? s.tierBadgePulse : ''}`}
                        style={{ borderColor: tier.color, color: tier.color }}
                      >
                        {tier.badge}
                      </span>
                    </div>
                    <span className={s.tierDesc}>{tier.desc}</span>
                    <div className={s.tierBar}>
                      <div className={s.tierBarTrack}>
                        <div
                          className={`${s.tierBarFill} ${unlocked ? s.tierBarFillAnimate : ''}`}
                          style={{
                            background: `linear-gradient(90deg, ${tier.color}, ${tier.color}bb)`,
                            '--fill-pct': `${tier.fillPct}%`,
                          } as React.CSSProperties}
                        />
                      </div>
                      <span className={s.tierBarLabel} style={{ color: tier.color }}>{tier.fillPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {cascade && <div className={s.cascadeGlow} />}
      </div>
    </div>
  )
}

