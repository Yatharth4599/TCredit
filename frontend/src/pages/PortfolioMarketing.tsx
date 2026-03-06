import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import styles from './PortfolioMarketing.module.css'

const ease = [0.16, 1, 0.3, 1] as const

const listContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
}

const listItem = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
}

const heroScreenData = [
    {
        title: 'Measure your performance',
        desc: 'Interactive charts track your vault portfolio value over time.',
    },
    {
        title: 'Understand your position',
        desc: 'See every vault you\'ve invested in with real-time APY and status.',
    },
    {
        title: 'Invest with confidence',
        desc: 'Lock capital into verified vaults with on-chain security and transparency.',
    },
]

const keywordData = [
    {
        word: 'PnL',
        desc: 'Track your profit and loss across every vault position in real-time. See exactly how each investment is performing against your entry point.',
    },
    {
        word: 'ROI',
        desc: 'Measure return on investment for each vault with clear percentage breakdowns and historical performance data over any time horizon.',
    },
    {
        word: 'Rewards',
        desc: 'Monitor accumulated yield and claimable rewards across all your active positions. One-click claiming when distributions arrive.',
    },
    {
        word: 'APR',
        desc: 'Compare annual percentage rates across vaults to optimize your capital allocation strategy and maximize risk-adjusted returns.',
    },
]

function ChartCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const frameRef = useRef(0)
    const animRef = useRef<number>(0)
    const drawnRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 400 * dpr
        canvas.height = 320 * dpr
        ctx.scale(dpr, dpr)

        const W = 400
        const H = 320
        const padL = 40
        const padR = 16
        const padT = 16
        const padB = 28
        const chartW = W - padL - padR
        const chartH = H - padT - padB

        const dataPoints = [8, 12, 15, 11, 20, 24, 18, 28, 32, 26, 35, 42, 38, 48, 52, 45, 55, 60, 56, 64]
        const maxVal = 75
        const pointCount = dataPoints.length

        function getX(i: number) { return padL + (i / (pointCount - 1)) * chartW }
        function getY(v: number) { return padT + ((maxVal - v) / maxVal) * chartH }

        function drawGrid() {
            ctx!.strokeStyle = 'rgba(255,255,255,0.06)'
            ctx!.lineWidth = 0.5
            for (let i = 0; i <= 4; i++) {
                const y = padT + (i / 4) * chartH
                ctx!.beginPath()
                ctx!.moveTo(padL, y)
                ctx!.lineTo(W - padR, y)
                ctx!.stroke()

                ctx!.fillStyle = 'rgba(255,255,255,0.25)'
                ctx!.font = '9px monospace'
                ctx!.textAlign = 'right'
                ctx!.textBaseline = 'middle'
                const label = `$${Math.round(maxVal - (i / 4) * maxVal)}k`
                ctx!.fillText(label, padL - 6, y)
            }

            ctx!.strokeStyle = 'rgba(255,255,255,0.04)'
            for (let i = 0; i < pointCount; i += 4) {
                const x = getX(i)
                ctx!.beginPath()
                ctx!.moveTo(x, padT)
                ctx!.lineTo(x, padT + chartH)
                ctx!.stroke()
            }
        }

        function drawChart(progress: number) {
            const visibleCount = Math.floor(progress * pointCount)
            const frac = progress * pointCount - visibleCount
            if (visibleCount < 1) return

            const grad = ctx!.createLinearGradient(0, padT, 0, padT + chartH)
            grad.addColorStop(0, 'rgba(0,200,180,0.18)')
            grad.addColorStop(1, 'rgba(0,200,180,0.01)')
            ctx!.fillStyle = grad
            ctx!.beginPath()
            ctx!.moveTo(getX(0), padT + chartH)
            for (let i = 0; i < visibleCount; i++) {
                ctx!.lineTo(getX(i), getY(dataPoints[i]))
            }
            if (visibleCount < pointCount && frac > 0) {
                const nextI = Math.min(visibleCount, pointCount - 1)
                const prevI = visibleCount - 1
                const ix = getX(prevI) + (getX(nextI) - getX(prevI)) * frac
                const iy = getY(dataPoints[prevI]) + (getY(dataPoints[nextI]) - getY(dataPoints[prevI])) * frac
                ctx!.lineTo(ix, iy)
                ctx!.lineTo(ix, padT + chartH)
            } else {
                ctx!.lineTo(getX(visibleCount - 1), padT + chartH)
            }
            ctx!.closePath()
            ctx!.fill()

            ctx!.strokeStyle = '#00C8B4'
            ctx!.lineWidth = 2.5
            ctx!.lineJoin = 'round'
            ctx!.lineCap = 'round'
            ctx!.beginPath()
            for (let i = 0; i < visibleCount; i++) {
                if (i === 0) ctx!.moveTo(getX(i), getY(dataPoints[i]))
                else ctx!.lineTo(getX(i), getY(dataPoints[i]))
            }
            if (visibleCount < pointCount && frac > 0) {
                const nextI = Math.min(visibleCount, pointCount - 1)
                const prevI = visibleCount - 1
                const ix = getX(prevI) + (getX(nextI) - getX(prevI)) * frac
                const iy = getY(dataPoints[prevI]) + (getY(dataPoints[nextI]) - getY(dataPoints[prevI])) * frac
                ctx!.lineTo(ix, iy)
            }
            ctx!.stroke()

            for (let i = 0; i < visibleCount; i++) {
                const px = getX(i)
                const py = getY(dataPoints[i])
                ctx!.fillStyle = '#fff'
                ctx!.beginPath()
                ctx!.arc(px, py, 3.5, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.fillStyle = '#00C8B4'
                ctx!.beginPath()
                ctx!.arc(px, py, 2, 0, Math.PI * 2)
                ctx!.fill()
            }

            if (visibleCount > 0) {
                const lastI = visibleCount - 1
                const lx = getX(lastI)
                const ly = getY(dataPoints[lastI])
                const pulseR = 4 + Math.sin(frameRef.current * 0.08) * 1.5
                ctx!.globalAlpha = 0.3 + Math.sin(frameRef.current * 0.08) * 0.15
                ctx!.fillStyle = '#00C8B4'
                ctx!.beginPath()
                ctx!.arc(lx, ly, pulseR + 3, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.globalAlpha = 1

                const val = `$${dataPoints[lastI]}k`
                ctx!.fillStyle = '#00C8B4'
                const boxW = 48
                const boxH = 18
                const bx = lx - boxW / 2
                const by = ly - 22
                ctx!.beginPath()
                ctx!.roundRect(bx, by, boxW, boxH, 0)
                ctx!.fill()
                ctx!.fillStyle = '#000'
                ctx!.font = 'bold 9px monospace'
                ctx!.textAlign = 'center'
                ctx!.textBaseline = 'middle'
                ctx!.fillText(val, lx, by + boxH / 2)
            }
        }

        function drawLabels() {
            const months = ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']
            ctx!.fillStyle = 'rgba(255,255,255,0.3)'
            ctx!.font = '8px monospace'
            ctx!.textAlign = 'center'
            for (let i = 0; i < months.length; i++) {
                const x = padL + (i / (months.length - 1)) * chartW
                ctx!.fillText(months[i], x, H - 8)
            }
        }

        function animate() {
            frameRef.current++
            ctx!.clearRect(0, 0, W, H)

            drawGrid()
            drawLabels()

            if (reduced) {
                drawnRef.current = 1
            } else if (active) {
                drawnRef.current = Math.min(drawnRef.current + 0.012, 1)
            } else {
                drawnRef.current = Math.max(drawnRef.current - 0.04, 0)
            }

            drawChart(drawnRef.current)

            if (reduced) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.cardCanvas} />
}

const vaultListData = [
    { name: 'Meridian Coffee Co.', amount: '$15,000', apy: '12.5%', status: 'Active', pct: 0.85 },
    { name: 'Atlas Logistics', amount: '$10,000', apy: '9.8%', status: 'Repaying', pct: 0.62 },
    { name: 'Nova Retail Corp', amount: '$17,500', apy: '11.2%', status: 'Active', pct: 0.91 },
    { name: 'Horizon Farms', amount: '$8,200', apy: '8.4%', status: 'Active', pct: 0.44 },
    { name: 'Pinnacle Tech', amount: '$12,000', apy: '10.1%', status: 'Funded', pct: 0.73 },
]

function VaultListCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const frameRef = useRef(0)
    const animRef = useRef<number>(0)
    const scrollRef = useRef(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = 400 * dpr
        canvas.height = 320 * dpr
        ctx.scale(dpr, dpr)

        const W = 400
        const H = 320
        const pad = 16
        const rowH = 52
        const headerH = 36
        const totalRows = vaultListData.length
        const listH = totalRows * rowH

        function drawHeader() {
            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 12px sans-serif'
            ctx!.textBaseline = 'middle'
            ctx!.fillText('Your Vaults', pad, headerH / 2 + 2)

            ctx!.fillStyle = 'rgba(255,255,255,0.12)'
            ctx!.beginPath()
            ctx!.roundRect(W - pad - 26, 8, 26, 20, 0)
            ctx!.fill()
            ctx!.fillStyle = 'rgba(255,255,255,0.5)'
            ctx!.font = 'bold 10px monospace'
            ctx!.textAlign = 'center'
            ctx!.fillText(String(totalRows), W - pad - 13, 19)
            ctx!.textAlign = 'left'

            ctx!.strokeStyle = 'rgba(255,255,255,0.08)'
            ctx!.lineWidth = 1
            ctx!.beginPath()
            ctx!.moveTo(pad, headerH)
            ctx!.lineTo(W - pad, headerH)
            ctx!.stroke()
        }

        function drawRow(idx: number, y: number, alpha: number) {
            const v = vaultListData[idx % totalRows]
            ctx!.globalAlpha = alpha

            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 11px sans-serif'
            ctx!.textBaseline = 'top'
            ctx!.fillText(v.name, pad, y + 6)

            ctx!.fillStyle = 'rgba(255,255,255,0.35)'
            ctx!.font = '9px monospace'
            ctx!.fillText(`${v.apy} APY · ${v.status}`, pad, y + 22)

            const barW = 60
            const barH = 4
            const barX = pad
            const barY = y + 37
            ctx!.fillStyle = 'rgba(255,255,255,0.06)'
            ctx!.fillRect(barX, barY, barW, barH)
            const fill = v.pct * barW
            ctx!.fillStyle = v.status === 'Repaying' ? '#FFA500' : v.status === 'Funded' ? '#8888FF' : '#00C8B4'
            ctx!.fillRect(barX, barY, fill, barH)

            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 12px monospace'
            ctx!.textAlign = 'right'
            ctx!.fillText(v.amount, W - pad, y + 10)
            ctx!.textAlign = 'left'

            const statusColor = v.status === 'Active' ? '#00C8B4' : v.status === 'Repaying' ? '#FFA500' : '#8888FF'
            ctx!.fillStyle = statusColor
            ctx!.beginPath()
            ctx!.arc(W - pad - 4, y + 28, 3, 0, Math.PI * 2)
            ctx!.fill()

            if (y + rowH < H) {
                ctx!.strokeStyle = 'rgba(255,255,255,0.06)'
                ctx!.lineWidth = 0.5
                ctx!.beginPath()
                ctx!.moveTo(pad, y + rowH)
                ctx!.lineTo(W - pad, y + rowH)
                ctx!.stroke()
            }

            ctx!.globalAlpha = 1
        }

        function animate() {
            frameRef.current++
            ctx!.clearRect(0, 0, W, H)

            drawHeader()

            if (!reduced && active) {
                scrollRef.current += 0.3
                if (scrollRef.current >= listH) scrollRef.current -= listH
            }

            ctx!.save()
            ctx!.beginPath()
            ctx!.rect(0, headerH, W, H - headerH)
            ctx!.clip()

            const scrollY = scrollRef.current
            for (let i = -1; i <= totalRows + 1; i++) {
                const baseY = headerH + 4 + i * rowH - scrollY
                const wrappedY = ((baseY - headerH + listH * 2) % listH) + headerH
                if (wrappedY > H + rowH || wrappedY < headerH - rowH) continue

                let alpha = 1
                const distFromTop = wrappedY - headerH
                const distFromBottom = H - wrappedY
                if (distFromTop < 20) alpha = Math.max(0, distFromTop / 20)
                if (distFromBottom < 30) alpha = Math.max(0, distFromBottom / 30)

                const rowIdx = ((i % totalRows) + totalRows) % totalRows
                drawRow(rowIdx, wrappedY, alpha)
            }

            ctx!.restore()

            ctx!.fillStyle = 'rgba(255,255,255,0.15)'
            const scrollIndicatorH = ((H - headerH) / listH) * (H - headerH - 20)
            const scrollIndicatorY = headerH + 10 + (scrollY / listH) * (H - headerH - 20 - scrollIndicatorH)
            ctx!.fillRect(W - 4, scrollIndicatorY, 2, Math.max(scrollIndicatorH, 16))

            if (reduced) return
            animRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animRef.current)
    }, [active, reduced])

    return <canvas ref={canvasRef} className={styles.cardCanvas} />
}

function CashCatCanvas({ active, reduced }: { active: boolean; reduced: boolean }) {
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

        const stacks = [
            { x: 80, w: 58, h: 65 },
            { x: 160, w: 62, h: 95 },
            { x: 240, w: 56, h: 52 },
            { x: 310, w: 50, h: 42 },
        ]
        const floorY = 210

        const floatingDollars: { x: number; y: number; speed: number; opacity: number; size: number }[] = []
        for (let i = 0; i < 8; i++) {
            floatingDollars.push({
                x: 70 + Math.random() * 280,
                y: floorY - Math.random() * 60,
                speed: 0.3 + Math.random() * 0.4,
                opacity: 0.15 + Math.random() * 0.25,
                size: 9 + Math.random() * 5,
            })
        }

        function drawStack(sx: number, sw: number, sh: number) {
            const sy = floorY - sh
            const billH = 6
            const bills = Math.floor(sh / billH)

            ctx!.fillStyle = 'rgba(0,0,0,0.35)'
            ctx!.beginPath()
            ctx!.ellipse(sx, floorY + 4, sw / 2 + 6, 5, 0, 0, Math.PI * 2)
            ctx!.fill()

            for (let b = 0; b < bills; b++) {
                const by = sy + b * billH
                const offset = (b % 2 === 0 ? 0 : 1)
                const bx = sx - sw / 2 + offset

                const shade = b % 2 === 0 ? '#2E8B2E' : '#3AA63A'
                ctx!.fillStyle = shade
                ctx!.beginPath()
                ctx!.roundRect(bx, by, sw, billH - 0.5, 1)
                ctx!.fill()

                ctx!.fillStyle = 'rgba(255,255,255,0.08)'
                ctx!.fillRect(bx + 2, by + 1, sw - 4, 0.5)

                ctx!.fillStyle = 'rgba(0,0,0,0.15)'
                ctx!.fillRect(bx, by + billH - 1, sw, 0.5)
            }

            for (let b = 0; b < bills; b++) {
                const by = sy + b * billH
                ctx!.fillStyle = 'rgba(0,0,0,0.2)'
                ctx!.fillRect(sx + sw / 2, by, 2, billH - 0.5)
                ctx!.fillStyle = 'rgba(255,255,255,0.06)'
                ctx!.fillRect(sx - sw / 2, by, 1.5, billH - 0.5)
            }

            const bandY = sy + Math.floor(bills / 2) * billH - 2
            ctx!.fillStyle = '#C8A03C'
            ctx!.fillRect(sx - sw / 2 - 1, bandY, sw + 2, 10)
            ctx!.fillStyle = 'rgba(255,255,255,0.25)'
            ctx!.fillRect(sx - sw / 2 - 1, bandY, sw + 2, 1.5)
            ctx!.fillStyle = 'rgba(0,0,0,0.3)'
            ctx!.fillRect(sx - sw / 2 - 1, bandY + 9, sw + 2, 1)
            ctx!.fillStyle = 'rgba(255,255,255,0.1)'
            ctx!.fillRect(sx - sw / 2 + 2, bandY + 3, sw - 4, 1)

            const topBillY = sy
            const topBx = sx - sw / 2
            ctx!.fillStyle = '#33B833'
            ctx!.beginPath()
            ctx!.roundRect(topBx, topBillY, sw, billH - 0.5, 1)
            ctx!.fill()

            ctx!.strokeStyle = 'rgba(255,255,255,0.18)'
            ctx!.lineWidth = 0.5
            ctx!.strokeRect(topBx + 3, topBillY + 1, sw - 6, billH - 2.5)

            ctx!.fillStyle = 'rgba(255,255,255,0.6)'
            ctx!.font = 'bold 5px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'middle'
            ctx!.fillText('$100', sx, topBillY + billH / 2)
        }

        function drawCat(frame: number) {
            const cycle = frame % 300
            const catX = stacks[1].x
            const catBaseY = floorY - stacks[1].h

            const tailSwish = Math.sin(frame * 0.06) * 12
            ctx!.strokeStyle = '#2A2A2A'
            ctx!.lineWidth = 6
            ctx!.lineCap = 'round'
            ctx!.beginPath()
            ctx!.moveTo(catX + 20, catBaseY - 10)
            ctx!.bezierCurveTo(catX + 30, catBaseY - 18, catX + 34, catBaseY - 34 + tailSwish, catX + 40 + tailSwish * 0.3, catBaseY - 48)
            ctx!.stroke()
            ctx!.strokeStyle = '#3A3A3A'
            ctx!.lineWidth = 4
            ctx!.beginPath()
            ctx!.moveTo(catX + 20, catBaseY - 10)
            ctx!.bezierCurveTo(catX + 30, catBaseY - 18, catX + 34, catBaseY - 34 + tailSwish, catX + 40 + tailSwish * 0.3, catBaseY - 48)
            ctx!.stroke()

            const bodyGrad = ctx!.createRadialGradient(catX - 4, catBaseY - 20, 4, catX, catBaseY - 16, 28)
            bodyGrad.addColorStop(0, '#4A4A4A')
            bodyGrad.addColorStop(0.5, '#3A3A3A')
            bodyGrad.addColorStop(1, '#2A2A2A')
            ctx!.fillStyle = bodyGrad
            ctx!.beginPath()
            ctx!.moveTo(catX - 22, catBaseY - 8)
            ctx!.bezierCurveTo(catX - 24, catBaseY - 18, catX - 22, catBaseY - 32, catX - 14, catBaseY - 34)
            ctx!.bezierCurveTo(catX - 4, catBaseY - 36, catX + 4, catBaseY - 36, catX + 14, catBaseY - 34)
            ctx!.bezierCurveTo(catX + 22, catBaseY - 32, catX + 24, catBaseY - 18, catX + 22, catBaseY - 8)
            ctx!.bezierCurveTo(catX + 20, catBaseY, catX + 14, catBaseY + 4, catX, catBaseY + 4)
            ctx!.bezierCurveTo(catX - 14, catBaseY + 4, catX - 20, catBaseY, catX - 22, catBaseY - 8)
            ctx!.closePath()
            ctx!.fill()
            ctx!.strokeStyle = '#2A2A2A'
            ctx!.lineWidth = 1.5
            ctx!.stroke()

            const bellyGrad = ctx!.createRadialGradient(catX, catBaseY - 12, 2, catX, catBaseY - 14, 16)
            bellyGrad.addColorStop(0, 'rgba(80,80,80,0.4)')
            bellyGrad.addColorStop(1, 'rgba(60,60,60,0)')
            ctx!.fillStyle = bellyGrad
            ctx!.beginPath()
            ctx!.ellipse(catX, catBaseY - 12, 14, 12, 0, 0, Math.PI * 2)
            ctx!.fill()

            const headGrad = ctx!.createRadialGradient(catX - 2, catBaseY - 46, 3, catX, catBaseY - 42, 18)
            headGrad.addColorStop(0, '#4A4A4A')
            headGrad.addColorStop(0.6, '#3A3A3A')
            headGrad.addColorStop(1, '#2A2A2A')
            ctx!.fillStyle = headGrad
            ctx!.beginPath()
            ctx!.ellipse(catX, catBaseY - 42, 17, 16, 0, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.strokeStyle = '#222'
            ctx!.lineWidth = 1.5
            ctx!.stroke()

            ctx!.fillStyle = '#3A3A3A'
            ctx!.beginPath()
            ctx!.moveTo(catX, catBaseY - 30)
            ctx!.bezierCurveTo(catX - 6, catBaseY - 28, catX - 10, catBaseY - 32, catX - 8, catBaseY - 34)
            ctx!.lineTo(catX, catBaseY - 32)
            ctx!.closePath()
            ctx!.fill()
            ctx!.beginPath()
            ctx!.moveTo(catX, catBaseY - 30)
            ctx!.bezierCurveTo(catX + 6, catBaseY - 28, catX + 10, catBaseY - 32, catX + 8, catBaseY - 34)
            ctx!.lineTo(catX, catBaseY - 32)
            ctx!.closePath()
            ctx!.fill()

            for (const side of [-1, 1]) {
                const earX = catX + side * 12
                const earBaseY = catBaseY - 54
                ctx!.fillStyle = '#2A2A2A'
                ctx!.beginPath()
                ctx!.moveTo(earX - side * 6, catBaseY - 52)
                ctx!.lineTo(earX + side * 1, earBaseY - 12)
                ctx!.lineTo(earX + side * 7, catBaseY - 50)
                ctx!.closePath()
                ctx!.fill()

                ctx!.fillStyle = '#666'
                ctx!.beginPath()
                ctx!.moveTo(earX - side * 4, catBaseY - 52)
                ctx!.lineTo(earX + side * 1, earBaseY - 8)
                ctx!.lineTo(earX + side * 5, catBaseY - 50)
                ctx!.closePath()
                ctx!.fill()
            }

            for (const side of [-1, 1]) {
                const eyeX = catX + side * 7
                const eyeY = catBaseY - 44

                ctx!.fillStyle = '#fff'
                ctx!.beginPath()
                ctx!.ellipse(eyeX, eyeY, 6, 5.5, 0, 0, Math.PI * 2)
                ctx!.fill()

                ctx!.fillStyle = '#A8D86E'
                ctx!.beginPath()
                ctx!.ellipse(eyeX, eyeY, 4.5, 4.5, 0, 0, Math.PI * 2)
                ctx!.fill()

                ctx!.fillStyle = '#1a1a1a'
                ctx!.beginPath()
                ctx!.ellipse(eyeX, eyeY, 2.5, 3.5, 0, 0, Math.PI * 2)
                ctx!.fill()

                ctx!.fillStyle = 'rgba(255,255,255,0.9)'
                ctx!.beginPath()
                ctx!.arc(eyeX + 1.5, eyeY - 1.5, 1.2, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.beginPath()
                ctx!.arc(eyeX - 0.5, eyeY + 1, 0.6, 0, Math.PI * 2)
                ctx!.fill()
            }

            ctx!.fillStyle = '#222'
            ctx!.beginPath()
            ctx!.moveTo(catX, catBaseY - 36)
            ctx!.lineTo(catX - 2.5, catBaseY - 34)
            ctx!.lineTo(catX + 2.5, catBaseY - 34)
            ctx!.closePath()
            ctx!.fill()

            ctx!.strokeStyle = '#555'
            ctx!.lineWidth = 0.8
            ctx!.beginPath()
            ctx!.moveTo(catX - 1, catBaseY - 34)
            ctx!.bezierCurveTo(catX - 3, catBaseY - 32, catX - 4, catBaseY - 33, catX - 5, catBaseY - 33)
            ctx!.stroke()
            ctx!.beginPath()
            ctx!.moveTo(catX + 1, catBaseY - 34)
            ctx!.bezierCurveTo(catX + 3, catBaseY - 32, catX + 4, catBaseY - 33, catX + 5, catBaseY - 33)
            ctx!.stroke()

            ctx!.strokeStyle = 'rgba(150,150,150,0.3)'
            ctx!.lineWidth = 0.7
            for (let side = -1; side <= 1; side += 2) {
                for (let w = 0; w < 3; w++) {
                    ctx!.beginPath()
                    ctx!.moveTo(catX + side * 4, catBaseY - 36 + w * 1.5)
                    ctx!.bezierCurveTo(catX + side * 12, catBaseY - 38 + w * 2, catX + side * 18, catBaseY - 39 + w * 2.5, catX + side * 26, catBaseY - 38 + w * 3)
                    ctx!.stroke()
                }
            }

            ctx!.fillStyle = '#333'
            ctx!.beginPath()
            ctx!.ellipse(catX - 12, catBaseY + 2, 6, 3.5, 0.2, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.beginPath()
            ctx!.ellipse(catX - 3, catBaseY + 3, 6, 3.5, -0.1, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.strokeStyle = '#222'
            ctx!.lineWidth = 1
            ctx!.beginPath()
            ctx!.ellipse(catX - 12, catBaseY + 2, 6, 3.5, 0.2, 0, Math.PI * 2)
            ctx!.stroke()
            ctx!.beginPath()
            ctx!.ellipse(catX - 3, catBaseY + 3, 6, 3.5, -0.1, 0, Math.PI * 2)
            ctx!.stroke()

            const beans = [
                { px: catX - 15, py: catBaseY + 1 },
                { px: catX - 12, py: catBaseY + 0 },
                { px: catX - 10, py: catBaseY + 3 },
                { px: catX - 6, py: catBaseY + 2 },
                { px: catX - 3, py: catBaseY + 1 },
                { px: catX - 1, py: catBaseY + 4 },
            ]
            ctx!.fillStyle = '#555'
            for (const b of beans) {
                ctx!.beginPath()
                ctx!.arc(b.px, b.py, 1.4, 0, Math.PI * 2)
                ctx!.fill()
            }

            let armAngle = 0
            let showCoin = false
            let sunglassProgress = 0

            if (cycle < 60) {
                armAngle = 0
            } else if (cycle < 100) {
                const t = (cycle - 60) / 40
                armAngle = t * 1.2
                showCoin = t > 0.5
            } else if (cycle < 160) {
                armAngle = 1.2
                showCoin = true
                sunglassProgress = Math.min(1, (cycle - 120) / 30)
            } else if (cycle < 200) {
                const t = (cycle - 160) / 40
                armAngle = 1.2 * (1 - t)
                showCoin = t < 0.5
                sunglassProgress = Math.max(0, 1 - t * 2)
            }

            if (armAngle > 0) {
                const armStartX = catX - 18
                const armStartY = catBaseY - 22
                const armLen = 20
                const ax = armStartX - Math.sin(armAngle) * armLen
                const ay = armStartY - Math.cos(armAngle) * armLen

                const armGrad = ctx!.createLinearGradient(armStartX, armStartY, ax, ay)
                armGrad.addColorStop(0, '#3A3A3A')
                armGrad.addColorStop(1, '#2A2A2A')
                ctx!.strokeStyle = armGrad
                ctx!.lineWidth = 5
                ctx!.lineCap = 'round'
                ctx!.beginPath()
                ctx!.moveTo(armStartX, armStartY)
                ctx!.lineTo(ax, ay)
                ctx!.stroke()

                ctx!.fillStyle = '#333'
                ctx!.beginPath()
                ctx!.arc(ax, ay, 4, 0, Math.PI * 2)
                ctx!.fill()

                if (showCoin) {
                    const coinGrad = ctx!.createRadialGradient(ax - 1, ay - 12, 1, ax, ay - 10, 8)
                    coinGrad.addColorStop(0, '#FFE44D')
                    coinGrad.addColorStop(0.7, '#FFD700')
                    coinGrad.addColorStop(1, '#B8860B')
                    ctx!.fillStyle = coinGrad
                    ctx!.beginPath()
                    ctx!.arc(ax, ay - 10, 8, 0, Math.PI * 2)
                    ctx!.fill()
                    ctx!.strokeStyle = '#DAA520'
                    ctx!.lineWidth = 1
                    ctx!.stroke()
                    ctx!.fillStyle = '#8B6914'
                    ctx!.font = 'bold 10px sans-serif'
                    ctx!.textAlign = 'center'
                    ctx!.textBaseline = 'middle'
                    ctx!.fillText('$', ax, ay - 10)
                }
            }

            if (sunglassProgress > 0) {
                const glassY = catBaseY - 44 + (1 - sunglassProgress) * (-8)
                ctx!.globalAlpha = sunglassProgress
                ctx!.fillStyle = '#111'
                ctx!.beginPath()
                ctx!.roundRect(catX - 13, glassY - 3, 12, 6.5, 2)
                ctx!.fill()
                ctx!.beginPath()
                ctx!.roundRect(catX + 1, glassY - 3, 12, 6.5, 2)
                ctx!.fill()
                ctx!.fillStyle = '#222'
                ctx!.fillRect(catX - 1, glassY - 0.5, 2, 1.5)
                ctx!.strokeStyle = '#444'
                ctx!.lineWidth = 0.5
                ctx!.beginPath()
                ctx!.roundRect(catX - 13, glassY - 3, 12, 6.5, 2)
                ctx!.stroke()
                ctx!.beginPath()
                ctx!.roundRect(catX + 1, glassY - 3, 12, 6.5, 2)
                ctx!.stroke()
                ctx!.fillStyle = 'rgba(255,255,255,0.15)'
                ctx!.beginPath()
                ctx!.ellipse(catX - 9, glassY - 1, 2.5, 1.2, -0.3, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.beginPath()
                ctx!.ellipse(catX + 5, glassY - 1, 2.5, 1.2, -0.3, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.globalAlpha = 1
            }
        }

        function drawFloatingDollars(frame: number) {
            ctx!.font = 'bold 12px monospace'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'middle'
            for (const d of floatingDollars) {
                const y = ((d.y - frame * d.speed) % (floorY + 20))
                const adjustedY = y < 20 ? y + floorY : y
                const fadeOut = adjustedY < 60 ? adjustedY / 60 : 1
                ctx!.globalAlpha = d.opacity * fadeOut
                ctx!.fillStyle = '#2ECC71'
                ctx!.font = `bold ${d.size}px monospace`
                ctx!.fillText('$', d.x, adjustedY)
            }
            ctx!.globalAlpha = 1
        }

        function drawText() {
            ctx!.fillStyle = '#fff'
            ctx!.font = 'bold 16px sans-serif'
            ctx!.textAlign = 'center'
            ctx!.textBaseline = 'top'
            ctx!.fillText('Portfolio Value', W / 2, floorY + 24)

            ctx!.fillStyle = 'rgba(255,255,255,0.5)'
            ctx!.font = '13px monospace'
            ctx!.fillText('$15,000 USDC', W / 2, floorY + 48)
        }

        function animate() {
            frameRef.current++
            ctx!.fillStyle = '#111'
            ctx!.fillRect(0, 0, W, H)

            drawFloatingDollars(frameRef.current)

            for (const s of stacks) {
                drawStack(s.x, s.w, s.h)
            }

            drawCat(frameRef.current)
            drawText()

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
        <ChartCanvas key="chart" active={activeScreen === 0} reduced={reduced} />,
        <VaultListCanvas key="vaults" active={activeScreen === 1} reduced={reduced} />,
        <CashCatCanvas key="cashcat" active={activeScreen === 2} reduced={reduced} />,
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

function ScrollKeywordsReduced() {
    return (
        <section className={styles.scrollKeywordsOuter} style={{ height: 'auto' }}>
            <div className={styles.scrollKeywordsSticky} style={{ position: 'relative' }}>
                <div className={styles.scrollKeywordsContent}>
                    <div className={styles.scrollKeywordsLeft}>
                        <h2 className={styles.scrollKeywordsHeadline}>
                            The DeFi metrics you need<br />to find your edge
                        </h2>
                    </div>
                    <div className={styles.scrollKeywordsRight}>
                        <div className={styles.scrollKeywordsWords}>
                            {keywordData.map((kw, i) => (
                                <div key={kw.word} className={`${styles.scrollKeyword} ${i === 0 ? styles.scrollKeywordActive : ''}`}
                                    style={{ opacity: i === 0 ? 1 : 0.15 }}>
                                    {kw.word}
                                </div>
                            ))}
                        </div>
                        <p className={styles.scrollKeywordsDesc}>
                            {keywordData[0].desc}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}

function ScrollKeywords({ prefersReduced }: { prefersReduced: boolean | null }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [activeKeyword, setActiveKeyword] = useState(0)
    const rafRef = useRef<number>(0)

    const updateKeyword = useCallback(() => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const containerHeight = containerRef.current.offsetHeight
        const viewportHeight = window.innerHeight
        const scrollableDistance = containerHeight - viewportHeight
        if (scrollableDistance <= 0) return

        const scrolled = -rect.top
        const progress = Math.max(0, Math.min(scrolled / scrollableDistance, 0.999))
        const idx = Math.min(keywordData.length - 1, Math.floor(progress * keywordData.length))
        setActiveKeyword(idx)
    }, [])

    useEffect(() => {
        if (prefersReduced) return

        const onScroll = () => {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = requestAnimationFrame(updateKeyword)
        }

        const scroller = document.getElementById('root') ?? window
        scroller.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        return () => {
            scroller.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(rafRef.current)
        }
    }, [updateKeyword, prefersReduced])

    if (prefersReduced) {
        return <ScrollKeywordsReduced />
    }

    return (
        <section
            ref={containerRef}
            className={styles.scrollKeywordsOuter}
        >
            <div className={styles.scrollKeywordsSticky}>
                <div className={styles.scrollKeywordsContent}>
                    <div className={styles.scrollKeywordsLeft}>
                        <motion.h2
                            className={styles.scrollKeywordsHeadline}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease }}
                        >
                            The DeFi metrics you need<br />to find your edge
                        </motion.h2>
                    </div>
                    <div className={styles.scrollKeywordsRight}>
                        <div className={styles.scrollKeywordsWords}>
                            {keywordData.map((kw, i) => (
                                <div
                                    key={kw.word}
                                    className={`${styles.scrollKeyword} ${activeKeyword === i ? styles.scrollKeywordActive : ''}`}
                                >
                                    {kw.word}
                                </div>
                            ))}
                        </div>
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={activeKeyword}
                                className={styles.scrollKeywordsDesc}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3, ease }}
                            >
                                {keywordData[activeKeyword].desc}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    )
}

function VaultCardContent1() {
    return (
        <div className={styles.vaultAnimInner}>
            <div className={styles.vaultAnimLabel}>Amount Raised</div>
            <div className={styles.vaultAnimBig}>$2.4M</div>
            <div className={styles.progressTrack}>
                <div className={styles.progressFill} />
            </div>
            <div className={styles.progressLabels}>
                <span>80% funded</span><span>Target: $3M</span>
            </div>
        </div>
    )
}

function VaultCardContent2() {
    return (
        <div className={styles.vaultAnimInner}>
            <div className={styles.vaultAnimLabel}>Current Yield</div>
            <div className={styles.vaultAnimBig}>9.8%</div>
            <div className={styles.yieldBars}>
                {[40, 55, 45, 70, 60, 80, 65, 75, 50, 85, 70, 90].map((h, i) => (
                    <div key={i} className={styles.yieldBar} style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                ))}
            </div>
        </div>
    )
}

function VaultCardContent3() {
    return (
        <div className={styles.vaultAnimInner}>
            <div className={styles.vaultAnimLabel}>Repayment</div>
            <div className={styles.vaultAnimBig}>7.2%</div>
            <div className={styles.repaymentTimeline}>
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                    <div key={q} className={styles.timelineStep}>
                        <div className={`${styles.timelineDot} ${i < 3 ? styles.timelineDotDone : ''}`} />
                        <span className={styles.timelineLabel}>{q}</span>
                    </div>
                ))}
                <div className={styles.timelineLine} />
            </div>
        </div>
    )
}

function VaultComparison({ prefersReduced }: { prefersReduced: boolean | null }) {
    const vaults = [
        { name: 'Meridian Coffee Co.', currency: 'USDC', apy: '12.0% APY', content: <VaultCardContent1 /> },
        { name: 'Atlas Logistics', currency: 'USDC', apy: '9.8% APY', content: <VaultCardContent2 /> },
        { name: 'Nova Retail Corp', currency: 'USDC', apy: '7.2% APY', content: <VaultCardContent3 /> },
    ]

    return (
        <section className={styles.vaultCompare}>
            <div className={styles.vaultCompareInner}>
                <motion.h2
                    className={styles.vaultCompareTitle}
                    initial={prefersReduced ? false : { opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: prefersReduced ? 0 : 0.6, ease }}
                >
                    Compare performance across Krexa vaults
                </motion.h2>
                <motion.p
                    className={styles.vaultCompareDesc}
                    initial={prefersReduced ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: prefersReduced ? 0 : 0.6, ease, delay: prefersReduced ? 0 : 0.1 }}
                >
                    Transparent, real-time metrics and APR data for crypto staking and holding to maximize your portfolio's potential.
                </motion.p>
                <div className={styles.vaultCardsStatic}>
                    {vaults.map((v) => (
                        <div key={v.name} className={styles.vaultCard}>
                            <div className={styles.vaultCardName}>{v.name}</div>
                            {v.content}
                            <div className={styles.vaultCardBottom}>
                                <span className={styles.vaultCardCurrency}>{v.currency}</span>
                                <span className={styles.vaultCardApy}>{v.apy}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default function PortfolioMarketing() {
    const navigate = useNavigate()
    const prefersReduced = useReducedMotion()
    const [activeScreen, setActiveScreen] = useState(0)

    useEffect(() => {
        if (prefersReduced) return
        const interval = setInterval(() => {
            setActiveScreen(prev => (prev + 1) % 3)
        }, 4000)
        return () => clearInterval(interval)
    }, [prefersReduced])

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <motion.h1
                        className={styles.heroTitle}
                        initial={prefersReduced ? false : { opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        transition={{ duration: 0.9, ease }}
                    >
                        Get clarity with your<br />portfolio tracker
                    </motion.h1>

                    <motion.div
                        className={styles.heroCardArea}
                        initial={prefersReduced ? false : { opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease, delay: 0.3 }}
                    >
                        <HeroShowcase
                            prefersReduced={prefersReduced}
                            activeScreen={activeScreen}
                        />
                    </motion.div>

                    <div className={styles.heroBottomBar}>
                        <div className={styles.heroBottomLeft}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeScreen}
                                    initial={prefersReduced ? false : { opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -15 }}
                                    transition={{ duration: prefersReduced ? 0 : 0.35, ease }}
                                >
                                    <h2 className={styles.heroBottomTitle}>{heroScreenData[activeScreen].title}</h2>
                                    <p className={styles.heroBottomDesc}>{heroScreenData[activeScreen].desc}</p>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div className={styles.heroBottomRight}>
                            <div className={styles.heroPagination}>
                                {[0, 1, 2].map(i => (
                                    <button
                                        key={i}
                                        className={`${styles.paginationNum} ${activeScreen === i ? styles.paginationActive : ''}`}
                                        onClick={() => setActiveScreen(i)}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                            <motion.button
                                className={styles.connectBtn}
                                onClick={() => navigate('/waitlist')}
                                whileHover={prefersReduced ? {} : { scale: 1.04 }}
                                whileTap={prefersReduced ? {} : { scale: 0.97 }}
                            >
                                Connect wallet
                            </motion.button>
                        </div>
                    </div>
                </div>
            </section>

            <ScrollKeywords prefersReduced={prefersReduced} />

            <VaultComparison prefersReduced={prefersReduced} />

            {/* ── Feature 1: Manage & Claim Yield ──── */}
            <section className={styles.featureSection}>
                <div className={styles.featureInner}>
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Investment Management</div>
                        <h2 className={styles.featureTitle}>Manage & Claim Yield</h2>
                        <p className={styles.featureDesc}>
                            Filter by status, view individual vault details, and claim accumulated yield — all in one click.
                            Every claim is a transparent on-chain transaction signed by your wallet.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> One-click yield claiming across all positions</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Filter by active, repaying, or completed vaults</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Real-time APY and claimable amount per vault</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Every claim verified on-chain via BaseScan</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span>Your Investments</span>
                                <span className={styles.liveBadge}><span className={styles.liveDot} /> Live</span>
                            </div>
                            <div className={styles.wideCardList}>
                                {[
                                    { name: 'Meridian Coffee Co.', amount: '$15,000', apy: '12.5% APY', status: 'Active', claimable: '$840' },
                                    { name: 'Atlas Logistics', amount: '$10,000', apy: '9.8% APY', status: 'Repaying', claimable: '$1,200' },
                                    { name: 'Nova Retail Corp', amount: '$17,500', apy: '11.2% APY', status: 'Active', claimable: '$1,200' },
                                ].map((inv, i) => (
                                    <motion.div
                                        key={inv.name}
                                        className={styles.wideCardItem}
                                        initial={{ opacity: 0, x: -15 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.1 }}
                                    >
                                        <div className={styles.wideCardItemLeft}>
                                            <div className={styles.wideCardItemName}>{inv.name}</div>
                                            <div className={styles.wideCardItemMeta}>{inv.apy} · {inv.status}</div>
                                        </div>
                                        <div className={styles.wideCardItemRight}>
                                            <span className={styles.wideCardItemAmount}>{inv.amount}</span>
                                            <span className={styles.wideCardItemClaim}>Claim {inv.claimable}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Statement ────────────────────────── */}
            <section className={styles.statement}>
                <motion.h2 className={styles.statementText}
                    initial={{ opacity: 0, y: 40, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.7, ease }}
                >
                    Every position. Every yield. Every claim. One dashboard — fully on-chain.
                </motion.h2>
            </section>

            {/* ── Feature 2: Allocation Insights ───── */}
            <section className={styles.featureSection}>
                <div className={`${styles.featureInner} ${styles.featureReverse}`}>
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease }}
                    >
                        <div className={styles.featureLabel}>Analytics</div>
                        <h2 className={styles.featureTitle}>Allocation Insights</h2>
                        <p className={styles.featureDesc}>
                            Understand how your capital is distributed across active, repaying, and completed vaults.
                            Visual breakdowns help you optimize your portfolio strategy and rebalance across risk tiers.
                        </p>
                        <motion.ul className={styles.featureList}
                            variants={listContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Visual capital distribution across vault states</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Percentage breakdowns by allocation tier</motion.li>
                            <motion.li variants={listItem}><Check size={16} className={styles.checkIcon} /> Rebalance strategy insights at a glance</motion.li>
                        </motion.ul>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease, delay: 0.15 }}
                    >
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span>Portfolio Allocation</span>
                            </div>
                            <div className={styles.allocationViz}>
                                <div className={styles.allocationBarWrap}>
                                    <motion.div className={styles.allocationSegment} style={{ background: '#00FFF0' }}
                                        initial={{ width: 0 }} whileInView={{ width: '55%' }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.3 }} />
                                    <motion.div className={styles.allocationSegment} style={{ background: '#FFA500' }}
                                        initial={{ width: 0 }} whileInView={{ width: '30%' }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.45 }} />
                                    <motion.div className={styles.allocationSegment} style={{ background: '#666' }}
                                        initial={{ width: 0 }} whileInView={{ width: '15%' }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.6 }} />
                                </div>
                                <div className={styles.allocationLegend}>
                                    {[
                                        { name: 'Active', color: '#00FFF0', value: '$23,375', pct: '55%' },
                                        { name: 'Repaying', color: '#FFA500', value: '$12,750', pct: '30%' },
                                        { name: 'Completed', color: '#666', value: '$6,375', pct: '15%' },
                                    ].map((item, i) => (
                                        <motion.div key={item.name} className={styles.legendItem}
                                            initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                            transition={{ duration: 0.4, ease, delay: 0.3 + i * 0.08 }}>
                                            <span className={styles.legendDot} style={{ background: item.color }} />
                                            <span className={styles.legendName}>{item.name}</span>
                                            <span className={styles.legendValue}>{item.value} ({item.pct})</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className={styles.ctaSection}>
                <motion.h2 className={styles.ctaTitle}
                    initial={prefersReduced ? false : { opacity: 0, y: 30, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: prefersReduced ? 0 : 0.6, ease }}>
                    Your investments, fully transparent.
                </motion.h2>
                <motion.p className={styles.ctaSubtitle}
                    initial={prefersReduced ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: prefersReduced ? 0 : 0.5, ease, delay: prefersReduced ? 0 : 0.1 }}>
                    Connect your wallet, see your positions, and claim yield — all in real time.
                </motion.p>
                <motion.div className={styles.ctaActions}
                    initial={prefersReduced ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: prefersReduced ? 0 : 0.5, ease, delay: prefersReduced ? 0 : 0.2 }}>
                    <motion.button
                        className={styles.launchBtn}
                        onClick={() => navigate('/waitlist')}
                        whileHover={prefersReduced ? {} : { scale: 1.06 }}
                        whileTap={prefersReduced ? {} : { scale: 0.97 }}
                    >
                        Launch App <ArrowRight size={18} />
                    </motion.button>
                    <a href="https://sepolia.basescan.org/address/0xf8fDa17F877dEFFCD80784E0465F33d585644360" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                        View on BaseScan <ExternalLink size={14} />
                    </a>
                </motion.div>
            </section>
        </div>
    )
}
