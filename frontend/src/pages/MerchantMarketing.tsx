import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion, AnimatePresence } from 'motion/react'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import styles from './MerchantMarketing.module.css'

const ease = [0.16, 1, 0.3, 1] as const

const heroScreenData = [
    {
        title: 'Build your credit score',
        desc: 'FairScale scores your on-chain payment history from 0–1000 across four tiers.',
    },
    {
        title: 'Access structured credit',
        desc: 'Approved merchants create vaults with custom terms — no collateral, no banks.',
    },
    {
        title: 'Process payments instantly',
        desc: 'Oracle-signed x402 settlements on Base L2 in under 2 seconds.',
    },
]

const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
}

const listContainerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } }
}


function Card3DTilt({ children, className }: { children: React.ReactNode; className?: string }) {
    const prefersReduced = useReducedMotion()
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), { stiffness: 300, damping: 30 })
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), { stiffness: 300, damping: 30 })

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if (prefersReduced) return
        const rect = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - rect.left) / rect.width - 0.5)
        y.set((e.clientY - rect.top) / rect.height - 0.5)
    }

    function handleMouseLeave() {
        x.set(0)
        y.set(0)
    }

    if (prefersReduced) {
        return <div className={className}>{children}</div>
    }

    return (
        <motion.div
            className={className}
            style={{ rotateX, rotateY, transformPerspective: 800 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {children}
        </motion.div>
    )
}

function FairScaleCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const progressRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 440 * dpr
        canvas.height = 340 * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const W = 440
        const H = 340
        const cx = W / 2
        const gaugeY = 160
        const gaugeR = 100
        const targetScore = 742
        const maxScore = 1000
        const tickCount = 20

        function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4) }

        function lerpColor(a: string, b: string, t: number): string {
            const ah = parseInt(a.slice(1), 16)
            const bh = parseInt(b.slice(1), 16)
            const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff
            const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff
            const rr = Math.round(ar + (br - ar) * t)
            const rg = Math.round(ag + (bg - ag) * t)
            const rb = Math.round(ab + (bb - ab) * t)
            return `rgb(${rr},${rg},${rb})`
        }

        function drawFrame() {
            ctx!.clearRect(0, 0, W, H)

            const p = progressRef.current
            const easedP = easeOutQuart(p)
            const currentScore = Math.round(easedP * targetScore)
            const scoreFrac = currentScore / maxScore
            const startAngle = Math.PI
            const endAngle = Math.PI + scoreFrac * Math.PI

            ctx!.strokeStyle = 'rgba(255,255,255,0.06)'
            ctx!.lineWidth = 14
            ctx!.lineCap = 'round'
            ctx!.beginPath()
            ctx!.arc(cx, gaugeY, gaugeR, Math.PI, 2 * Math.PI)
            ctx!.stroke()

            for (let i = 0; i < tickCount; i++) {
                const angle = Math.PI + (i / (tickCount - 1)) * Math.PI
                const innerR = gaugeR - 22
                const outerR = gaugeR - 18
                const tx1 = cx + Math.cos(angle) * innerR
                const ty1 = gaugeY + Math.sin(angle) * innerR
                const tx2 = cx + Math.cos(angle) * outerR
                const ty2 = gaugeY + Math.sin(angle) * outerR
                ctx!.strokeStyle = 'rgba(255,255,255,0.1)'
                ctx!.lineWidth = 1.5
                ctx!.lineCap = 'round'
                ctx!.beginPath()
                ctx!.moveTo(tx1, ty1)
                ctx!.lineTo(tx2, ty2)
                ctx!.stroke()
            }

            if (scoreFrac > 0) {
                const colorStops = [
                    { pos: 0, color: '#FF3B30' },
                    { pos: 0.25, color: '#FF6B30' },
                    { pos: 0.45, color: '#FF9500' },
                    { pos: 0.6, color: '#FFCC00' },
                    { pos: 0.75, color: '#34C759' },
                    { pos: 1.0, color: '#2CFF05' },
                ]
                const segments = 80
                const totalArc = endAngle - startAngle
                for (let i = 0; i < segments; i++) {
                    const t = i / segments
                    const a1 = startAngle + t * totalArc
                    const a2 = startAngle + ((i + 1) / segments) * totalArc

                    let color = colorStops[0].color
                    for (let c = 0; c < colorStops.length - 1; c++) {
                        if (t >= colorStops[c].pos && t <= colorStops[c + 1].pos) {
                            const ct = (t - colorStops[c].pos) / (colorStops[c + 1].pos - colorStops[c].pos)
                            color = lerpColor(colorStops[c].color, colorStops[c + 1].color, ct)
                            break
                        }
                    }

                    ctx!.strokeStyle = color
                    ctx!.lineWidth = 14
                    ctx!.lineCap = 'round'
                    ctx!.beginPath()
                    ctx!.arc(cx, gaugeY, gaugeR, a1, a2 + 0.01)
                    ctx!.stroke()
                }
            }

            const needleAngle = startAngle + scoreFrac * Math.PI
            const needleLen = gaugeR - 26
            const nx = cx + Math.cos(needleAngle) * needleLen
            const ny = gaugeY + Math.sin(needleAngle) * needleLen
            ctx!.strokeStyle = '#fff'
            ctx!.lineWidth = 2.5
            ctx!.lineCap = 'round'
            ctx!.beginPath()
            ctx!.moveTo(cx, gaugeY)
            ctx!.lineTo(nx, ny)
            ctx!.stroke()
            ctx!.fillStyle = '#fff'
            ctx!.beginPath()
            ctx!.arc(cx, gaugeY, 5, 0, Math.PI * 2)
            ctx!.fill()

            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 46px sans-serif'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'middle'
            ctx!.fillText(String(currentScore), cx, gaugeY - 30)

            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '11px monospace'
            ctx!.fillText('/ 1,000', cx, gaugeY - 2)

            const labelAlpha = p >= 1 ? 1 : Math.max(0, (p - 0.85) / 0.15)
            if (labelAlpha > 0) {
                ctx!.globalAlpha = labelAlpha
                const badgeText = 'Good Standing'
                ctx!.font = 'bold 12px sans-serif'
                const tw = ctx!.measureText(badgeText).width
                const bx = cx - tw / 2 - 14
                const by = gaugeY + 50
                ctx!.fillStyle = 'rgba(52,199,89,0.15)'
                ctx!.beginPath()
                ctx!.roundRect(bx, by, tw + 28, 26, 0)
                ctx!.fill()
                ctx!.fillStyle = '#1a8c00'
                ctx!.textBaseline = 'middle'
                ctx!.fillText(badgeText, cx, by + 13)
                ctx!.globalAlpha = 1
            }

            ctx!.fillStyle = 'rgba(255,255,255,0.3)'
            ctx!.font = '9px monospace'
            ctx!.textBaseline = 'top'
            ctx!.textAlign = 'left'
            ctx!.fillText('0', cx - gaugeR - 4, gaugeY + 14)
            ctx!.textAlign = 'right'
            ctx!.fillText('1000', cx + gaugeR + 4, gaugeY + 14)
            ctx!.textAlign = 'center'

            ctx!.fillStyle = 'rgba(255,255,255,0.4)'
            ctx!.font = '10px monospace'
            ctx!.fillText('FAIRSCALE SCORE', cx, 30)
        }

        function animate() {
            if (reduced) {
                progressRef.current = 1
                drawFrame()
                return
            }
            if (active) {
                progressRef.current = Math.min(progressRef.current + 0.006, 1)
            } else {
                progressRef.current = Math.max(progressRef.current - 0.04, 0)
            }
            drawFrame()
            if (!active && progressRef.current <= 0) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.cardCanvas} />
}

function MerchantRegisterCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const frameRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 440 * dpr
        canvas.height = 340 * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const W = 440
        const H = 340
        const cx = W / 2
        const CYCLE = 300

        interface Coin {
            x: number
            y: number
            vx: number
            vy: number
            r: number
            alpha: number
        }

        const coins: Coin[] = []

        function spawnCoins() {
            coins.length = 0
            for (let i = 0; i < 8; i++) {
                coins.push({
                    x: cx - 30 + Math.random() * 60,
                    y: 190,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -(3 + Math.random() * 4),
                    r: 6 + Math.random() * 4,
                    alpha: 1,
                })
            }
        }

        function drawFrame() {
            ctx!.fillStyle = '#111'
            ctx!.fillRect(0, 0, W, H)

            const frame = frameRef.current
            const f = frame % CYCLE

            ctx!.fillStyle = 'rgba(255,92,0,0.25)'
            ctx!.font = '10px monospace'
            ctx!.textAlign = 'left'
            ctx!.textBaseline = 'top'
            ctx!.fillText('MERCHANT TERMINAL', 16, 16)

            const regX = cx - 70
            const regY = 110
            const regW = 140
            const regH = 120

            ctx!.fillStyle = '#4A4A52'
            ctx!.beginPath()
            ctx!.roundRect(regX, regY, regW, regH, 6)
            ctx!.fill()

            ctx!.fillStyle = '#3A3A42'
            ctx!.beginPath()
            ctx!.roundRect(regX, regY, regW, 10, [6, 6, 0, 0])
            ctx!.fill()

            const screenX = regX + 15
            const screenY = regY + 18
            const screenW = regW - 30
            const screenH = 28
            ctx!.fillStyle = '#1a1a22'
            ctx!.beginPath()
            ctx!.roundRect(screenX, screenY, screenW, screenH, 3)
            ctx!.fill()

            let displayText = '$0.00'
            if (f >= 60 && f < 120) {
                const countP = Math.min((f - 60) / 60, 1)
                const val = Math.round(countP * 125000)
                displayText = '$' + val.toLocaleString()
            } else if (f >= 120) {
                displayText = '$125,000'
            }

            ctx!.fillStyle = '#22FF55'
            ctx!.font = 'bold 14px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'middle'
            ctx!.fillText(displayText, cx, screenY + screenH / 2)

            const btnStartY = regY + 55
            const btnRows = 3
            const btnCols = 4
            const btnW = 18
            const btnH = 10
            const btnGapX = 6
            const btnGapY = 5
            const totalBtnW = btnCols * btnW + (btnCols - 1) * btnGapX
            const btnOffsetX = regX + (regW - totalBtnW) / 2

            for (let r = 0; r < btnRows; r++) {
                for (let c = 0; c < btnCols; c++) {
                    const btnIdx = r * btnCols + c
                    const bx = btnOffsetX + c * (btnW + btnGapX)
                    const by = btnStartY + r * (btnH + btnGapY)

                    let btnColor = '#5A5A62'
                    if (f >= 60 && f < 120) {
                        const lightIdx = Math.floor((f - 60) / 5) % (btnRows * btnCols)
                        if (btnIdx === lightIdx) {
                            btnColor = '#FF5C00'
                        }
                    }

                    ctx!.fillStyle = btnColor
                    ctx!.beginPath()
                    ctx!.roundRect(bx, by, btnW, btnH, 2)
                    ctx!.fill()
                }
            }

            let drawerSlide = 0
            if (f >= 120 && f < 180) {
                drawerSlide = Math.min((f - 120) / 40, 1) * 35
            } else if (f >= 180 && f < 240) {
                drawerSlide = 35
            } else if (f >= 240 && f < 300) {
                drawerSlide = 35 * Math.max(0, 1 - (f - 240) / 40)
            }

            const drawerY = regY + regH + drawerSlide
            const drawerH = 18
            ctx!.fillStyle = '#5A5A62'
            ctx!.beginPath()
            ctx!.roundRect(regX + 5, drawerY, regW - 10, drawerH, [0, 0, 4, 4])
            ctx!.fill()

            if (drawerSlide > 5) {
                ctx!.fillStyle = '#3D8B37'
                const billCount = 4
                const billW = 22
                const billH = 10
                const billGap = 6
                const totalBillW = billCount * billW + (billCount - 1) * billGap
                const billStartX = regX + (regW - totalBillW) / 2
                for (let i = 0; i < billCount; i++) {
                    const bx = billStartX + i * (billW + billGap)
                    const by = drawerY + 4
                    ctx!.fillRect(bx, by, billW, billH)
                    ctx!.fillStyle = '#2D6B27'
                    ctx!.font = 'bold 7px sans-serif'
                    ctx!.textAlign = 'center'
                    ctx!.textBaseline = 'middle'
                    ctx!.fillText('$', bx + billW / 2, by + billH / 2)
                    ctx!.fillStyle = '#3D8B37'
                }
            }

            ctx!.strokeStyle = '#FF5C00'
            ctx!.lineWidth = 1.5
            ctx!.beginPath()
            ctx!.roundRect(regX - 1, regY - 1, regW + 2, regH + 2, 7)
            ctx!.stroke()

            if (f === 180) {
                spawnCoins()
            }

            if (f >= 180 && f < 260) {
                for (const coin of coins) {
                    coin.x += coin.vx
                    coin.vy += 0.12
                    coin.y += coin.vy
                    if (coin.y > H) coin.alpha = 0
                    coin.alpha = Math.max(0, coin.alpha - 0.005)

                    if (coin.alpha > 0) {
                        ctx!.globalAlpha = coin.alpha
                        const grad = ctx!.createRadialGradient(coin.x, coin.y, 0, coin.x, coin.y, coin.r)
                        grad.addColorStop(0, '#FFD700')
                        grad.addColorStop(1, '#DAA520')
                        ctx!.fillStyle = grad
                        ctx!.beginPath()
                        ctx!.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2)
                        ctx!.fill()

                        ctx!.fillStyle = '#B8860B'
                        ctx!.font = `bold ${Math.round(coin.r)}px sans-serif`
                        ctx!.textAlign = 'center'
                        ctx!.textBaseline = 'middle'
                        ctx!.fillText('$', coin.x, coin.y)
                        ctx!.globalAlpha = 1
                    }
                }
            }

            const glowAlpha = f >= 120 && f < 240 ? 0.15 + Math.sin(f * 0.1) * 0.08 : 0
            if (glowAlpha > 0) {
                ctx!.globalAlpha = glowAlpha
                const glow = ctx!.createRadialGradient(cx, regY + regH / 2, 0, cx, regY + regH / 2, 120)
                glow.addColorStop(0, '#FF5C00')
                glow.addColorStop(1, 'transparent')
                ctx!.fillStyle = glow
                ctx!.fillRect(regX - 40, regY - 40, regW + 80, regH + 80)
                ctx!.globalAlpha = 1
            }
        }

        function animate() {
            if (reduced) {
                frameRef.current = 150
                drawFrame()
                return
            }
            if (active) {
                frameRef.current++
            }
            drawFrame()
            if (!active) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.cardCanvas} />
}

function CreditCardCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const progressRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 440 * dpr
        canvas.height = 340 * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const W = 440
        const H = 340
        const cx = W / 2
        const cy = H / 2 - 10

        const cardW = 280
        const cardH = 175
        const cardX = cx - cardW / 2
        const cardY = cy - cardH / 2

        interface Pixel {
            targetX: number
            targetY: number
            startX: number
            startY: number
            delay: number
        }

        const pixels: Pixel[] = []
        const step = 6
        for (let x = cardX; x < cardX + cardW; x += step) {
            for (let y = cardY; y < cardY + cardH; y += step) {
                const edge = x < cardX + step * 2 || x > cardX + cardW - step * 2 ||
                    y < cardY + step * 2 || y > cardY + cardH - step * 2
                if (edge || Math.random() < 0.15) {
                    const angle = Math.random() * Math.PI * 2
                    const dist = 100 + Math.random() * 200
                    pixels.push({
                        targetX: x,
                        targetY: y,
                        startX: cx + Math.cos(angle) * dist,
                        startY: cy + Math.sin(angle) * dist,
                        delay: Math.random() * 0.3,
                    })
                }
            }
        }

        function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4) }

        function drawFrame() {
            ctx!.fillStyle = '#111'
            ctx!.fillRect(0, 0, W, H)

            const p = progressRef.current
            const assembleP = Math.min(p / 0.3, 1)
            const fillP = Math.max(0, Math.min((p - 0.25) / 0.15, 1))
            const nameP = Math.max(0, Math.min((p - 0.4) / 0.12, 1))
            const limitP = Math.max(0, Math.min((p - 0.52) / 0.1, 1))
            const shimmerP = Math.max(0, Math.min((p - 0.65) / 0.15, 1))
            const stampP = Math.max(0, Math.min((p - 0.8) / 0.2, 1))

            if (assembleP < 1) {
                for (const px of pixels) {
                    const t = Math.max(0, Math.min((assembleP - px.delay) / (1 - px.delay), 1))
                    const et = easeOutQuart(t)
                    const x = px.startX + (px.targetX - px.startX) * et
                    const y = px.startY + (px.targetY - px.startY) * et
                    ctx!.globalAlpha = t * 0.8
                    ctx!.fillStyle = '#FF5C00'
                    ctx!.fillRect(x, y, step - 1, step - 1)
                }
                ctx!.globalAlpha = 1
            }

            if (fillP > 0) {
                const grad = ctx!.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH)
                grad.addColorStop(0, '#FF5C00')
                grad.addColorStop(0.5, '#FF8533')
                grad.addColorStop(1, '#CC4A00')
                ctx!.globalAlpha = easeOutQuart(fillP)
                ctx!.fillStyle = grad
                ctx!.beginPath()
                ctx!.roundRect(cardX, cardY, cardW, cardH, 0)
                ctx!.fill()

                ctx!.strokeStyle = 'rgba(255,255,255,0.15)'
                ctx!.lineWidth = 1
                ctx!.beginPath()
                ctx!.roundRect(cardX, cardY, cardW, cardH, 0)
                ctx!.stroke()

                ctx!.fillStyle = 'rgba(255,255,255,0.08)'
                ctx!.beginPath()
                ctx!.arc(cardX + cardW - 30, cardY + 30, 18, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.beginPath()
                ctx!.arc(cardX + cardW - 44, cardY + 30, 18, 0, Math.PI * 2)
                ctx!.fill()

                ctx!.fillStyle = 'rgba(255,255,255,0.12)'
                ctx!.beginPath()
                ctx!.roundRect(cardX + 20, cardY + 55, 36, 26, 0)
                ctx!.fill()
                ctx!.strokeStyle = 'rgba(255,255,255,0.2)'
                ctx!.lineWidth = 1
                ctx!.beginPath()
                ctx!.roundRect(cardX + 20, cardY + 55, 36, 26, 0)
                ctx!.stroke()

                ctx!.globalAlpha = 1
            }

            if (nameP > 0) {
                const fullName = 'ATLAS LOGISTICS'
                const visibleLen = Math.ceil(nameP * fullName.length)
                const visibleName = fullName.substring(0, visibleLen)
                ctx!.globalAlpha = easeOutQuart(Math.min(nameP * 2, 1))
                ctx!.fillStyle = 'rgba(255,255,255,0.85)'
                ctx!.font = 'bold 13px monospace'
                ctx!.textAlign = 'left'
                ctx!.textBaseline = 'middle'
                ctx!.fillText(visibleName, cardX + 20, cardY + cardH - 30)
                ctx!.globalAlpha = 1
            }

            if (limitP > 0) {
                const scale = 0.5 + easeOutQuart(limitP) * 0.5
                ctx!.globalAlpha = easeOutQuart(limitP)
                ctx!.save()
                ctx!.translate(cardX + cardW - 20, cardY + cardH - 30)
                ctx!.scale(scale, scale)
                ctx!.fillStyle = '#fff'
                ctx!.font = 'bold 18px monospace'
                ctx!.textAlign = 'right'
                ctx!.textBaseline = 'middle'
                ctx!.fillText('$50,000', 0, 0)
                ctx!.restore()
                ctx!.globalAlpha = 1
            }

            if (shimmerP > 0 && shimmerP < 1) {
                const shimmerX = cardX - 80 + (cardW + 160) * shimmerP
                const grad = ctx!.createLinearGradient(shimmerX - 40, 0, shimmerX + 40, 0)
                grad.addColorStop(0, 'rgba(255,255,255,0)')
                grad.addColorStop(0.5, 'rgba(255,255,255,0.2)')
                grad.addColorStop(1, 'rgba(255,255,255,0)')
                ctx!.fillStyle = grad
                ctx!.save()
                ctx!.beginPath()
                ctx!.roundRect(cardX, cardY, cardW, cardH, 0)
                ctx!.clip()
                ctx!.fillRect(shimmerX - 40, cardY, 80, cardH)
                ctx!.restore()
            }

            if (stampP > 0) {
                const stampScale = stampP < 0.3 ? 1.5 - easeOutQuart(stampP / 0.3) * 0.5 : 1
                const stampAlpha = Math.min(stampP * 3, 1)
                ctx!.globalAlpha = stampAlpha
                ctx!.save()
                ctx!.translate(cx, cy + cardH / 2 + 35)
                ctx!.scale(stampScale, stampScale)
                ctx!.fillStyle = 'rgba(52,199,89,0.15)'
                ctx!.beginPath()
                ctx!.roundRect(-55, -14, 110, 28, 0)
                ctx!.fill()
                ctx!.strokeStyle = '#34C759'
                ctx!.lineWidth = 1.5
                ctx!.beginPath()
                ctx!.roundRect(-55, -14, 110, 28, 0)
                ctx!.stroke()
                ctx!.fillStyle = '#34C759'
                ctx!.font = 'bold 12px monospace'
                ctx!.textAlign = 'center'
                ctx!.textBaseline = 'middle'
                ctx!.fillText('APPROVED', 0, 0)
                ctx!.restore()
                ctx!.globalAlpha = 1
            }
        }

        function animate() {
            if (reduced) {
                progressRef.current = 1
                drawFrame()
                return
            }
            if (active) {
                progressRef.current = Math.min(progressRef.current + 0.005, 1)
            } else {
                progressRef.current = Math.max(progressRef.current - 0.04, 0)
            }
            drawFrame()
            if (!active && progressRef.current <= 0) return
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
        <FairScaleCanvas key="fairscale" active={activeScreen === 0} reduced={reduced} />,
        <CreditCardCanvas key="creditcard" active={activeScreen === 1} reduced={reduced} />,
        <MerchantRegisterCanvas key="merchantregister" active={activeScreen === 2} reduced={reduced} />,
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

export default function MerchantMarketing() {
    const navigate = useNavigate()
    const [card1Visible, setCard1Visible] = useState(false)
    const [merchantScore, setMerchantScore] = useState(0)
    const card1Ref = useRef<HTMLDivElement>(null)
    const prefersReduced = useReducedMotion()
    const [showcaseIndex, setShowcaseIndex] = useState(0)
    const darkKeywordsRef = useRef<HTMLDivElement>(null)
    const [activeKeyword, setActiveKeyword] = useState(0)

    const merchantKeywordItems = [
        { word: 'Credit' },
        { word: 'Revenue' },
        { word: 'FairScale' },
        { word: 'x402' },
    ]

    const merchantKeywordDescriptions = [
        'No collateral. No banks. Your on-chain payment history becomes your credit line — enforced by smart contracts, not paperwork.',
        'Revenue consistency, volume, and frequency feed directly into your FairScale score. Every transaction builds your profile.',
        'Scored 0–1000 across four tiers. Higher scores unlock larger vaults, better rates, and faster tranche releases.',
        'Oracle-signed payment standard. Process settlements in under 2 seconds on Base L2 with full audit trail.',
    ]

    useEffect(() => {
        const node = card1Ref.current
        if (!node) return
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setCard1Visible(true); obs.disconnect() } }, { threshold: 0.3 })
        obs.observe(node)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        if (prefersReduced) return
        const interval = setInterval(() => {
            setShowcaseIndex(prev => (prev + 1) % 3)
        }, 4000)
        return () => clearInterval(interval)
    }, [prefersReduced])

    // Scroll-linked keyword highlighting — listen on #root (the actual scroll container)
    useEffect(() => {
        const section = darkKeywordsRef.current
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

    useEffect(() => {
        if (!card1Visible) return
        const target = 742
        const start = performance.now()
        let rafId: number
        const tick = (now: number) => {
            const p = Math.min((now - start) / 1200, 1)
            setMerchantScore(Math.round((1 - Math.pow(1 - p, 3)) * target))
            if (p < 1) rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafId)
    }, [card1Visible])

    return (
        <div className={styles.page}>
            {!prefersReduced && (
                <>
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 400, height: 400, top: '10%', left: '-5%', background: 'rgba(255,92,0,0.12)', filter: 'blur(70px)' }}
                        animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
                        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 350, height: 350, top: '30%', right: '-8%', background: 'rgba(255,133,51,0.10)', filter: 'blur(80px)' }}
                        animate={{ x: [0, -25, 20, 0], y: [0, 20, -30, 0] }}
                        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 300, height: 300, bottom: '15%', left: '20%', background: 'rgba(255,92,0,0.10)', filter: 'blur(60px)' }}
                        animate={{ x: [0, 20, -15, 0], y: [0, -20, 25, 0] }}
                        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className={styles.floatingOrb}
                        style={{ width: 250, height: 250, top: '60%', right: '15%', background: 'rgba(255,133,51,0.15)', filter: 'blur(65px)' }}
                        animate={{ x: [0, -18, 22, 0], y: [0, 15, -18, 0] }}
                        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </>
            )}

            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <motion.h1
                        className={styles.heroTitle}
                        initial={prefersReduced ? false : { opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        transition={{ duration: 0.9, ease }}
                    >
                        Build credit from<br />revenue, not collateral
                    </motion.h1>

                    <motion.div
                        className={styles.heroCardArea}
                        initial={prefersReduced ? false : { opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease, delay: 0.3 }}
                    >
                        <HeroShowcase prefersReduced={prefersReduced} activeScreen={showcaseIndex} />
                    </motion.div>

                    <div className={styles.heroBottomBar}>
                        <div className={styles.heroBottomLeft}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={showcaseIndex}
                                    initial={prefersReduced ? false : { opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -15 }}
                                    transition={{ duration: prefersReduced ? 0 : 0.35, ease }}
                                >
                                    <h2 className={styles.heroBottomTitle}>{heroScreenData[showcaseIndex].title}</h2>
                                    <p className={styles.heroBottomDesc}>{heroScreenData[showcaseIndex].desc}</p>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div className={styles.heroBottomRight}>
                            <div className={styles.heroPagination}>
                                {[0, 1, 2].map(i => (
                                    <button
                                        key={i}
                                        className={`${styles.paginationNum} ${showcaseIndex === i ? styles.paginationActive : ''}`}
                                        onClick={() => setShowcaseIndex(i)}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                            <motion.button
                                className={styles.connectBtn}
                                onClick={() => navigate('/waitlist')}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                Launch App
                            </motion.button>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.darkKeywords} ref={darkKeywordsRef}>
                <div className={styles.darkKeywordsSticky}>
                    <div className={styles.darkKeywordsInner}>
                        <div className={styles.darkKeywordsLeft}>
                            <h2 className={styles.darkKeywordsHeadline}>Build credit from revenue, not collateral</h2>
                        </div>
                        <div className={styles.darkKeywordsRight}>
                            {merchantKeywordItems.map((kw, i) => (
                                <span
                                    key={kw.word}
                                    className={`${styles.darkKeyword} ${i === activeKeyword ? styles.darkKeywordActive : styles.darkKeywordInactive}`}
                                >
                                    {kw.word}
                                </span>
                            ))}
                            <p className={styles.darkKeywordsDesc} key={activeKeyword}>
                                {merchantKeywordDescriptions[activeKeyword]}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.featureSection} id="features">
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Reputation System</div>
                        <h2 className={styles.featureTitle}>On-Chain Credit Score</h2>
                        <p className={styles.featureDesc}>
                            Build a verifiable credit history through on-chain payments. Every successful repayment increases your FairScale score — unlocking larger credit lines and better terms. Your score is calculated from revenue consistency, payment volume, frequency, and counterparty diversity. It updates with every transaction, not once a year.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Scored 0–1000 across four credit tiers: A, B, C, D</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Higher score = larger vaults, lower interest rates</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Transparent, immutable record on BaseScan</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> No credit bureau, no bank relationship needed</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <Card3DTilt className={styles.card}>
                            <div ref={card1Ref}>
                                <div className={styles.cardHeader}>
                                    <span>Merchant Profile</span>
                                    <span className={styles.liveBadge}><span className={styles.liveDot} /> Live</span>
                                </div>
                                <div className={styles.creditScoreWrap}>
                                    <div className={styles.creditCircle}>
                                        <span className={styles.creditValue}>{merchantScore}</span>
                                        <svg className={styles.creditSvg} viewBox="0 0 130 130">
                                            <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                                            <motion.circle cx="65" cy="65" r="56" fill="none" stroke="#FF8533" strokeWidth="8" strokeLinecap="round"
                                                strokeDasharray={2 * Math.PI * 56}
                                                initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                                                whileInView={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - 0.742) }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1.5, ease, delay: 0.3 }} />
                                        </svg>
                                    </div>
                                    <div className={styles.creditMeta}>
                                        <span className={styles.creditTier}>Tier A — Excellent</span>
                                        <span className={styles.creditLabel}>FairScale Score out of 1,000</span>
                                    </div>
                                </div>
                                <div className={styles.divider} />
                                <div className={styles.creditDetails}>
                                    {[
                                        { label: 'Revenue Consistency', value: '98%' },
                                        { label: 'x402 Payments', value: '1,247' },
                                        { label: 'Total Capital Accessed', value: '$185,000' },
                                        { label: 'Current Repayment Rate', value: '100%' },
                                        { label: 'Active Vaults', value: '1 of 2' },
                                    ].map((row, i) => (
                                        <motion.div key={row.label} className={styles.creditRow}
                                            initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                            transition={{ duration: 0.4, ease, delay: 0.5 + i * 0.08 }}>
                                            <span>{row.label}</span><span>{row.value}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </Card3DTilt>
                    </motion.div>
                </div>
            </section>

            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Oracle-Verified</div>
                        <h2 className={styles.featureTitle}>Automated Payments</h2>
                        <p className={styles.featureDesc}>
                            Process payments through the PaymentRouter — each transaction is signed by the oracle and recorded on-chain. Supports USDC, local bank rails, and card payments via on-ramp partners. Your payment history builds your credit score automatically with every settlement.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Oracle-signed ECDSA transactions</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Instant settlement on Base L2 in under 2 seconds</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Full payment audit trail on BaseScan</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Auto-repayment splits from incoming revenue</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <Card3DTilt className={styles.card}>
                            <div className={styles.cardHeader}><span>Payment Flow</span></div>
                            <div className={styles.paymentFlow}>
                                {[
                                    { name: 'Merchant initiates payment', desc: 'USDC amount + invoice reference submitted', color: '#FF8533' },
                                    { name: 'Oracle verifies & signs', desc: 'ECDSA signature generated from payment data', color: '#FF5C00' },
                                    { name: 'PaymentRouter executes', desc: 'On-chain settlement on Base L2 in <2s', color: '#CC4A00' },
                                    { name: 'Revenue split applied', desc: 'Auto-repayment deducted, remainder to merchant', color: '#993700' },
                                    { name: 'Credit score updated', desc: 'FairScale reputation increases immediately', color: '#663300' },
                                ].map((step, i) => (
                                    <motion.div key={step.name} className={styles.paymentStep}
                                        initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.1 }}>
                                        <span className={styles.paymentDot} style={{ background: step.color }} />
                                        <div className={styles.paymentInfo}>
                                            <div className={styles.paymentName}>{step.name}</div>
                                            <div className={styles.paymentDesc}>{step.desc}</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </Card3DTilt>
                    </motion.div>
                </div>
            </section>

            <section className={styles.statement}>
                <motion.h2 className={styles.statementText}
                    initial={{ opacity: 0, y: 40, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7, ease }}>
                    No collateral. No banks. No 6-week reviews. Process payments through x402, build a FairScale score, and access structured credit — all enforced by smart contracts.
                </motion.h2>
            </section>

            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div className={styles.featureContent}
                        initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}>
                        <div className={styles.featureLabel}>Borrower Tools</div>
                        <h2 className={styles.featureTitle}>Manage Your Vaults</h2>
                        <p className={styles.featureDesc}>
                            Create credit vaults, set terms (amount, APY, duration, tranches), track fundraising progress, submit milestone proofs, and make repayments — all from your merchant dashboard. Loan terms from 3–12 months with 2–8 configurable tranches. Typical cost: ~2% monthly.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Create and configure vaults with custom terms</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Track funding progress in real time</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> Submit milestone proofs for tranche release</motion.li>
                            <motion.li variants={listItemVariants}><Check size={16} className={styles.checkIcon} /> View complete repayment history and waterfall status</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay: 0.15 }}>
                        <Card3DTilt className={styles.card}>
                            <div className={styles.cardHeader}><span>Recent Activity</span></div>
                            <div className={styles.timelineList}>
                                {[
                                    { name: 'Vault Created', desc: '$50,000 target, 12.5% APY, 6mo', amount: '$50,000', color: '#FF8533' },
                                    { name: 'Fundraising Complete', desc: '47 investors participated', amount: '100%', color: '#2CFF05' },
                                    { name: 'Tranche 1 Released', desc: 'Milestone verified by oracle', amount: '$16,666', color: '#FF5C00' },
                                    { name: 'Payment Processed', desc: 'x402 settlement via PaymentRouter', amount: '$2,400', color: '#00FFF0' },
                                    { name: 'Tranche 2 Released', desc: 'Revenue milestone approved', amount: '$16,666', color: '#FF5C00' },
                                    { name: 'Repayment Auto-Split', desc: 'Waterfall: Senior → Pool → Community', amount: '$4,800', color: '#2CFF05' },
                                ].map((item, i) => (
                                    <motion.div key={`${item.name}-${i}`} className={styles.timelineItem}
                                        initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.15 + i * 0.06 }}>
                                        <div className={styles.timelineIcon} style={{ background: item.color }}><Check size={14} /></div>
                                        <div className={styles.timelineInfo}>
                                            <div className={styles.timelineName}>{item.name}</div>
                                            <div className={styles.timelineDesc}>{item.desc}</div>
                                        </div>
                                        <span className={styles.timelineAmount}>{item.amount}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </Card3DTilt>
                    </motion.div>
                </div>
            </section>

            <section className={styles.ctaSection}>
                <motion.h2 className={styles.ctaTitle}
                    initial={{ opacity: 0, y: 30, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
                    Build your on-chain reputation.
                </motion.h2>
                <motion.p className={styles.ctaSubtitle}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.1 }}>
                    Register, process payments, build your FairScale score, and unlock credit — all in one dashboard.
                </motion.p>
                <motion.div className={styles.ctaActions}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: 0.2 }}>
                    <motion.button className={styles.launchBtn} onClick={() => navigate('/waitlist')} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.97 }}>Launch App <ArrowRight size={18} /></motion.button>
                    <a href="https://sepolia.basescan.org/address/0xAEa7C5CCACebB1423b163b765d3214752f1496A4" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
