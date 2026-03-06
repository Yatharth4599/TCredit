import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion, AnimatePresence } from 'motion/react'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styles from './VaultsMarketing.module.css'

gsap.registerPlugin(ScrollTrigger)

const ease = [0.16, 1, 0.3, 1] as const

const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
}

const staggerChild = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
}

const listContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
}

const listItem = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
}

function Counter({ visible, end, prefix = '', suffix = '', decimals = 0 }: {
    visible: boolean; end: number; prefix?: string; suffix?: string; decimals?: number
}) {
    const [value, setValue] = useState(0)
    const raf = useRef(0)
    useEffect(() => {
        if (!visible) { setValue(0); return }
        const start = performance.now()
        const tick = (now: number) => {
            const p = Math.min((now - start) / 1500, 1)
            setValue((1 - Math.pow(1 - p, 3)) * end)
            if (p < 1) raf.current = requestAnimationFrame(tick)
        }
        raf.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf.current)
    }, [visible, end])
    return <>{prefix}{decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()}{suffix}</>
}

function Card3DTilt({ children, className }: { children: React.ReactNode; className?: string }) {
    const prefersReduced = useReducedMotion()
    const mx = useMotionValue(0)
    const my = useMotionValue(0)
    const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 300, damping: 30 })
    const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 300, damping: 30 })

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (prefersReduced) return
        const rect = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - rect.left) / rect.width - 0.5)
        my.set((e.clientY - rect.top) / rect.height - 0.5)
    }

    const handleMouseLeave = () => {
        mx.set(0)
        my.set(0)
    }

    if (prefersReduced) {
        return <div className={className}>{children}</div>
    }

    return (
        <motion.div
            className={className}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ rotateX, rotateY, transformPerspective: 800 }}
        >
            {children}
        </motion.div>
    )
}

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3)
}

function VaultOverviewCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const startRef = useRef<number>(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const W = 400
        const H = 320
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const cx = W / 2
        const cy = 145
        const radius = 70
        const lineWidth = 12
        const targetPct = 0.73
        const targetAngle = targetPct * Math.PI * 2

        startRef.current = 0

        function draw(progress: number) {
            ctx!.clearRect(0, 0, W, H)

            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '600 9px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'top'
            ctx!.fillText('CREDIT VAULT', cx, 16)

            ctx!.fillStyle = '#fff'
            ctx!.font = '800 16px sans-serif'
            ctx!.fillText('Meridian Coffee Co.', cx, 34)

            ctx!.strokeStyle = 'rgba(255,255,255,0.08)'
            ctx!.lineWidth = lineWidth
            ctx!.lineCap = 'round'
            ctx!.beginPath()
            ctx!.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2)
            ctx!.stroke()

            const tickCount = 24
            for (let t = 0; t < tickCount; t++) {
                const a = (t / tickCount) * Math.PI * 2 - Math.PI / 2
                const inner = radius - lineWidth / 2 - 6
                const outer = radius - lineWidth / 2 - 2
                ctx!.strokeStyle = 'rgba(255,255,255,0.1)'
                ctx!.lineWidth = 1
                ctx!.lineCap = 'butt'
                ctx!.beginPath()
                ctx!.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
                ctx!.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
                ctx!.stroke()
            }

            const currentAngle = targetAngle * progress
            if (currentAngle > 0) {
                ctx!.strokeStyle = '#2CFF05'
                ctx!.lineWidth = lineWidth
                ctx!.lineCap = 'round'
                ctx!.beginPath()
                ctx!.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + currentAngle)
                ctx!.stroke()
            }

            const currentPct = Math.round(targetPct * 100 * progress)
            ctx!.fillStyle = '#fff'
            ctx!.font = '900 28px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'middle'
            ctx!.fillText(`${currentPct}%`, cx, cy - 6)

            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '500 10px sans-serif'
            ctx!.fillText('funded', cx, cy + 16)

            const statsY = 240
            const stats = [
                { label: 'TARGET', value: '$500K' },
                { label: 'APY', value: '12%' },
                { label: 'TERM', value: '12mo' },
            ]
            const spacing = 110
            const startX = cx - spacing

            stats.forEach((s, i) => {
                const sx = startX + i * spacing
                ctx!.fillStyle = '#fff'
                ctx!.font = '700 16px monospace'
                ctx!.textAlign = 'center'
                ctx!.textBaseline = 'top'
                ctx!.fillText(s.value, sx, statsY)

                ctx!.fillStyle = 'rgba(255,255,255,0.4)'
                ctx!.font = '600 8px monospace'
                ctx!.fillText(s.label, sx, statsY + 22)
            })

            const barY = 290
            const barW = W - 80
            const barH = 6
            const barX = 40
            ctx!.fillStyle = 'rgba(255,255,255,0.08)'
            ctx!.beginPath()
            ctx!.roundRect(barX, barY, barW, barH, 0)
            ctx!.fill()

            const fillW = barW * targetPct * progress
            if (fillW > 0) {
                ctx!.fillStyle = '#2CFF05'
                ctx!.beginPath()
                ctx!.roundRect(barX, barY, fillW, barH, 0)
                ctx!.fill()
            }

            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '500 9px sans-serif'
            ctx!.textAlign = 'center'
            ctx!.fillText(`${currentPct}% funded`, cx, barY + 18)
        }

        if (reduced) {
            draw(1)
            return
        }

        startRef.current = performance.now()

        function animate() {
            const elapsed = performance.now() - startRef.current
            const duration = 1800
            const progress = active ? Math.min(elapsed / duration, 1) : 0
            const easedProgress = easeOutCubic(progress)

            draw(easedProgress)

            if (progress < 1 && active) {
                animRef.current = requestAnimationFrame(animate)
            }
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.cardCanvas} />
}

function LiveFundingCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const startRef = useRef<number>(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const W = 400
        const H = 320
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const tranches = [
            { name: 'Senior', color: '#2CFF05', target: 200000, pct: 1.0 },
            { name: 'Mezzanine', color: '#00E5FF', target: 150000, pct: 0.73 },
            { name: 'Junior', color: '#FF8C00', target: 100000, pct: 0.35 },
        ]

        function draw(progress: number) {
            ctx!.clearRect(0, 0, W, H)

            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '600 9px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'top'
            ctx!.fillText('LIVE FUNDING', W / 2, 16)

            const bigPct = Math.round(73 * progress)
            ctx!.fillStyle = '#fff'
            ctx!.font = '900 48px monospace'
            ctx!.textAlign = 'center'
            ctx!.fillText(`${bigPct}%`, W / 2, 38)

            const totalFunded = Math.round(365000 * progress)
            ctx!.fillStyle = 'rgba(255,255,255,0.5)'
            ctx!.font = '500 12px sans-serif'
            ctx!.fillText(`$${totalFunded.toLocaleString()} of $500,000`, W / 2, 95)

            const investorCount = Math.round(14 * progress)
            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '500 10px sans-serif'
            ctx!.fillText(`${investorCount} investors`, W / 2, 115)

            const barX = 40
            const barW = W - 80
            const barH = 24
            let startY = 145

            tranches.forEach((t, i) => {
                const y = startY + i * (barH + 32)

                ctx!.fillStyle = '#fff'
                ctx!.font = '600 11px sans-serif'
                ctx!.textAlign = 'left'
                ctx!.textBaseline = 'top'
                ctx!.fillText(t.name, barX, y)

                const seqDelay = i * 0.25
                const seqProgress = Math.max(0, Math.min((progress - seqDelay) / (1 - seqDelay), 1))
                const bounced = seqProgress < 1 ? easeOutCubic(seqProgress) : 1 + Math.sin((seqProgress - 1) * Math.PI * 3) * 0.03 * (1 - (seqProgress - 1))
                const fillPct = t.pct * Math.min(bounced, 1.03)
                const amount = Math.round(t.target * fillPct)

                ctx!.fillStyle = 'rgba(255,255,255,0.4)'
                ctx!.font = '600 10px monospace'
                ctx!.textAlign = 'right'
                ctx!.fillText(`$${amount.toLocaleString()}`, barX + barW, y)

                const by = y + 18
                ctx!.fillStyle = 'rgba(255,255,255,0.06)'
                ctx!.beginPath()
                ctx!.roundRect(barX, by, barW, barH, 0)
                ctx!.fill()

                const fw = barW * fillPct
                if (fw > 0) {
                    ctx!.fillStyle = t.color
                    ctx!.beginPath()
                    ctx!.roundRect(barX, by, fw, barH, 0)
                    ctx!.fill()
                }
            })
        }

        if (reduced) {
            draw(1)
            return
        }

        startRef.current = performance.now()

        function animate() {
            const elapsed = performance.now() - startRef.current
            const duration = 2200
            const progress = active ? Math.min(elapsed / duration, 1) : 0
            const easedProgress = easeOutCubic(progress)

            draw(easedProgress)

            if (progress < 1 && active) {
                animRef.current = requestAnimationFrame(animate)
            }
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.cardCanvas} />
}

function VaultSafeCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const frameRef = useRef<number>(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const W = 400
        const H = 320
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const cx = W / 2
        const vaultW = 150
        const vaultH = 120
        const vaultX = cx - vaultW / 2
        const vaultY = 40

        function drawVaultBody() {
            ctx!.fillStyle = '#3A3A4A'
            ctx!.beginPath()
            ctx!.roundRect(vaultX - 5, vaultY - 5, vaultW + 10, vaultH + 10, 0)
            ctx!.fill()

            ctx!.fillStyle = '#4E4E60'
            ctx!.beginPath()
            ctx!.roundRect(vaultX, vaultY, vaultW, vaultH, 0)
            ctx!.fill()

            ctx!.fillStyle = '#5A5A6E'
            ctx!.fillRect(vaultX, vaultY, vaultW, 3)
            ctx!.fillRect(vaultX, vaultY, 3, vaultH)
            ctx!.fillStyle = '#3E3E50'
            ctx!.fillRect(vaultX, vaultY + vaultH - 3, vaultW, 3)
            ctx!.fillRect(vaultX + vaultW - 3, vaultY, 3, vaultH)

            const rivetPositions = [
                [vaultX + 8, vaultY + 8], [vaultX + vaultW - 12, vaultY + 8],
                [vaultX + 8, vaultY + vaultH - 12], [vaultX + vaultW - 12, vaultY + vaultH - 12],
                [vaultX + vaultW / 2 - 2, vaultY + 8], [vaultX + vaultW / 2 - 2, vaultY + vaultH - 12],
            ]
            rivetPositions.forEach(([rx, ry]) => {
                ctx!.fillStyle = '#6A6A7E'
                ctx!.beginPath()
                ctx!.arc(rx + 2, ry + 2, 3, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.fillStyle = '#555568'
                ctx!.beginPath()
                ctx!.arc(rx + 2, ry + 2, 2, 0, Math.PI * 2)
                ctx!.fill()
            })

            for (let i = 0; i < 3; i++) {
                const hy = vaultY + 18 + i * 34
                ctx!.fillStyle = '#3A3A4C'
                ctx!.beginPath()
                ctx!.roundRect(vaultX - 4, hy, 8, 16, 0)
                ctx!.fill()
                ctx!.fillStyle = '#555568'
                ctx!.beginPath()
                ctx!.roundRect(vaultX - 3, hy + 1, 6, 14, 0)
                ctx!.fill()
            }
        }

        function drawHandleOnDoor(doorX: number, doorY: number, visibleW: number, doorH: number, dialAngle: number) {
            const handleCX = doorX + visibleW / 2
            const handleCY = doorY + doorH / 2 - 6
            const handleR = 20

            ctx!.strokeStyle = '#C9A84C'
            ctx!.lineWidth = 3
            ctx!.beginPath()
            ctx!.arc(handleCX, handleCY, handleR + 2, 0, Math.PI * 2)
            ctx!.stroke()

            ctx!.strokeStyle = '#DAA520'
            ctx!.lineWidth = 2.5
            ctx!.beginPath()
            ctx!.arc(handleCX, handleCY, handleR, 0, Math.PI * 2)
            ctx!.stroke()

            const spokeCount = 4
            ctx!.strokeStyle = '#DAA520'
            ctx!.lineWidth = 2
            const spoke = handleR * 0.8
            for (let s = 0; s < spokeCount; s++) {
                const a = dialAngle + (s / spokeCount) * Math.PI * 2
                ctx!.beginPath()
                ctx!.moveTo(handleCX, handleCY)
                ctx!.lineTo(handleCX + Math.cos(a) * spoke, handleCY + Math.sin(a) * spoke)
                ctx!.stroke()
            }

            ctx!.fillStyle = '#FFD700'
            ctx!.beginPath()
            ctx!.arc(handleCX, handleCY, 3, 0, Math.PI * 2)
            ctx!.fill()
        }

        function drawLockOnDoor(doorX: number, doorY: number, visibleW: number, doorH: number, locked: boolean) {
            const lockCX = doorX + visibleW / 2
            const lockY = doorY + doorH / 2 + 20
            ctx!.fillStyle = locked ? '#FF3333' : '#666'
            ctx!.beginPath()
            ctx!.roundRect(lockCX - 14, lockY, 28, 12, 2)
            ctx!.fill()
            ctx!.strokeStyle = '#C9A84C'
            ctx!.lineWidth = 1.5
            ctx!.beginPath()
            ctx!.roundRect(lockCX - 14, lockY, 28, 12, 2)
            ctx!.stroke()
        }

        function drawDollarStacks(openFrac: number) {
            const doorH = vaultH - 14
            const doorFullX = vaultX + 7
            const doorY = vaultY + 7

            const stackPositions = [
                { x: doorFullX + 10, y: doorY + doorH - 10, w: 22, h: 28 },
                { x: doorFullX + 28, y: doorY + doorH - 10, w: 22, h: 36 },
                { x: doorFullX + 46, y: doorY + doorH - 10, w: 22, h: 22 },
            ]
            const visibleStacks = Math.min(stackPositions.length, Math.floor(openFrac * 5))
            for (let s = 0; s < visibleStacks; s++) {
                const st = stackPositions[s]
                const billCount = Math.floor(st.h / 5)
                for (let b = 0; b < billCount; b++) {
                    const by = st.y - b * 5
                    const shade = b % 2 === 0 ? '#2E8B2E' : '#3AA63A'
                    ctx!.fillStyle = shade
                    ctx!.fillRect(st.x, by - 5, st.w, 5)
                    ctx!.strokeStyle = '#1F6B1F'
                    ctx!.lineWidth = 0.5
                    ctx!.strokeRect(st.x, by - 5, st.w, 5)
                    ctx!.fillStyle = '#CCEACC'
                    ctx!.font = 'bold 4px sans-serif'
                    ctx!.textAlign = 'center'
                    ctx!.textBaseline = 'middle'
                    ctx!.fillText('$', st.x + st.w / 2, by - 2.5)
                }
            }
        }

        function drawDoor(openFrac: number, dialAngle: number) {
            const doorW = vaultW - 14
            const doorH = vaultH - 14
            const doorFullX = vaultX + 7
            const doorY = vaultY + 7

            if (openFrac > 0.1) {
                const glowAlpha = Math.min(1, (openFrac - 0.1) / 0.3) * 0.35
                ctx!.globalAlpha = glowAlpha
                ctx!.fillStyle = '#22FF55'
                const glowW = doorW * openFrac * 0.5
                ctx!.fillRect(doorFullX, doorY + 3, glowW, doorH - 6)
                ctx!.globalAlpha = glowAlpha * 0.4
                ctx!.fillStyle = '#fff'
                ctx!.fillRect(doorFullX, doorY + 3, glowW * 0.4, doorH - 6)
                ctx!.globalAlpha = 1

                drawDollarStacks(openFrac)
            }

            const visibleW = doorW * (1 - openFrac * 0.8)
            const doorX = doorFullX + doorW - visibleW

            ctx!.fillStyle = '#5E5E72'
            ctx!.fillRect(doorX, doorY, visibleW, doorH)
            ctx!.fillStyle = '#6E6E82'
            ctx!.fillRect(doorX, doorY, visibleW, 2)
            ctx!.fillRect(doorX, doorY, 2, doorH)
            ctx!.fillStyle = '#4E4E62'
            ctx!.fillRect(doorX, doorY + doorH - 2, visibleW, 2)

            if (openFrac < 0.3 && visibleW > 40) {
                drawHandleOnDoor(doorX, doorY, visibleW, doorH, dialAngle)
                drawLockOnDoor(doorX, doorY, visibleW, doorH, openFrac < 0.05)
            }
        }

        function drawText(cycle: number, openFrac: number) {
            const textY = vaultY + vaultH + 24

            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '600 9px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'top'
            ctx!.fillText('VAULT SAFE', cx, textY)

            ctx!.fillStyle = '#fff'
            ctx!.font = '800 20px sans-serif'
            ctx!.fillText('$500,000 USDC', cx, textY + 18)

            if (openFrac < 0.05 && cycle > 140) {
                const securedAlpha = Math.min(1, (cycle - 140) / 30)
                ctx!.globalAlpha = securedAlpha
                ctx!.fillStyle = '#2CFF05'
                ctx!.font = '700 14px monospace'
                ctx!.fillText('✓ Secured', cx, textY + 50)

                ctx!.fillStyle = 'rgba(255,255,255,0.35)'
                ctx!.font = '500 10px sans-serif'
                ctx!.fillText('Funds locked on-chain', cx, textY + 72)
                ctx!.globalAlpha = 1
            } else if (openFrac > 0.3) {
                ctx!.fillStyle = '#FFD700'
                ctx!.font = '600 11px monospace'
                ctx!.fillText('Vault Open', cx, textY + 50)
            }
        }

        function animate() {
            frameRef.current++
            ctx!.clearRect(0, 0, W, H)

            const cycle = reduced ? 200 : (frameRef.current % 360)

            let openFrac = 0
            let dialAngle = 0

            if (cycle < 60) {
                openFrac = 0.7
                dialAngle = cycle * 0.15
            } else if (cycle < 100) {
                const t = (cycle - 60) / 40
                const e = 1 - Math.pow(1 - t, 3)
                dialAngle = cycle * 0.15 + e * Math.PI * 4
                openFrac = 0.7 * (1 - e)
            } else if (cycle < 140) {
                openFrac = 0
                const bounce = Math.sin((cycle - 100) * 0.5) * Math.exp(-(cycle - 100) * 0.08) * 0.02
                openFrac = Math.max(0, bounce)
                dialAngle = (cycle - 100) * 0.02 + Math.PI * 4
            } else if (cycle < 260) {
                openFrac = 0
                dialAngle = Math.PI * 4
            } else if (cycle < 320) {
                const t = (cycle - 260) / 60
                const e = 1 - Math.pow(1 - t, 2)
                openFrac = e * 0.7
                dialAngle = Math.PI * 4 - e * Math.PI * 4
            } else {
                openFrac = 0.7
                dialAngle = 0
            }

            drawVaultBody()
            drawDoor(openFrac, dialAngle)
            drawText(cycle, openFrac)

            if (reduced) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.cardCanvas} />
}

function HeroShowcase({ prefersReduced, activeScreen }: {
    prefersReduced: boolean | null
    activeScreen: number
}) {
    const reduced = !!prefersReduced

    const screens = [
        <VaultOverviewCanvas key="overview" active={activeScreen === 0} reduced={reduced} />,
        <LiveFundingCanvas key="funding" active={activeScreen === 1} reduced={reduced} />,
        <VaultSafeCanvas key="safe" active={activeScreen === 2} reduced={reduced} />,
    ]

    return (
        <div className={styles.showcaseCard}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeScreen}
                    className={styles.showcaseScreenWrap}
                    initial={reduced ? false : { opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, x: -30 }}
                    transition={{ duration: reduced ? 0 : 0.4, ease }}
                >
                    {screens[activeScreen]}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

export default function VaultsMarketing() {
    const navigate = useNavigate()
    const prefersReduced = useReducedMotion()
    const [card1Visible, setCard1Visible] = useState(false)
    const [_card2Visible, setCard2Visible] = useState(false)
    const [_card3Visible, setCard3Visible] = useState(false)
    const card1Ref = useRef<HTMLDivElement>(null)
    const card2Ref = useRef<HTMLDivElement>(null)
    const card3Ref = useRef<HTMLDivElement>(null)
    const [showcaseScreen, setShowcaseScreen] = useState(0)
    const [_keywordsVisible, setKeywordsVisible] = useState(false)
    const keywordsRef = useRef<HTMLDivElement>(null)
    const [activeKeyword, setActiveKeyword] = useState(0)
    const keywordItems = [
        { word: 'Waterfall' },
        { word: 'Tranches' },
        { word: 'Milestones' },
        { word: 'USDC' },
    ]

    const keywordDescriptions = [
        'Senior → Pool → Community. Priority-based repayment distribution ensures predictable returns across every risk tier.',
        '2–8 configurable tranches per vault. Milestone-gated capital release protects investors at every stage.',
        'Oracle-verified business milestones unlock each tranche. If milestones fail, remaining funds stay protected.',
        'All vaults denominated in USDC on Base L2. No volatile collateral — pure stablecoin yield.',
    ]

    // Scroll-linked keyword highlighting — listen on #root (the actual scroll container)
    useEffect(() => {
        const section = keywordsRef.current
        if (!section || prefersReduced) return
        const scroller = document.getElementById('root') ?? window
        const handleScroll = () => {
            const rect = section.getBoundingClientRect()
            const sectionHeight = section.offsetHeight
            const viewportTop = -rect.top
            const scrollableHeight = sectionHeight - window.innerHeight
            if (scrollableHeight <= 0) return
            const progress = Math.max(0, Math.min(1, viewportTop / scrollableHeight))
            const idx = Math.min(3, Math.floor(progress * 4))
            setActiveKeyword(idx)
        }
        scroller.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => scroller.removeEventListener('scroll', handleScroll)
    }, [prefersReduced])

    // Horizontal scroll pin for lifecycle section — GSAP ScrollTrigger
    const lifecycleRef = useRef<HTMLElement>(null)
    useEffect(() => {
        if (prefersReduced) return
        const section = lifecycleRef.current
        if (!section) return

        const rafId = requestAnimationFrame(() => {
            const scroller = document.getElementById('root') ?? undefined
            const track = section.querySelector('[data-anim="lifecycle-track"]') as HTMLElement
            if (!track) return
            const totalScroll = track.scrollWidth - section.clientWidth
            if (totalScroll <= 0) return

            const mm = gsap.matchMedia()
            mm.add('(min-width: 769px)', () => {
                gsap.to(track, {
                    x: -totalScroll,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: section,
                        scroller,
                        pin: true,
                        start: 'top top',
                        end: `+=${totalScroll}`,
                        scrub: 0.6,
                        anticipatePin: 1,
                    },
                })
            })
            ;(section as any).__gsapMM = mm
        })

        return () => {
            cancelAnimationFrame(rafId)
            const mm = (lifecycleRef.current as any)?.__gsapMM
            if (mm) mm.revert()
        }
    }, [prefersReduced])

    useEffect(() => {
        if (prefersReduced) return
        const interval = setInterval(() => {
            setShowcaseScreen(prev => (prev + 1) % 3)
        }, 4000)
        return () => clearInterval(interval)
    }, [prefersReduced])

    useEffect(() => {
        const observe = (ref: React.RefObject<HTMLDivElement | null>, setter: (v: boolean) => void) => {
            const node = ref.current
            if (!node) return
            const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setter(true); obs.disconnect() } }, { threshold: 0.3 })
            obs.observe(node)
            return () => obs.disconnect()
        }
        const c1 = observe(card1Ref, setCard1Visible)
        const c2 = observe(card2Ref, setCard2Visible)
        const c3 = observe(card3Ref, setCard3Visible)
        const kw = observe(keywordsRef, setKeywordsVisible)
        return () => { c1?.(); c2?.(); c3?.(); kw?.() }
    }, [])

    return (
        <div className={styles.page}>
            {/* ── Floating Orbs ─────────────────────────── */}
            {!prefersReduced && (
                <>
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 400, height: 400, top: '10%', left: '5%', background: 'rgba(44,255,5,0.12)', filter: 'blur(70px)' }}
                        animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
                        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 300, height: 300, top: '30%', right: '10%', background: 'rgba(44,255,5,0.10)', filter: 'blur(80px)' }}
                        animate={{ x: [0, -25, 20, 0], y: [0, 20, -30, 0] }}
                        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 250, height: 250, top: '60%', left: '20%', background: 'rgba(44,255,5,0.08)', filter: 'blur(60px)' }}
                        animate={{ x: [0, 20, -15, 0], y: [0, -20, 25, 0] }}
                        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 350, height: 350, bottom: '15%', right: '5%', background: 'rgba(44,255,5,0.15)', filter: 'blur(75px)' }}
                        animate={{ x: [0, -15, 25, 0], y: [0, 30, -10, 0] }}
                        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </>
            )}

            {/* ── Hero ──────────────────────────────────── */}
            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <div className={styles.heroLeft}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            transition={{ duration: 0.9, ease }}
                        >
                            <div className={styles.heroLabel}>Structured Credit Infrastructure</div>
                            <h1 className={styles.heroTitle}>Credit Vaults</h1>
                        </motion.div>
                        <motion.p
                            className={styles.heroSubtitle}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease, delay: 0.15 }}
                        >
                            Fund real businesses. Earn real yield. Every repayment enforced on-chain through waterfall smart contracts on Base.
                        </motion.p>
                        <motion.div
                            className={styles.heroStats}
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                        >
                            {[
                                { value: '$20M+', label: 'Total Value Locked' },
                                { value: '8–15%', label: 'APY Range' },
                                { value: '100%', label: 'On-Chain' },
                                { value: 'Base L2', label: 'Network' },
                            ].map(s => (
                                <motion.div key={s.label} className={styles.heroStat} variants={staggerChild}>
                                    <span className={styles.heroStatValue}>{s.value}</span>
                                    <span className={styles.heroStatLabel}>{s.label}</span>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>

                    <motion.div
                        className={styles.heroRight}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease, delay: 0.4 }}
                    >
                        <HeroShowcase prefersReduced={prefersReduced} activeScreen={showcaseScreen} />
                        <div className={styles.showcaseDesc}>
                            {showcaseScreen === 0 && 'Vault Overview — live funding progress'}
                            {showcaseScreen === 1 && 'Tranche Distribution — structured capital release'}
                            {showcaseScreen === 2 && 'Vault Security — smart contract enforcement'}
                        </div>
                        <div className={styles.showcasePagination}>
                            {[0, 1, 2].map(i => (
                                <button
                                    key={i}
                                    className={`${styles.paginationNum} ${showcaseScreen === i ? styles.paginationActive : ''}`}
                                    onClick={() => setShowcaseScreen(i)}
                                    style={{ fontSize: `${1.4 + i * 0.4}rem` }}
                                >
                                    0{i + 1}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Dark Keywords Section — Scroll-Locked ── */}
            <section className={styles.darkKeywords} ref={keywordsRef}>
                <div className={styles.darkKeywordsSticky}>
                    <div className={styles.darkKeywordsInner}>
                        <div className={styles.darkKeywordsLeft}>
                            <h2 className={styles.darkKeywordsTitle}>Structured credit, on-chain</h2>
                        </div>
                        <div className={styles.darkKeywordsRight}>
                            {keywordItems.map((kw, i) => (
                                <span
                                    key={kw.word}
                                    className={`${styles.darkKeyword} ${i === activeKeyword ? styles.darkKeywordActive : styles.darkKeywordInactive}`}
                                >
                                    {kw.word}
                                </span>
                            ))}
                            <p className={styles.darkKeywordsDesc} key={activeKeyword}>
                                {keywordDescriptions[activeKeyword]}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Lifecycle — Horizontal Scroll Cards ──── */}
            <section className={styles.stepsSection} id="vault-lifecycle" ref={lifecycleRef as React.RefObject<HTMLElement>}>
                <div className={styles.stepsHeader} style={{ padding: '0 24px 48px', textAlign: 'center' }}>
                    <div className={styles.featureLabel} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>The Lifecycle</div>
                    <h2 className={styles.stepsTitle}>How a vault works, step by step</h2>
                    <p className={styles.stepsSubtitle}>From creation to repayment — four stages, fully on-chain.</p>
                </div>
                <div data-anim="lifecycle-track" className={styles.lifecycleTrack}>
                    {[
                        { num: '01', badge: 'Vault Creation', title: 'Merchant creates vault', desc: 'Sets target amount, interest rate, duration, and number of tranches. Vault deploys as a smart contract on Base.', color: '#00FFF0', metric: '$375K Target', asset: 'USDC on Base L2' },
                        { num: '02', badge: 'Structured Funding', title: 'Investors fund tranches', desc: 'Senior pool, liquidity pools, and community investors contribute USDC. Each tier has different risk/return profiles.', color: '#FFD700', metric: '6 Tranches', asset: 'Multi-tier funding' },
                        { num: '03', badge: 'Capital Release', title: 'Milestones unlock capital', desc: 'Oracle verifies business milestones. Each approved milestone releases the next tranche to the merchant.', color: '#FF5C00', metric: '12.5% APY', asset: 'Milestone-gated' },
                        { num: '04', badge: 'Automated Repayment', title: 'Revenue repays the vault', desc: 'x402 payment splits auto-route repayment through the waterfall. Senior → Pool → Community priority.', color: '#FF2A55', metric: '100% On-Chain', asset: 'Smart contract enforced' },
                    ].map((step) => (
                        <div
                            key={step.num}
                            className={styles.lifecycleCard}
                            style={{ '--card-color': step.color } as React.CSSProperties}
                        >
                            <div className={styles.lifecycleCardTop}>
                                <span className={styles.lifecycleNum}>{step.num}</span>
                                <span className={styles.lifecycleBadge}>{step.badge}</span>
                                <h3 className={styles.lifecycleTitle}>{step.title}</h3>
                                <p className={styles.lifecycleDesc}>{step.desc}</p>
                            </div>
                            <div className={styles.lifecycleBottom}>
                                <div className={styles.lifecycleMetric}>{step.metric}</div>
                                <div className={styles.lifecycleAsset}>{step.asset}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Feature 1: Invest in Real Revenue ────── */}
            <section className={styles.featureSection} id="how-it-works">
                <div className={styles.featureInner}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>For Investors</div>
                        <h2 className={styles.featureTitle}>
                            Invest in Real Revenue
                        </h2>
                        <p className={styles.featureDesc}>
                            Each vault represents a structured credit facility for a verified business.
                            Capital is deployed in milestone-gated tranches — you invest in a business's
                            actual revenue stream, not speculative tokens. Repayment flows through an
                            on-chain waterfall where senior lenders always get paid first.
                        </p>
                        <motion.ul
                            className={styles.featureList}
                            variants={listContainer}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                        >
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Fixed-rate yields from 8–15% APY, backed by business cash flow</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Milestone-gated capital release — funds unlock only on verified progress</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Transparent on-chain repayments auditable on BaseScan</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Choose your risk tier — Senior, Pool, or Community tranche</motion.li>
                        </motion.ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <Card3DTilt>
                            <div ref={card1Ref} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <span>Vault Performance</span>
                                    <span className={styles.liveBadge}>
                                        <span className={styles.liveDot} /> Live
                                    </span>
                                </div>
                                <div className={styles.bigStat}>
                                    <span className={styles.statBig}>
                                        <Counter visible={card1Visible} end={12.5} suffix="%" decimals={1} />
                                    </span>
                                    <span className={styles.statLabel}>Average APY</span>
                                </div>
                                <div className={styles.statRow}>
                                    <div>
                                        <span className={styles.statSmallValue}>
                                            $<Counter visible={card1Visible} end={375000} prefix="" />
                                        </span>
                                        <span className={styles.statSmallLabel}>Total Raised</span>
                                    </div>
                                    <div>
                                        <span className={styles.statSmallValue}>
                                            <Counter visible={card1Visible} end={6} /> mo
                                        </span>
                                        <span className={styles.statSmallLabel}>Avg Duration</span>
                                    </div>
                                </div>
                                <div className={styles.divider} />
                                <div className={styles.statRow}>
                                    <div>
                                        <span className={styles.statSmallValue}>
                                            <Counter visible={card1Visible} end={25} />
                                        </span>
                                        <span className={styles.statSmallLabel}>Active Vaults</span>
                                    </div>
                                    <div>
                                        <span className={styles.statSmallValue}>
                                            <Counter visible={card1Visible} end={847} />
                                        </span>
                                        <span className={styles.statSmallLabel}>Repayments</span>
                                    </div>
                                </div>
                                <div className={styles.progressBar}>
                                    <motion.div
                                        className={styles.progressFill}
                                        initial={{ width: 0 }}
                                        whileInView={{ width: '72%' }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 1.2, ease, delay: 0.3 }}
                                    />
                                </div>
                                <div className={styles.progressMeta}>
                                    <span>72% funded</span>
                                    <span>$270K / $375K</span>
                                </div>
                            </div>
                        </Card3DTilt>
                    </motion.div>
                </div>
            </section>

            {/* ── Big Statement 2 ───────────────────────── */}
            <section className={styles.statement}>
                <motion.h2
                    className={styles.statementText}
                    initial={{ opacity: 0, y: 40, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.7, ease }}
                >
                    When revenue is programmable, repayment becomes automatic. No courts. No collection agencies. Just code.
                </motion.h2>
            </section>

            {/* ── Feature 2: Waterfall Repayment ─────── */}
            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Risk Management</div>
                        <h2 className={styles.featureTitle}>
                            Waterfall Repayment
                        </h2>
                        <p className={styles.featureDesc}>
                            Every vault enforces a strict repayment waterfall. When revenue flows in,
                            repayment cascades top-down — senior lenders are paid first, then liquidity pools,
                            then community investors. The merchant receives surplus only after all obligations are met.
                            No manual intervention — the smart contract handles everything.
                        </p>
                        <motion.ul
                            className={styles.featureList}
                            variants={listContainer}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                        >
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Senior tranche gets priority — lowest risk, reliable returns</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Automated on-chain distribution — no intermediaries</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Real-time waterfall tracking on every vault detail page</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Late fees calculated and enforced at the protocol layer</motion.li>
                        </motion.ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <Card3DTilt>
                            <div ref={card2Ref} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <span>Repayment Waterfall</span>
                                    <span className={styles.liveBadge}>
                                        <span className={styles.liveDot} /> Active
                                    </span>
                                </div>
                                <div className={styles.waterfallFlow}>
                                    {[
                                        { name: 'Senior Pool', amount: '$120,000', pct: '32%', color: '#2CFF05', width: 85 },
                                        { name: 'Liquidity Pool', amount: '$80,000', pct: '21%', color: '#00FFF0', width: 60 },
                                        { name: 'Community Investors', amount: '$175,000', pct: '47%', color: '#FF5C00', width: 45 },
                                    ].map((step, i) => (
                                        <motion.div
                                            key={step.name}
                                            className={styles.waterfallStep}
                                            initial={{ opacity: 0, x: -20 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.12 }}
                                        >
                                            <span className={styles.waterfallDot} style={{ background: step.color }} />
                                            <div style={{ flex: 1 }}>
                                                <div className={styles.waterfallInfo}>
                                                    <span className={styles.waterfallName}>{step.name}</span>
                                                    <div className={styles.waterfallRight}>
                                                        <span className={styles.waterfallPct}>{step.pct}</span>
                                                        <span className={styles.waterfallAmount}>{step.amount}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.waterfallBar}>
                                                    <motion.div
                                                        className={styles.waterfallBarFill}
                                                        style={{ background: step.color }}
                                                        initial={{ width: 0 }}
                                                        whileInView={{ width: `${step.width}%` }}
                                                        viewport={{ once: true }}
                                                        transition={{ duration: 1, ease, delay: 0.4 + i * 0.15 }}
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                                <div className={styles.divider} />
                                <div className={styles.waterfallTotal}>
                                    <span>Total Vault Size</span>
                                    <span className={styles.waterfallTotalVal}>$375,000</span>
                                </div>
                                <div className={styles.waterfallTotal}>
                                    <span>Repaid So Far</span>
                                    <span className={styles.waterfallTotalVal} style={{ color: '#2CFF05' }}>$218,400</span>
                                </div>
                            </div>
                        </Card3DTilt>
                    </motion.div>
                </div>
            </section>

            {/* ── Feature 3: Milestone-Gated Tranches ─── */}
            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div
                        className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Capital Safety</div>
                        <h2 className={styles.featureTitle}>
                            Milestone-Gated Tranches
                        </h2>
                        <p className={styles.featureDesc}>
                            Capital isn't released all at once. Each tranche is unlocked only
                            after the borrower hits verified milestones — confirmed by
                            an oracle. If milestones fail, remaining funds stay protected.
                            Loan terms range from 3–12 months with structured tranche schedules.
                        </p>
                        <motion.ul
                            className={styles.featureList}
                            variants={listContainer}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                        >
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Oracle-verified milestones before each release</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Partial release reduces counterparty risk</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Auto-cancel on missed deadlines — capital returned to investors</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Configurable: 2–8 tranches per vault</motion.li>
                        </motion.ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <Card3DTilt>
                            <div ref={card3Ref} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <span>Tranche Release Schedule</span>
                                </div>
                                <div className={styles.trancheList}>
                                    {[
                                        { idx: 'T1', amount: '$62,500', pct: 100, status: 'Released', approved: true, date: 'Jan 15' },
                                        { idx: 'T2', amount: '$62,500', pct: 100, status: 'Released', approved: true, date: 'Feb 28' },
                                        { idx: 'T3', amount: '$62,500', pct: 65, status: 'In Review', approved: false, date: 'Mar 15' },
                                        { idx: 'T4', amount: '$62,500', pct: 0, status: 'Pending', approved: false, date: 'Apr 30' },
                                        { idx: 'T5', amount: '$62,500', pct: 0, status: 'Locked', approved: false, date: 'Jun 15' },
                                        { idx: 'T6', amount: '$62,500', pct: 0, status: 'Locked', approved: false, date: 'Jul 31' },
                                    ].map((t, i) => (
                                        <motion.div
                                            key={t.idx}
                                            className={styles.trancheItem}
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.4, ease, delay: 0.15 + i * 0.06 }}
                                        >
                                            <span className={styles.trancheIndex}>{t.idx}</span>
                                            <div className={styles.trancheBar}>
                                                <motion.div
                                                    className={styles.trancheBarFill}
                                                    initial={{ width: 0 }}
                                                    whileInView={{ width: `${t.pct}%` }}
                                                    viewport={{ once: true }}
                                                    transition={{ duration: 1, ease, delay: 0.3 + i * 0.08 }}
                                                />
                                            </div>
                                            <span className={styles.trancheAmount}>{t.amount}</span>
                                            <span className={`${styles.trancheStatus} ${t.approved ? styles.trancheApproved : styles.tranchePending}`}>
                                                {t.status}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                                <div className={styles.divider} />
                                <div className={styles.waterfallTotal}>
                                    <span>Total Vault</span>
                                    <span className={styles.waterfallTotalVal}>$375,000</span>
                                </div>
                                <div className={styles.waterfallTotal}>
                                    <span>Released</span>
                                    <span className={styles.waterfallTotalVal} style={{ color: '#2CFF05' }}>$125,000 (33%)</span>
                                </div>
                            </div>
                        </Card3DTilt>
                    </motion.div>
                </div>
            </section>

            {/* ── CTA Footer ─────────────────────────── */}
            <section className={styles.ctaSection}>
                <motion.h2
                    className={styles.ctaTitle}
                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease }}
                >
                    Ready to earn yield from real revenue?
                </motion.h2>
                <motion.p
                    className={styles.ctaSubtitle}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease, delay: 0.1 }}
                >
                    Browse active vaults, pick your tranche, and start investing in minutes.
                </motion.p>
                <motion.div
                    className={styles.ctaActions}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease, delay: 0.2 }}
                >
                    <motion.button
                        className={styles.launchBtn}
                        onClick={() => navigate('/app/vaults')}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        Launch App <ArrowRight size={18} />
                    </motion.button>
                    <a
                        href="https://sepolia.basescan.org/address/0xf8fDa17F877dEFFCD80784E0465F33d585644360"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.secondaryBtn}
                    >
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
