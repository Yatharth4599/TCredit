import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion, AnimatePresence } from 'motion/react'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import styles from './PoolsMarketing.module.css'

const ease = [0.16, 1, 0.3, 1] as const

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

function TiltCard({ children, className, reducedMotion }: { children: React.ReactNode; className?: string; reducedMotion: boolean | null }) {
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const rotateXRaw = useTransform(y, [-0.5, 0.5], [7, -7])
    const rotateYRaw = useTransform(x, [-0.5, 0.5], [-7, 7])
    const rotateX = useSpring(rotateXRaw, { stiffness: 300, damping: 30 })
    const rotateY = useSpring(rotateYRaw, { stiffness: 300, damping: 30 })

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if (reducedMotion) return
        const rect = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - rect.left) / rect.width - 0.5)
        y.set((e.clientY - rect.top) / rect.height - 0.5)
    }

    function handleMouseLeave() {
        x.set(0)
        y.set(0)
    }

    if (reducedMotion) {
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

function DollarPoolCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const frameRef = useRef(0)
    const animRef = useRef<number>(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 400 * dpr
        canvas.height = 320 * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const W = 400
        const H = 320
        const cx = W / 2
        const CYCLE = 300

        const platCX = cx
        const platCY = H * 0.62

        interface Coin { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; alpha: number; size: number; symbol: string }
        const coins: Coin[] = []
        let spawnTimer = 0

        function drawTitle() {
            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '600 9px monospace'
            ctx!.textAlign = 'left'
            ctx!.textBaseline = 'top'
            ctx!.fillText('LIQUIDITY POOL', 16, 16)
            ctx!.fillStyle = 'rgba(255,42,85,0.6)'
            ctx!.font = '600 9px monospace'
            ctx!.textAlign = 'right'
            ctx!.fillText('LIVE', W - 16, 16)
        }

        function drawIsoRect(x: number, y: number, w: number, h: number, depth: number, faceColor: string, topColor: string, sideColor: string) {
            const hw = w / 2
            const hh = h / 2
            const isoX = 0.85
            const isoY = 0.5

            ctx!.fillStyle = faceColor
            ctx!.beginPath()
            ctx!.moveTo(x - hw * isoX, y - hh * isoY)
            ctx!.lineTo(x + hw * isoX, y - hh * isoY)
            ctx!.lineTo(x + hw * isoX, y - hh * isoY + depth)
            ctx!.lineTo(x - hw * isoX, y - hh * isoY + depth)
            ctx!.closePath()
            ctx!.fill()

            ctx!.fillStyle = topColor
            ctx!.beginPath()
            ctx!.moveTo(x - hw * isoX, y - hh * isoY)
            ctx!.lineTo(x, y - hh * isoY - h * 0.22)
            ctx!.lineTo(x + hw * isoX, y - hh * isoY)
            ctx!.lineTo(x, y - hh * isoY + h * 0.22)
            ctx!.closePath()
            ctx!.fill()

            ctx!.fillStyle = sideColor
            ctx!.beginPath()
            ctx!.moveTo(x + hw * isoX, y - hh * isoY)
            ctx!.lineTo(x + hw * isoX, y - hh * isoY + depth)
            ctx!.lineTo(x, y - hh * isoY + depth + h * 0.22)
            ctx!.lineTo(x, y - hh * isoY + h * 0.22)
            ctx!.closePath()
            ctx!.fill()
        }

        function drawPlatformStack(_frame: number) {
            const blockW = 130
            const blockH = 45
            const depth = 20
            const frontTop = blockH / 2 * 0.5
            const step = depth

            const y1 = platCY + 40
            const y2 = y1 - step
            const y3 = y2 - step

            drawIsoRect(platCX, y1, blockW, blockH, depth, '#2A2D35', '#33363E', '#222528')
            ctx!.fillStyle = '#FF2A55'
            for (let i = 0; i < 3; i++) {
                ctx!.beginPath()
                ctx!.arc(platCX - 22 + i * 22, y1 - frontTop + depth * 0.5, 2.5, 0, Math.PI * 2)
                ctx!.fill()
            }

            drawIsoRect(platCX, y2, blockW, blockH, depth, '#2F3239', '#383B44', '#272A30')
            ctx!.fillStyle = '#FF2A55'
            for (let i = 0; i < 3; i++) {
                ctx!.beginPath()
                ctx!.arc(platCX - 22 + i * 22, y2 - frontTop + depth * 0.5, 2.5, 0, Math.PI * 2)
                ctx!.fill()
            }

            drawIsoRect(platCX, y3, blockW, blockH, depth, '#343740', '#3E414A', '#2C2F36')

            const openTopY = y3 - frontTop - blockH * 0.22
            const topW = blockW * 0.85 / 2
            ctx!.save()
            const redGrad = ctx!.createLinearGradient(platCX, openTopY, platCX, openTopY - 60)
            redGrad.addColorStop(0, 'rgba(255,42,85,0.35)')
            redGrad.addColorStop(0.5, 'rgba(255,42,85,0.12)')
            redGrad.addColorStop(1, 'rgba(255,42,85,0)')
            ctx!.fillStyle = redGrad
            ctx!.beginPath()
            ctx!.moveTo(platCX - topW, openTopY)
            ctx!.lineTo(platCX, openTopY - blockH * 0.22)
            ctx!.lineTo(platCX + topW, openTopY)
            ctx!.lineTo(platCX + topW * 1.3, openTopY - 70)
            ctx!.lineTo(platCX - topW * 1.3, openTopY - 70)
            ctx!.closePath()
            ctx!.fill()
            ctx!.restore()
        }

        function spawnCoin() {
            const symbols = ['$', '$', '$', '$']
            const y3 = platCY + 40 - 20 - 20
            const frontTop = 45 / 2 * 0.5
            const openTopY = y3 - frontTop - 45 * 0.22
            coins.push({
                x: platCX + (Math.random() - 0.5) * 50,
                y: openTopY,
                vx: (Math.random() - 0.5) * 1.8,
                vy: -(1.5 + Math.random() * 2.5),
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.12,
                alpha: 1,
                size: 10 + Math.random() * 8,
                symbol: symbols[Math.floor(Math.random() * symbols.length)]
            })
        }

        function drawCoin(c: Coin) {
            ctx!.save()
            ctx!.translate(c.x, c.y)
            ctx!.rotate(c.rot)
            ctx!.globalAlpha = c.alpha

            ctx!.fillStyle = '#C0C0C8'
            ctx!.strokeStyle = '#9A9AA0'
            ctx!.lineWidth = 1.5
            ctx!.beginPath()
            ctx!.arc(0, 0, c.size, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.stroke()

            ctx!.fillStyle = '#6A6A72'
            ctx!.font = `bold ${Math.round(c.size * 0.8)}px sans-serif`
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'middle'
            ctx!.fillText(c.symbol, 0, 1)

            ctx!.globalAlpha = 1
            ctx!.restore()
        }

        function updateCoins() {
            for (let i = coins.length - 1; i >= 0; i--) {
                const c = coins[i]
                c.x += c.vx
                c.vy += 0.02
                c.y += c.vy
                c.rot += c.rotSpeed
                c.alpha -= 0.004
                if (c.alpha <= 0 || c.y < -30 || c.y > H + 20) {
                    coins.splice(i, 1)
                }
            }
        }

        function animate() {
            frameRef.current++
            const frame = frameRef.current
            ctx!.clearRect(0, 0, W, H)

            ctx!.fillStyle = '#0C0F14'
            ctx!.fillRect(0, 0, W, H)

            drawTitle()

            if (reduced) {
                drawPlatformStack(0)
                const staticCoins: Coin[] = [
                    { x: platCX - 25, y: platCY - 80, vx: 0, vy: 0, rot: 0.2, rotSpeed: 0, alpha: 0.9, size: 14, symbol: '$' },
                    { x: platCX + 15, y: platCY - 100, vx: 0, vy: 0, rot: -0.3, rotSpeed: 0, alpha: 0.85, size: 18, symbol: '$' },
                    { x: platCX + 40, y: platCY - 65, vx: 0, vy: 0, rot: 0.5, rotSpeed: 0, alpha: 0.7, size: 12, symbol: '$' },
                    { x: platCX - 10, y: platCY - 120, vx: 0, vy: 0, rot: -0.1, rotSpeed: 0, alpha: 0.8, size: 16, symbol: '$' },
                ]
                staticCoins.forEach(c => drawCoin(c))
                return
            }

            drawPlatformStack(frame)

            spawnTimer++
            if (spawnTimer >= 10 + Math.floor(Math.random() * 6)) {
                spawnCoin()
                spawnTimer = 0
            }

            updateCoins()
            coins.forEach(c => drawCoin(c))

            if (!active && frameRef.current % CYCLE === 0) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.heroCanvas} />
}

function YieldAccumulatorCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const frameRef = useRef(0)
    const animRef = useRef<number>(0)
    const progressRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 400 * dpr
        canvas.height = 320 * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const W = 400
        const H = 320
        const cx = W / 2
        const sparklinePoints: number[] = []
        for (let i = 0; i < 60; i++) {
            sparklinePoints.push(Math.sin(i * 0.15) * 8 + Math.sin(i * 0.07) * 12 + i * 0.4)
        }

        function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3) }

        function drawTitle() {
            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '600 9px monospace'
            ctx!.textAlign = 'left'
            ctx!.textBaseline = 'top'
            ctx!.fillText('YIELD ACCUMULATOR', 16, 16)
        }

        function drawYieldCounter(progress: number, frame: number) {
            const baseVal = 47.80
            const tick = reduced ? 0 : Math.sin(frame * 0.08) * 0.15 + Math.sin(frame * 0.13) * 0.08
            const val = (baseVal * progress + tick).toFixed(2)

            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 48px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'middle'
            ctx!.fillText(`$${val}`, cx, 90)

            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '11px sans-serif'
            ctx!.fillText('Yield Earned (USDC)', cx, 122)
        }

        function drawAPYBadge(progress: number) {
            if (progress < 0.2) return
            const alpha = Math.min(1, (progress - 0.2) / 0.3)
            ctx!.globalAlpha = alpha

            const badgeX = cx + 80
            const badgeY = 60
            ctx!.fillStyle = 'rgba(255,42,85,0.2)'
            ctx!.beginPath()
            ctx!.roundRect(badgeX - 30, badgeY - 10, 60, 20, 10)
            ctx!.fill()
            ctx!.fillStyle = '#FF6B8A'
            ctx!.font = 'bold 10px monospace'
            ctx!.textAlign = 'center'
            ctx!.fillText('7.2% APY', badgeX, badgeY + 1)

            ctx!.globalAlpha = 1
        }

        function drawSparkline(progress: number, frame: number) {
            const sparkY = 175
            const sparkH = 60
            const sparkX = 50
            const sparkW = W - 100
            const visibleCount = Math.floor(progress * sparklinePoints.length)

            if (visibleCount < 2) return

            const maxVal = Math.max(...sparklinePoints)
            const minVal = Math.min(...sparklinePoints)
            const range = maxVal - minVal || 1

            ctx!.strokeStyle = 'rgba(255,255,255,0.08)'
            ctx!.lineWidth = 0.5
            for (let i = 0; i < 4; i++) {
                const gy = sparkY + (sparkH / 3) * i
                ctx!.beginPath()
                ctx!.moveTo(sparkX, gy)
                ctx!.lineTo(sparkX + sparkW, gy)
                ctx!.stroke()
            }

            const grad = ctx!.createLinearGradient(sparkX, sparkY, sparkX + sparkW, sparkY)
            grad.addColorStop(0, '#FF2A55')
            grad.addColorStop(1, '#FF6B8A')
            ctx!.strokeStyle = grad
            ctx!.lineWidth = 2
            ctx!.lineJoin = 'round'
            ctx!.lineCap = 'round'
            ctx!.beginPath()
            for (let i = 0; i < visibleCount; i++) {
                const px = sparkX + (i / (sparklinePoints.length - 1)) * sparkW
                const py = sparkY + sparkH - ((sparklinePoints[i] - minVal) / range) * sparkH
                if (i === 0) ctx!.moveTo(px, py)
                else ctx!.lineTo(px, py)
            }
            ctx!.stroke()

            if (visibleCount > 0 && !reduced) {
                const lastIdx = visibleCount - 1
                const dotX = sparkX + (lastIdx / (sparklinePoints.length - 1)) * sparkW
                const dotY = sparkY + sparkH - ((sparklinePoints[lastIdx] - minVal) / range) * sparkH
                const pulse = Math.sin(frame * 0.06) * 2 + 4
                ctx!.fillStyle = 'rgba(255,42,85,0.3)'
                ctx!.beginPath()
                ctx!.arc(dotX, dotY, pulse, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.fillStyle = '#FF2A55'
                ctx!.beginPath()
                ctx!.arc(dotX, dotY, 3, 0, Math.PI * 2)
                ctx!.fill()
            }

            const fillGrad = ctx!.createLinearGradient(0, sparkY, 0, sparkY + sparkH)
            fillGrad.addColorStop(0, 'rgba(255,42,85,0.15)')
            fillGrad.addColorStop(1, 'rgba(255,42,85,0)')
            ctx!.fillStyle = fillGrad
            ctx!.beginPath()
            for (let i = 0; i < visibleCount; i++) {
                const px = sparkX + (i / (sparklinePoints.length - 1)) * sparkW
                const py = sparkY + sparkH - ((sparklinePoints[i] - minVal) / range) * sparkH
                if (i === 0) ctx!.moveTo(px, py)
                else ctx!.lineTo(px, py)
            }
            const lastX = sparkX + ((visibleCount - 1) / (sparklinePoints.length - 1)) * sparkW
            ctx!.lineTo(lastX, sparkY + sparkH)
            ctx!.lineTo(sparkX, sparkY + sparkH)
            ctx!.closePath()
            ctx!.fill()

            ctx!.fillStyle = 'rgba(255,255,255,0.3)'
            ctx!.font = '9px sans-serif'
            ctx!.textAlign = 'center'
            ctx!.fillText('Yield over time', cx, sparkY + sparkH + 18)
        }

        function drawStats(progress: number) {
            if (progress < 0.5) return
            const alpha = Math.min(1, (progress - 0.5) / 0.3)
            ctx!.globalAlpha = alpha

            const statsY = 278
            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '9px monospace'
            ctx!.textAlign = 'center'

            ctx!.fillText('DEPOSITED', cx - 100, statsY)
            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 12px monospace'
            ctx!.fillText('$5,000', cx - 100, statsY + 16)

            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '9px monospace'
            ctx!.fillText('DURATION', cx, statsY)
            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 12px monospace'
            ctx!.fillText('34 days', cx, statsY + 16)

            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '9px monospace'
            ctx!.fillText('NET APY', cx + 100, statsY)
            ctx!.fillStyle = '#22c55e'
            ctx!.font = 'bold 12px monospace'
            ctx!.fillText('7.2%', cx + 100, statsY + 16)

            ctx!.globalAlpha = 1
        }

        function animate() {
            frameRef.current++
            ctx!.clearRect(0, 0, W, H)

            ctx!.fillStyle = '#0C0F14'
            ctx!.beginPath()
            ctx!.roundRect(0, 0, W, H, 0)
            ctx!.fill()

            drawTitle()

            if (reduced) {
                progressRef.current = 1
            } else if (active) {
                progressRef.current = Math.min(progressRef.current + 0.006, 1)
            } else {
                progressRef.current = Math.max(progressRef.current - 0.03, 0)
            }

            const easedProgress = easeOutCubic(progressRef.current)
            drawYieldCounter(easedProgress, frameRef.current)
            drawAPYBadge(easedProgress)
            drawSparkline(easedProgress, frameRef.current)
            drawStats(easedProgress)

            if (reduced) return
            if (!active && progressRef.current <= 0) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.heroCanvas} />
}

function PoolVaultCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const frameRef = useRef(0)
    const animRef = useRef<number>(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 400 * dpr
        canvas.height = 320 * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const W = 400
        const H = 320
        const cx = W / 2
        const CYCLE = 300

        interface Coin { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; alpha: number; size: number }
        const coins: Coin[] = []

        function drawTitle() {
            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '600 9px monospace'
            ctx!.textAlign = 'left'
            ctx!.textBaseline = 'top'
            ctx!.fillText('POOL VAULT', 16, 16)
        }

        function drawSuitcase(lidOpenFrac: number) {
            const sW = 140
            const sH = 85
            const sX = cx - sW / 2
            const sBaseY = H - 75
            const sY = sBaseY - sH

            ctx!.fillStyle = 'rgba(255,255,255,0.05)'
            ctx!.beginPath()
            ctx!.ellipse(cx, sBaseY + 8, sW / 2 + 15, 10, 0, 0, Math.PI * 2)
            ctx!.fill()

            ctx!.fillStyle = '#E8E8EC'
            ctx!.beginPath()
            ctx!.roundRect(sX, sY, sW, sH, 6)
            ctx!.fill()
            ctx!.strokeStyle = '#C8C8CC'
            ctx!.lineWidth = 2
            ctx!.stroke()

            ctx!.fillStyle = '#D0D0D4'
            ctx!.fillRect(sX + 6, sY + sH * 0.48, sW - 12, 3)

            ctx!.strokeStyle = '#B0B0B4'
            ctx!.lineWidth = 3
            ctx!.beginPath()
            ctx!.moveTo(cx - 18, sY - 2)
            ctx!.lineTo(cx - 18, sY - 10)
            ctx!.bezierCurveTo(cx - 18, sY - 16, cx - 12, sY - 20, cx, sY - 20)
            ctx!.bezierCurveTo(cx + 12, sY - 16, cx + 18, sY - 16, cx + 18, sY - 10)
            ctx!.lineTo(cx + 18, sY - 2)
            ctx!.stroke()

            ctx!.fillStyle = '#A0A0A8'
            ctx!.beginPath()
            ctx!.roundRect(cx - 14, sY + sH * 0.35, 28, 18, 3)
            ctx!.fill()
            ctx!.fillStyle = '#808088'
            ctx!.beginPath()
            ctx!.roundRect(cx - 10, sY + sH * 0.38, 20, 12, 2)
            ctx!.fill()
            ctx!.fillStyle = '#606068'
            ctx!.beginPath()
            ctx!.arc(cx, sY + sH * 0.44 + 1, 2, 0, Math.PI * 2)
            ctx!.fill()

            ctx!.fillStyle = '#B8B8BC'
            ctx!.beginPath()
            ctx!.roundRect(sX + 12, sY + sH * 0.42, 10, 8, 2)
            ctx!.fill()
            ctx!.beginPath()
            ctx!.roundRect(sX + sW - 22, sY + sH * 0.42, 10, 8, 2)
            ctx!.fill()

            for (let i = 0; i < 3; i++) {
                const stX = sX + 25 + i * (sW - 50) / 2
                ctx!.strokeStyle = 'rgba(180,180,184,0.3)'
                ctx!.lineWidth = 0.8
                ctx!.beginPath()
                ctx!.moveTo(stX, sY + 6)
                ctx!.lineTo(stX, sY + sH - 6)
                ctx!.stroke()
            }

            ctx!.fillStyle = 'rgba(200,200,204,0.3)'
            ctx!.fillRect(sX + 4, sY + 4, sW - 8, 8)

            const lidLift = lidOpenFrac * 50

            if (lidLift > 2) {
                ctx!.fillStyle = '#2E8B57'
                const billCount = Math.min(5, Math.floor(lidOpenFrac * 5) + 1)
                for (let i = 0; i < billCount; i++) {
                    const bx = sX + 20 + i * 22
                    const by = sY - lidLift * 0.3 + 10
                    ctx!.fillStyle = i % 2 === 0 ? '#2E8B57' : '#3CB371'
                    ctx!.beginPath()
                    ctx!.roundRect(bx, by, 20, 10, 1)
                    ctx!.fill()
                    ctx!.strokeStyle = '#1B5E3B'
                    ctx!.lineWidth = 0.5
                    ctx!.stroke()
                }
            }

            const lidH = 20
            const lidY = sY - lidLift
            ctx!.fillStyle = '#E0E0E4'
            ctx!.beginPath()
            ctx!.roundRect(sX - 2, lidY, sW + 4, lidH, [6, 6, 0, 0])
            ctx!.fill()
            ctx!.strokeStyle = '#C8C8CC'
            ctx!.lineWidth = 2
            ctx!.stroke()

            ctx!.fillStyle = '#D0D0D4'
            ctx!.fillRect(sX + 6, lidY + 6, sW - 8, 2)

            ctx!.strokeStyle = '#B0B0B4'
            ctx!.lineWidth = 2
            ctx!.beginPath()
            ctx!.moveTo(cx - 16, lidY + lidH)
            ctx!.lineTo(cx - 16, lidY + lidH + 4)
            ctx!.stroke()
            ctx!.beginPath()
            ctx!.moveTo(cx + 16, lidY + lidH)
            ctx!.lineTo(cx + 16, lidY + lidH + 4)
            ctx!.stroke()
        }

        function spawnCoins(f: number) {
            if (f >= 120 && f <= 220 && f % 5 === 0) {
                coins.push({
                    x: cx + (Math.random() - 0.5) * 60,
                    y: H - 160,
                    vx: (Math.random() - 0.5) * 3,
                    vy: -(2 + Math.random() * 3),
                    rot: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.18,
                    alpha: 1,
                    size: 7 + Math.random() * 5
                })
            }
        }

        function drawCoins() {
            for (let i = coins.length - 1; i >= 0; i--) {
                const c = coins[i]
                c.x += c.vx
                c.vy += 0.04
                c.y += c.vy
                c.rot += c.rotSpeed

                if (c.y > H - 80) {
                    c.vy *= -0.2
                    c.y = H - 80
                    c.alpha -= 0.03
                }
                if (c.y < 25) { c.vy *= 0.3; c.alpha -= 0.01 }
                c.alpha -= 0.003
                if (c.alpha <= 0) { coins.splice(i, 1); continue }

                ctx!.save()
                ctx!.translate(c.x, c.y)
                ctx!.rotate(c.rot)
                ctx!.globalAlpha = c.alpha
                ctx!.fillStyle = '#DAA520'
                ctx!.beginPath()
                ctx!.arc(0, 0, c.size, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.strokeStyle = '#B8860B'
                ctx!.lineWidth = 1.5
                ctx!.stroke()
                ctx!.fillStyle = '#B8860B'
                ctx!.font = `bold ${Math.round(c.size * 0.9)}px monospace`
                ctx!.textAlign = 'center'
                ctx!.textBaseline = 'middle'
                ctx!.fillText('$', 0, 1)
                ctx!.globalAlpha = 1
                ctx!.restore()
            }
        }

        function animate() {
            frameRef.current++
            const f = frameRef.current % CYCLE
            ctx!.clearRect(0, 0, W, H)

            ctx!.fillStyle = '#0C0F14'
            ctx!.fillRect(0, 0, W, H)

            drawTitle()

            if (reduced) {
                drawSuitcase(0.6)
                for (let i = 0; i < 4; i++) {
                    ctx!.save()
                    ctx!.globalAlpha = 0.8
                    ctx!.fillStyle = '#DAA520'
                    const coinX = cx - 30 + i * 20
                    const coinY = H - 180 - i * 18
                    ctx!.beginPath()
                    ctx!.arc(coinX, coinY, 8, 0, Math.PI * 2)
                    ctx!.fill()
                    ctx!.strokeStyle = '#B8860B'
                    ctx!.lineWidth = 1.5
                    ctx!.stroke()
                    ctx!.fillStyle = '#B8860B'
                    ctx!.font = 'bold 8px monospace'
                    ctx!.textAlign = 'center'
                    ctx!.textBaseline = 'middle'
                    ctx!.fillText('$', coinX, coinY + 1)
                    ctx!.globalAlpha = 1
                    ctx!.restore()
                }
                return
            }

            let lidOpenFrac = 0
            if (f <= 60) {
                lidOpenFrac = 0
            } else if (f <= 120) {
                lidOpenFrac = (f - 60) / 60
            } else if (f <= 220) {
                lidOpenFrac = 1
            } else {
                lidOpenFrac = Math.max(0, 1 - (f - 220) / 80)
            }

            drawSuitcase(lidOpenFrac)
            spawnCoins(f)
            drawCoins()

            if (!active && f === 0) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.heroCanvas} />
}

function PoolsHeroShowcase({ prefersReduced, activeScreen }: {
    prefersReduced: boolean | null
    activeScreen: number
}) {
    const reduced = !!prefersReduced

    const screens = [
        <DollarPoolCanvas key="dollar-pool" active={activeScreen === 0} reduced={reduced} />,
        <YieldAccumulatorCanvas key="yield" active={activeScreen === 1} reduced={reduced} />,
        <PoolVaultCanvas key="vault" active={activeScreen === 2} reduced={reduced} />,
    ]

    return (
        <div className={styles.showcaseCardWrap}>
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
        </div>
    )
}

export default function PoolsMarketing() {
    const navigate = useNavigate()
    const [card1Visible, setCard1Visible] = useState(false)
    const card1Ref = useRef<HTMLDivElement>(null)
    const reducedMotion = useReducedMotion()
    const [showcaseScreen, setShowcaseScreen] = useState(0)
    
    const keywordsRef = useRef<HTMLDivElement>(null)
    const [activeKeyword, setActiveKeyword] = useState(0)

    const poolKeywordItems = [
        { word: 'Liquidity' },
        { word: 'Utilization' },
        { word: 'Yield' },
        { word: 'USDC' },
    ]

    const poolKeywordDescriptions = [
        'Capital pools that fill vault shortfalls — powering programmable credit at scale. Deposit once, earn continuously.',
        'Dynamic allocation across active vaults. Higher utilization means higher effective yield for every LP.',
        'Passive returns from real business lending. Senior pool gets priority; General pool earns more when everything works.',
        'All pool operations settle in USDC on Base L2. Deposits, withdrawals, and yield — near-instant, fully on-chain.',
    ]

    useEffect(() => {
        const node = card1Ref.current
        if (!node) return
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setCard1Visible(true); obs.disconnect() } }, { threshold: 0.3 })
        obs.observe(node)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        if (reducedMotion) return
        const interval = setInterval(() => {
            setShowcaseScreen(prev => (prev + 1) % 3)
        }, 4000)
        return () => clearInterval(interval)
    }, [reducedMotion])

    // Scroll-linked keyword highlighting — listen on #root (the actual scroll container)
    useEffect(() => {
        const section = keywordsRef.current
        if (!section || reducedMotion) return
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
    }, [reducedMotion])

    return (
        <div className={styles.page}>
            {/* ── Floating Orbs ──────────────────────── */}
            {!reducedMotion && (
                <>
                    <motion.div className={styles.floatingOrb}
                        style={{ width: 400, height: 400, top: '10%', left: '-5%', background: 'rgba(255,42,85,0.12)', filter: 'blur(70px)' }}
                        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
                        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
                    <motion.div className={styles.floatingOrb}
                        style={{ width: 350, height: 350, top: '50%', right: '-8%', background: 'rgba(255,107,138,0.10)', filter: 'blur(80px)' }}
                        animate={{ x: [0, -35, 25, 0], y: [0, 25, -35, 0] }}
                        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
                    <motion.div className={styles.floatingOrb}
                        style={{ width: 300, height: 300, bottom: '15%', left: '20%', background: 'rgba(255,42,85,0.10)', filter: 'blur(60px)' }}
                        animate={{ x: [0, 30, -15, 0], y: [0, -20, 30, 0] }}
                        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
                </>
            )}

            {/* ── Hero ──────────────────────────────── */}
            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <motion.div className={styles.heroLeft}
                        initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease, delay: 0.3 }}>
                        <PoolsHeroShowcase prefersReduced={reducedMotion} activeScreen={showcaseScreen} />
                        <div className={styles.showcaseDesc}>
                            {showcaseScreen === 0 && 'Liquidity Pool — capital flowing into vaults'}
                            {showcaseScreen === 1 && 'Yield Accumulator — passive returns over time'}
                            {showcaseScreen === 2 && 'Pool Vault — capital deployment in action'}
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

                    <motion.div className={styles.heroRight}
                        initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease }}>
                        <div className={styles.heroLabel}>Liquidity Infrastructure</div>
                        <h1 className={styles.heroTitle}>Liquidity Pools</h1>
                        <p className={styles.heroSubtitle}>
                            Capital pools that fill vault shortfalls — powering programmable credit at scale. Deposit USDC, earn passive yield from real business lending.
                        </p>
                        <div className={styles.heroStats}>
                            {[
                                { value: '$15M+', label: 'Pool Liquidity' },
                                { value: '67%', label: 'Utilization Rate' },
                                { value: '2 Tiers', label: 'Senior + General' },
                                { value: 'USDC', label: 'Settlement' },
                            ].map(s => (
                                <div key={s.label} className={styles.heroStat}>
                                    <span className={styles.heroStatValue}>{s.value}</span>
                                    <span className={styles.heroStatLabel}>{s.label}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Dark Keywords Section ─────────────── */}
            <section className={styles.darkKeywords} ref={keywordsRef}>
                <div className={styles.darkKeywordsSticky}>
                    <div className={styles.darkKeywordsInner}>
                        <div className={styles.darkKeywordsLeft}>
                            <h2 className={styles.darkKeywordsTitle}>Passive yield from real business lending</h2>
                        </div>
                        <div className={styles.darkKeywordsRight}>
                            {poolKeywordItems.map((kw, i) => (
                                <span
                                    key={kw.word}
                                    className={`${styles.darkKeyword} ${i === activeKeyword ? styles.darkKeywordActive : styles.darkKeywordInactive}`}
                                >
                                    {kw.word}
                                </span>
                            ))}
                            <p className={styles.darkKeywordsDesc} key={activeKeyword}>
                                {poolKeywordDescriptions[activeKeyword]}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Feature 1: Passive Yield ──────────── */}
            <section className={styles.featureSection} id="features">
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>For LPs</div>
                        <h2 className={styles.featureTitle}>Earn Passive Yield</h2>
                        <p className={styles.featureDesc}>
                            Deposit USDC into liquidity pools and earn yield as your capital is allocated to vetted credit vaults. The Senior Pool gets priority repayment with lower risk; the General Pool earns higher rates with more exposure. Choose your tier, deposit, and let the protocol work.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Deposit and withdraw USDC at any time</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Automated capital deployment to vetted vaults</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Senior Pool: priority repayment, lower risk</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> General Pool: higher yield, more exposure</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <TiltCard reducedMotion={reducedMotion}>
                            <div ref={card1Ref} className={styles.card}>

                                <div className={styles.cardHeader}>
                                    <span>Pool Metrics</span>
                                    <span className={styles.liveBadge}><span className={styles.liveDot} /> Live</span>
                                </div>
                                <div className={styles.bigStat}>
                                    <span className={styles.statBig}>$<Counter visible={card1Visible} end={15} decimals={1} suffix="M" /></span>
                                    <span className={styles.statLabel}>Total Pool Liquidity</span>
                                </div>
                                <div className={styles.statRow}>
                                    <div>
                                        <span className={styles.statSmallValue}>$<Counter visible={card1Visible} end={10} decimals={1} suffix="M" /></span>
                                        <span className={styles.statSmallLabel}>Deployed to Vaults</span>
                                    </div>
                                    <div>
                                        <span className={styles.statSmallValue}>$<Counter visible={card1Visible} end={5} decimals={1} suffix="M" /></span>
                                        <span className={styles.statSmallLabel}>Available</span>
                                    </div>
                                </div>
                                <div className={styles.divider} />
                                <div className={styles.statRow}>
                                    <div>
                                        <span className={styles.statSmallValue}><Counter visible={card1Visible} end={67.4} decimals={1} suffix="%" /></span>
                                        <span className={styles.statSmallLabel}>Utilization</span>
                                    </div>
                                    <div>
                                        <span className={styles.statSmallValue}><Counter visible={card1Visible} end={156} /></span>
                                        <span className={styles.statSmallLabel}>LP Positions</span>
                                    </div>
                                </div>
                            </div>
                        </TiltCard>
                    </motion.div>
                </div>
            </section>

            {/* ── Feature 2: Utilization ────────────── */}
            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Capital Efficiency</div>
                        <h2 className={styles.featureTitle}>Dynamic Utilization</h2>
                        <p className={styles.featureDesc}>
                            Pool capital is dynamically allocated to vaults that need funding. Track utilization in real time — when demand rises, so does your effective yield. The protocol balances deployment across active vaults to maximize capital efficiency while maintaining withdrawal liquidity.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Real-time utilization tracking on every pool</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Dynamic allocation engine manages vault deployment</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Yield scales with demand — higher util = higher returns</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Withdrawal buffer maintained for LP flexibility</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <TiltCard reducedMotion={reducedMotion}>
                            <div className={styles.card}>

                                <div className={styles.cardHeader}><span>Pool Utilization</span></div>
                                <div className={styles.gaugeWrap}>
                                    <div className={styles.gaugeCircle}>
                                        <span className={styles.gaugeValue}><AnimatedNumber value={67.4} decimals={1} />%</span>
                                        <svg className={styles.gaugeSvg} viewBox="0 0 120 120">
                                            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                                            <motion.circle cx="60" cy="60" r="52" fill="none" stroke="#FF6B8A" strokeWidth="8" strokeLinecap="round"
                                                strokeDasharray={2 * Math.PI * 52}
                                                initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                                                whileInView={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - 0.674) }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1.5, ease, delay: 0.3 }} />
                                        </svg>
                                    </div>
                                    <span className={styles.gaugeLabel}>Capital Utilization Rate</span>
                                </div>
                                <div className={styles.divider} />
                                <div className={styles.statRow}>
                                    <div>
                                        <span className={styles.statSmallValue}>Senior</span>
                                        <span className={styles.statSmallLabel}>72.1% utilized</span>
                                    </div>
                                    <div>
                                        <span className={styles.statSmallValue}>General</span>
                                        <span className={styles.statSmallLabel}>58.3% utilized</span>
                                    </div>
                                </div>
                            </div>
                        </TiltCard>
                    </motion.div>
                </div>
            </section>

            {/* ── Statement 2 ────────────────────────── */}
            <section className={styles.statement}>
                <motion.h2 className={styles.statementText}
                    initial={{ opacity: 0, y: 40, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7, ease }}>
                    Two pool tiers. One waterfall. Senior gets paid first — always. General earns more — when everything works.
                </motion.h2>
            </section>

            {/* ── Feature 3: Capital Flow ────────────── */}
            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Architecture</div>
                        <h2 className={styles.featureTitle}>How Capital Flows</h2>
                        <p className={styles.featureDesc}>
                            LPs deposit into pools. Pools allocate to vaults. Vaults disburse to merchants through milestone-gated tranches. Merchants repay through x402 payment splits. Your capital is always working — and always protected by the repayment priority waterfall.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> LP → Pool → Vault → Merchant → Repayment</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Waterfall-protected returns at every stage</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Fully on-chain lifecycle from deposit to withdrawal</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <TiltCard reducedMotion={reducedMotion}>
                            <div className={styles.card}>

                                <div className={styles.cardHeader}><span>Capital Flow</span></div>
                                <div className={styles.flowSteps}>
                                    {[
                                        { label: '01', name: 'LP deposits USDC into pool', desc: 'Capital enters Senior or General pool', color: '#FF6B8A' },
                                        { label: '02', name: 'Pool allocates to active vault', desc: 'Capital deployed to vetted credit facility', color: '#FF2A55' },
                                        { label: '03', name: 'Vault disburses to merchant', desc: 'Milestone-gated tranche release', color: '#CC2244' },
                                        { label: '04', name: 'x402 payments auto-repay', desc: 'Revenue splits route repayment on-chain', color: '#992233' },
                                        { label: '05', name: 'Waterfall distributes yield', desc: 'Senior → Pool → Community → Merchant', color: '#661122' },
                                    ].map((step, i) => (
                                        <motion.div key={step.label} className={styles.flowStep}
                                            initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                            transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.1 }}>
                                            <div className={styles.flowIcon} style={{ background: step.color }}>{step.label}</div>
                                            <div className={styles.flowInfo}>
                                                <div className={styles.flowName}>{step.name}</div>
                                                <div className={styles.flowDesc}>{step.desc}</div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </TiltCard>
                    </motion.div>
                </div>
            </section>

            {/* ── CTA Footer ─────────────────────── */}
            <section className={styles.ctaSection}>
                <motion.h2 className={styles.ctaTitle}
                    initial={{ opacity: 0, y: 30, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
                    Put your capital to work.
                </motion.h2>
                <motion.p className={styles.ctaSubtitle}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.1 }}>
                    Deposit into a pool and start earning passive yield from real credit facilities.
                </motion.p>
                <motion.div className={styles.ctaActions}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.2 }}>
                    <motion.button className={styles.launchBtn} onClick={() => navigate('/waitlist')} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.97 }}>Launch App <ArrowRight size={18} /></motion.button>
                    <a href="https://sepolia.basescan.org/address/0xDf980d0734b00888e4Ac350027515B4D6E473bBa" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
