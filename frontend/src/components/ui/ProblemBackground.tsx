import React, { useRef, useEffect } from 'react'

interface ProblemBackgroundProps {
    activeProblem: number
    className?: string
}

interface CoinParticle {
    x: number
    y: number
    vy: number
    vx: number
    size: number
    alpha: number
    color: string
    rotation: number
    rotSpeed: number
}

interface GearState {
    cx: number
    cy: number
    r: number
    angle: number
    speed: number
    pulsePhase: number
}

interface GlitchPixel {
    x: number
    y: number
    alpha: number
    life: number
    maxLife: number
    color: string
    w: number
    h: number
}

export default function ProblemBackground({ activeProblem, className }: ProblemBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef = useRef({
        coins: [] as CoinParticle[],
        gears: [] as GearState[],
        glitchPixels: [] as GlitchPixel[],
        scanLineOffset: 0,
        themeAlpha: [1, 0, 0] as number[],
        frame: 0,
        initialized: false,
    })

    const activeProblemRef = useRef(activeProblem)
    activeProblemRef.current = activeProblem

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animId: number
        const s = stateRef.current

        function resize() {
            const rect = canvas!.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            canvas!.width = rect.width * dpr
            canvas!.height = rect.height * dpr
            ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        resize()
        window.addEventListener('resize', resize)

        if (!s.initialized) {
            const rect = canvas.getBoundingClientRect()
            const w = rect.width
            const h = rect.height

            for (let i = 0; i < 50; i++) {
                s.coins.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vy: 0.4 + Math.random() * 1.2,
                    vx: (Math.random() - 0.5) * 0.6,
                    size: 5 + Math.random() * 10,
                    alpha: 0.15 + Math.random() * 0.25,
                    color: ['#FFD700', '#CCAA00', '#FFB800', '#FFC830'][Math.floor(Math.random() * 4)],
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.03,
                })
            }

            const gearPositions = [
                { cx: 0.08, cy: 0.2 }, { cx: 0.92, cy: 0.25 },
                { cx: 0.05, cy: 0.55 }, { cx: 0.95, cy: 0.5 },
                { cx: 0.12, cy: 0.8 }, { cx: 0.88, cy: 0.75 },
                { cx: 0.18, cy: 0.4 }, { cx: 0.82, cy: 0.35 },
                { cx: 0.15, cy: 0.65 }, { cx: 0.85, cy: 0.6 },
            ]
            for (const gp of gearPositions) {
                s.gears.push({
                    cx: gp.cx, cy: gp.cy,
                    r: 20 + Math.random() * 35,
                    angle: Math.random() * Math.PI * 2,
                    speed: (0.005 + Math.random() * 0.008) * (Math.random() > 0.5 ? 1 : -1),
                    pulsePhase: Math.random() * Math.PI * 2,
                })
            }

            s.initialized = true
        }

        function drawCoin3DBg(x: number, y: number, sz: number, color: string, rotation: number) {
            const hw = sz
            const hh = sz * 0.45
            const squeeze = Math.abs(Math.cos(rotation))

            ctx!.fillStyle = '#997700'
            ctx!.beginPath()
            ctx!.ellipse(x, y + 2, hw * squeeze, hh, 0, 0, Math.PI * 2)
            ctx!.fill()

            ctx!.fillStyle = color
            ctx!.beginPath()
            ctx!.ellipse(x, y, hw * squeeze, hh, 0, 0, Math.PI * 2)
            ctx!.fill()

            ctx!.strokeStyle = '#000000'
            ctx!.lineWidth = 0.8
            ctx!.beginPath()
            ctx!.ellipse(x, y, hw * squeeze, hh, 0, 0, Math.PI * 2)
            ctx!.stroke()

            if (squeeze > 0.3) {
                ctx!.fillStyle = 'rgba(255, 255, 200, 0.4)'
                ctx!.beginPath()
                ctx!.ellipse(x - hw * 0.15 * squeeze, y - hh * 0.2, hw * 0.25 * squeeze, hh * 0.3, -0.3, 0, Math.PI * 2)
                ctx!.fill()
            }
        }

        function drawCoinTheme(w: number, h: number) {
            for (const coin of s.coins) {
                coin.y += coin.vy
                coin.x += coin.vx + Math.sin(s.frame * 0.015 + coin.x * 0.008) * 0.4
                coin.rotation += coin.rotSpeed

                if (coin.y > h + 15) {
                    coin.y = -15
                    coin.x = Math.random() * w
                }

                ctx!.globalAlpha = coin.alpha
                drawCoin3DBg(coin.x, coin.y, coin.size, coin.color, coin.rotation)
            }

            const shimmer = Math.sin(s.frame * 0.02) * 0.06 + 0.08
            ctx!.globalAlpha = shimmer
            const grad = ctx!.createLinearGradient(0, 0, w, h)
            grad.addColorStop(0, 'transparent')
            grad.addColorStop(0.3, '#FFD70015')
            grad.addColorStop(0.5, '#FFD70025')
            grad.addColorStop(0.7, '#FFD70015')
            grad.addColorStop(1, 'transparent')
            ctx!.fillStyle = grad
            ctx!.fillRect(0, 0, w, h)

            ctx!.globalAlpha = 1
        }

        function drawGearTeeth(cx: number, cy: number, r: number, angle: number, teeth: number) {
            ctx!.beginPath()
            for (let i = 0; i < teeth; i++) {
                const a = angle + (i / teeth) * Math.PI * 2
                const innerR = r * 0.72
                const outerR = r
                const toothWidth = Math.PI / teeth * 0.55

                ctx!.moveTo(
                    cx + Math.cos(a - toothWidth) * innerR,
                    cy + Math.sin(a - toothWidth) * innerR
                )
                ctx!.lineTo(
                    cx + Math.cos(a - toothWidth * 0.6) * outerR,
                    cy + Math.sin(a - toothWidth * 0.6) * outerR
                )
                ctx!.lineTo(
                    cx + Math.cos(a + toothWidth * 0.6) * outerR,
                    cy + Math.sin(a + toothWidth * 0.6) * outerR
                )
                ctx!.lineTo(
                    cx + Math.cos(a + toothWidth) * innerR,
                    cy + Math.sin(a + toothWidth) * innerR
                )
            }
            ctx!.closePath()
        }

        function drawVaultTheme(w: number, h: number) {
            for (const gear of s.gears) {
                gear.angle += gear.speed
                gear.pulsePhase += 0.02

                const gx = gear.cx * w
                const gy = gear.cy * h
                const teeth = Math.floor(gear.r / 4) + 6
                const pulse = 0.15 + Math.sin(gear.pulsePhase) * 0.08

                ctx!.globalAlpha = pulse
                ctx!.strokeStyle = '#888899'
                ctx!.lineWidth = 2
                drawGearTeeth(gx, gy, gear.r, gear.angle, teeth)
                ctx!.stroke()

                ctx!.beginPath()
                ctx!.arc(gx, gy, gear.r * 0.4, 0, Math.PI * 2)
                ctx!.stroke()

                ctx!.beginPath()
                ctx!.arc(gx, gy, gear.r * 0.15, 0, Math.PI * 2)
                ctx!.fillStyle = '#666677'
                ctx!.globalAlpha = pulse * 0.7
                ctx!.fill()
            }

            const ringPositions = [
                { cx: 0.1, cy: 0.35 }, { cx: 0.9, cy: 0.55 },
                { cx: 0.07, cy: 0.7 }, { cx: 0.93, cy: 0.3 },
            ]
            for (const rp of ringPositions) {
                const rx = rp.cx * w
                const ry = rp.cy * h
                const basePulse = Math.sin(s.frame * 0.025 + rp.cx * 10) * 0.08 + 0.12
                for (let ring = 0; ring < 4; ring++) {
                    const r = 15 + ring * 14 + Math.sin(s.frame * 0.02 + ring) * 4
                    ctx!.globalAlpha = basePulse * (1 - ring * 0.2)
                    ctx!.strokeStyle = ring % 2 === 0 ? '#888899' : '#666677'
                    ctx!.lineWidth = 1.5
                    ctx!.beginPath()
                    ctx!.arc(rx, ry, r, 0, Math.PI * 2)
                    ctx!.stroke()
                }
            }

            const chainY = h * 0.5
            const chainAlpha = 0.06 + Math.sin(s.frame * 0.03) * 0.03
            ctx!.globalAlpha = chainAlpha
            ctx!.strokeStyle = '#777788'
            ctx!.lineWidth = 1
            for (let x = 0; x < w; x += 30) {
                const yOff = Math.sin(s.frame * 0.01 + x * 0.05) * 8
                ctx!.beginPath()
                ctx!.ellipse(x, chainY + yOff, 8, 4, 0, 0, Math.PI * 2)
                ctx!.stroke()
            }

            ctx!.globalAlpha = 1
        }

        function drawGlitchTheme(w: number, h: number) {
            if (s.glitchPixels.length < 80 && Math.random() < 0.6) {
                const count = 1 + Math.floor(Math.random() * 3)
                for (let n = 0; n < count; n++) {
                    s.glitchPixels.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        alpha: 0.2 + Math.random() * 0.35,
                        life: 0,
                        maxLife: 15 + Math.random() * 35,
                        color: ['#FF2266', '#FF7EB3', '#E6457A', '#00FFFF', '#FF5C00'][Math.floor(Math.random() * 5)],
                        w: 3 + Math.random() * 8,
                        h: 2 + Math.random() * 5,
                    })
                }
            }

            s.scanLineOffset = (s.scanLineOffset + 2) % 6

            for (let y = s.scanLineOffset; y < h; y += 6) {
                const intensity = Math.sin(s.frame * 0.04 + y * 0.08)
                ctx!.globalAlpha = 0.06 + intensity * 0.04
                ctx!.fillStyle = intensity > 0 ? '#FF2266' : '#FF5C00'
                ctx!.fillRect(0, y, w, 1)
            }

            for (let i = s.glitchPixels.length - 1; i >= 0; i--) {
                const gp = s.glitchPixels[i]
                gp.life++

                if (gp.life > gp.maxLife) {
                    s.glitchPixels.splice(i, 1)
                    continue
                }

                const lifeFrac = gp.life / gp.maxLife
                const fadeAlpha = lifeFrac < 0.15 ? lifeFrac / 0.15 : lifeFrac > 0.6 ? (1 - lifeFrac) / 0.4 : 1

                ctx!.globalAlpha = gp.alpha * fadeAlpha
                ctx!.fillStyle = gp.color
                ctx!.fillRect(gp.x, gp.y, gp.w, gp.h)

                if (Math.random() < 0.2) {
                    ctx!.globalAlpha = gp.alpha * fadeAlpha * 0.5
                    ctx!.fillRect(gp.x + (Math.random() - 0.5) * 50, gp.y, gp.w * 0.6, gp.h * 0.6)
                }
            }

            if (Math.random() < 0.15) {
                const stripeY = Math.random() * h
                const stripeH = 3 + Math.random() * 10
                ctx!.globalAlpha = 0.1 + Math.random() * 0.1
                ctx!.fillStyle = Math.random() > 0.5 ? '#00FFFF' : '#FF2266'
                ctx!.fillRect(0, stripeY, w, stripeH)
            }

            if (Math.random() < 0.08) {
                const blockX = Math.random() * w
                const blockW = 20 + Math.random() * 60
                const blockY = Math.random() * h
                const blockH = 5 + Math.random() * 15
                ctx!.globalAlpha = 0.08 + Math.random() * 0.07
                ctx!.fillStyle = '#FF2266'
                ctx!.fillRect(blockX, blockY, blockW, blockH)
            }

            const warningPulse = Math.sin(s.frame * 0.06)
            if (warningPulse > 0.7) {
                ctx!.globalAlpha = (warningPulse - 0.7) * 0.15
                ctx!.fillStyle = '#FF0000'
                ctx!.fillRect(0, 0, w, h)
            }

            ctx!.globalAlpha = 1
        }

        function animate() {
            s.frame++
            const rect = canvas!.getBoundingClientRect()
            const w = rect.width
            const h = rect.height

            ctx!.clearRect(0, 0, w, h)

            const target = activeProblemRef.current
            for (let i = 0; i < 3; i++) {
                if (i === target) {
                    s.themeAlpha[i] = Math.min(1, s.themeAlpha[i] + 0.025)
                } else {
                    s.themeAlpha[i] = Math.max(0, s.themeAlpha[i] - 0.025)
                }
            }

            if (s.themeAlpha[0] > 0.01) {
                ctx!.save()
                ctx!.globalAlpha = s.themeAlpha[0]
                drawCoinTheme(w, h)
                ctx!.restore()
            }

            if (s.themeAlpha[1] > 0.01) {
                ctx!.save()
                ctx!.globalAlpha = s.themeAlpha[1]
                drawVaultTheme(w, h)
                ctx!.restore()
            }

            if (s.themeAlpha[2] > 0.01) {
                ctx!.save()
                ctx!.globalAlpha = s.themeAlpha[2]
                drawGlitchTheme(w, h)
                ctx!.restore()
            }

            animId = requestAnimationFrame(animate)
        }

        animate()
        return () => {
            cancelAnimationFrame(animId)
            window.removeEventListener('resize', resize)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    )
}
