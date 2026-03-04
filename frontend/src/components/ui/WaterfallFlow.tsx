import { useEffect, useRef, useState } from 'react'
import s from './WaterfallFlow.module.css'

const TIERS = [
  {
    name: 'Senior Capital',
    desc: 'NBFC institutional lenders — priority repayment, lowest risk',
    color: '#FF6B35',
    principal: 25_000,
    totalReturn: 26_500,
    yieldRate: '1%/mo',
    badge: 'PAID FIRST',
    fillDuration: 1400,
  },
  {
    name: 'Liquidity Pools',
    desc: 'LP mezzanine pool — mid-risk, auto-split from revenue',
    color: '#3b82f6',
    principal: 15_000,
    totalReturn: 16_128,
    yieldRate: '1.25%/mo',
    badge: 'PAID SECOND',
    fillDuration: 1100,
  },
  {
    name: 'Community Investors',
    desc: 'Protocol treasury — first-loss layer, highest yield',
    color: '#34d399',
    principal: 10_000,
    totalReturn: 10_900,
    yieldRate: '1.5%/mo',
    badge: 'PAID LAST',
    fillDuration: 900,
  },
] as const

const TOTAL_OBLIGATION = TIERS.reduce((sum, t) => sum + t.totalReturn, 0)

const TIER_ICONS = [
  <svg key="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" opacity="0.7"/></svg>,
  <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/><path d="M8 14a4 4 0 004 4" opacity="0.5"/></svg>,
  <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" opacity="0.5"/></svg>,
]

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
  life: number
  maxLife: number
}

function WaterfallBackground({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef(0)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colors = ['#FF6B35', '#3b82f6', '#34d399']

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.offsetWidth
      canvas.height = parent.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.3 + 0.05,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: Infinity,
      })
    }

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      if (!playingRef.current) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(255,255,255,0.02)'
      ctx.lineWidth = 0.5
      const gridSize = 60
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      particlesRef.current.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.maxLife !== Infinity) {
          p.life++
          p.alpha = Math.max(0, (1 - p.life / p.maxLife) * 0.8)
        }

        if (p.y < -10) p.y = canvas.height + 10
        if (p.x < -10) p.x = canvas.width + 10
        if (p.x > canvas.width + 10) p.x = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
        ctx.globalAlpha = 1
      })

      particlesRef.current = particlesRef.current.filter(
        p => p.maxLife === Infinity || p.life < p.maxLife
      )
    }
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      particlesRef.current = []
    }
  }, [])

  return <canvas ref={canvasRef} className={s.waterfallBg} />
}

function spawnBurstParticles(
  container: HTMLElement,
  color: string,
  count: number = 12
) {
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div')
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
    const dist = 30 + Math.random() * 40
    const tx = Math.cos(angle) * dist
    const ty = Math.sin(angle) * dist
    dot.style.cssText = `
      position:absolute;top:50%;left:50%;width:${3 + Math.random() * 3}px;height:${3 + Math.random() * 3}px;
      border-radius:50%;background:${color};pointer-events:none;z-index:30;
      opacity:0.9;transform:translate(-50%,-50%);
      transition:all ${0.4 + Math.random() * 0.3}s cubic-bezier(0.16,1,0.3,1);
    `
    container.appendChild(dot)
    requestAnimationFrame(() => {
      dot.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`
      dot.style.opacity = '0'
    })
    setTimeout(() => dot.remove(), 800)
  }
}

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

function fmtK(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  return `$${n}`
}

export default function WaterfallFlow() {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'idle' | 'playing'>('idle')
  const [unlockedTiers, setUnlockedTiers] = useState([false, false, false])
  const [litConns, setLitConns] = useState([false, false])
  const [tierFills, setTierFills] = useState([0, 0, 0])
  const [tierDone, setTierDone] = useState([false, false, false])
  const [counters, setCounters] = useState([0, 0, 0])
  const [cascade, setCascade] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const animRef = useRef(0)
  const tierCardRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])

  function reset() {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
    cancelAnimationFrame(animRef.current)
    setPhase('idle')
    setUnlockedTiers([false, false, false])
    setLitConns([false, false])
    setTierFills([0, 0, 0])
    setTierDone([false, false, false])
    setCounters([0, 0, 0])
    setCascade(false)
    setFooterVisible(false)
    setCompletedCount(0)
  }

  function play() {
    setPhase('playing')

    const unlockDelay = 300
    const fillGap = 300
    const tierTimings: { unlockAt: number; fillStartAt: number; fillEndAt: number }[] = []

    let cursor = unlockDelay

    TIERS.forEach((tier, i) => {
      const unlockAt = cursor
      const fillStartAt = unlockAt + 400
      const fillEndAt = fillStartAt + tier.fillDuration

      tierTimings.push({ unlockAt, fillStartAt, fillEndAt })

      timerRefs.current.push(setTimeout(() => {
        setUnlockedTiers(prev => { const n = [...prev]; n[i] = true; return n })
        const card = tierCardRefs.current[i]
        if (card) spawnBurstParticles(card, tier.color, 14)
      }, unlockAt))

      timerRefs.current.push(setTimeout(() => {
        setTierFills(prev => { const n = [...prev]; n[i] = 100; return n })
      }, fillStartAt))

      timerRefs.current.push(setTimeout(() => {
        setTierDone(prev => { const n = [...prev]; n[i] = true; return n })
        setCompletedCount(prev => prev + 1)
        if (i < TIERS.length - 1) {
          setLitConns(prev => { const n = [...prev]; n[i] = true; return n })
        }
      }, fillEndAt))

      cursor = fillEndAt + fillGap
    })

    const lastFillEnd = tierTimings[tierTimings.length - 1].fillEndAt
    timerRefs.current.push(setTimeout(() => setCascade(true), lastFillEnd + 300))
    timerRefs.current.push(setTimeout(() => setFooterVisible(true), lastFillEnd + 500))

    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const next = TIERS.map((tier, i) => {
        const { fillStartAt, fillEndAt } = tierTimings[i]
        if (elapsed < fillStartAt) return 0
        const t = Math.min(1, (elapsed - fillStartAt) / (fillEndAt - fillStartAt))
        const eased = 1 - Math.pow(1 - t, 3)
        return Math.round(tier.totalReturn * eased)
      })
      setCounters(next)
      if (elapsed < lastFillEnd) {
        animRef.current = requestAnimationFrame(tick)
      } else {
        setCounters(TIERS.map(t => t.totalReturn))
      }
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
      <WaterfallBackground playing={phase === 'playing'} />

      <div className={s.left}>
        <div className={s.counterBox}>
          <h4 className={s.counterTitle}>$50K Credit Line — Waterfall Repayment</h4>
          <div className={s.counterGrid}>
            {TIERS.map((tier, i) => (
              <div key={i} className={s.counterItem}>
                <span
                  className={`${s.counterValue} ${tierDone[i] ? s.counterDone : ''}`}
                  style={tierDone[i] ? { color: tier.color, textShadow: `0 0 16px ${tier.color}77` } : undefined}
                >
                  {fmtK(counters[i])}
                </span>
                <span className={s.counterLabel}>{tier.name}</span>
              </div>
            ))}
          </div>
          <div className={s.counterTotal}>
            <span className={s.counterTotalLabel}>Total obligation</span>
            <span className={s.counterTotalValue}>{fmtK(TOTAL_OBLIGATION)}</span>
          </div>
        </div>
        <ul className={s.bullets}>
          <li className={s.bullet0}><span className={s.check}>✓</span> Senior lenders are paid in full first — lowest risk</li>
          <li className={s.bullet1}><span className={s.check}>✓</span> Mezzanine receives flow only after Senior is complete</li>
          <li className={s.bullet2}><span className={s.check}>✓</span> Community absorbs first losses, earns highest yield</li>
          <li className={s.bullet3}><span className={s.check}>✓</span> Smart-contract enforced — no manual routing</li>
        </ul>
        <p className={`${s.footerNote} ${footerVisible ? s.footerNoteVisible : ''}`}>
          ✦ 15% of all revenue auto-routed to waterfall · On-chain enforced
        </p>
      </div>

      <div className={s.tower}>
        <div
          className={`${s.ambientGlow} ${completedCount > 0 ? s.ambientGlowActive : ''}`}
          style={{ opacity: completedCount * 0.15 }}
        />
        {TIERS.map((tier, i) => {
          const unlocked = unlockedTiers[i]
          const done = tierDone[i]
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
                ref={el => { tierCardRefs.current[i] = el }}
                className={`${s.tierCard} ${unlocked ? s.tierUnlocked : s.tierLocked}`}
                style={{ '--tier-color': tier.color } as React.CSSProperties}
              >
                <div className={`${s.vaultDoor} ${unlocked ? s.vaultDoorOpen : ''}`} />

                {unlocked && (
                  <div className={s.borderFlash} style={{ '--flash-color': tier.color } as React.CSSProperties} />
                )}

                <div className={`${s.padlockWrap} ${unlocked ? s.padlockUnlocking : ''}`}>
                  <PadlockIcon color={tier.color} />
                </div>

                <div className={`${s.tierContent} ${unlocked ? s.tierContentVisible : ''}`}>
                  <div
                    className={s.tierFill}
                    style={{
                      background: tier.color,
                      width: `${tierFills[i] * 0.85}%`,
                    }}
                  />
                  <div className={s.tierShimmer} />
                  <div className={s.tierAccent} style={{ background: tier.color }} />
                  <div className={s.tierBody}>
                    <div className={s.tierRow}>
                      <span className={s.tierName}>
                        <span className={s.tierIcon} style={{ color: tier.color }}>{TIER_ICONS[i]}</span>
                        {tier.name}
                      </span>
                      <div className={s.tierBadgeRow}>
                        {done && (
                          <span className={s.tierDoneBadge} style={{ background: `${tier.color}22`, color: tier.color, boxShadow: `0 0 12px ${tier.color}55, 0 0 24px ${tier.color}33` }}>
                            ✓ PAID
                          </span>
                        )}
                        <span
                          className={`${s.tierBadge} ${unlocked ? s.tierBadgePulse : ''}`}
                          style={{ borderColor: tier.color, color: tier.color }}
                        >
                          {tier.badge}
                        </span>
                      </div>
                    </div>
                    <span className={s.tierDesc}>{tier.desc}</span>
                    <div className={s.tierMeta}>
                      <span className={s.tierMetaItem}>
                        Principal: <strong>{fmtK(tier.principal)}</strong>
                      </span>
                      <span className={s.tierMetaDot}>·</span>
                      <span className={s.tierMetaItem}>
                        Yield: <strong>{tier.yieldRate}</strong>
                      </span>
                      <span className={s.tierMetaDot}>·</span>
                      <span className={s.tierMetaItem}>
                        Obligation: <strong>{fmtK(tier.totalReturn)}</strong>
                      </span>
                    </div>
                    <div className={s.tierBar}>
                      <div className={s.tierBarTrack}>
                        <div
                          className={s.tierBarFill}
                          style={{
                            background: `linear-gradient(90deg, ${tier.color}, ${tier.color}bb)`,
                            width: `${tierFills[i]}%`,
                            transition: `width ${tier.fillDuration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                          }}
                        />
                      </div>
                      <span className={s.tierBarLabel} style={{ color: tier.color }}>{tierFills[i]}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {cascade && (
          <>
            <div className={s.cascadeFlash} />
            <div className={s.cascadeGlow} />
          </>
        )}
      </div>
    </div>
  )
}
