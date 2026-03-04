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
}

interface GearState {
    cx: number
    cy: number
    r: number
    angle: number
    speed: number
}

interface GlitchPixel {
    x: number
    y: number
    alpha: number
    life: number
    maxLife: number
    color: string
}

export default function ProblemBackground({ activeProblem, className }: ProblemBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef = useRef({
        coins: [] as CoinParticle[],
        gears: [] as GearState[],
        glitchPixels: [] as GlitchPixel[],
        scanLineOffset: 0,
        currentTheme: 0,
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

            for (let i = 0; i < 25; i++) {
                s.coins.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vy: 0.3 + Math.random() * 0.8,
                    vx: (Math.random() - 0.5) * 0.3,
                    size: 3 + Math.random() * 5,
                    alpha: 0.05 + Math.random() * 0.12,
                    color: ['#FFD700', '#CCAA00', '#997700'][Math.floor(Math.random() * 3)],
                })
            }

            const gearPositions = [
                { cx: 0.12, cy: 0.3 }, { cx: 0.88, cy: 0.35 },
                { cx: 0.08, cy: 0.7 }, { cx: 0.92, cy: 0.65 },
                { cx: 0.15, cy: 0.5 }, { cx: 0.85, cy: 0.5 },
            ]
            for (const gp of gearPositions) {
                s.gears.push({
                    cx: gp.cx, cy: gp.cy,
                    r: 15 + Math.random() * 25,
                    angle: Math.random() * Math.PI * 2,
                    speed: (0.003 + Math.random() * 0.005) * (Math.random() > 0.5 ? 1 : -1),
                })
            }

            s.initialized = true
        }

        function spawnGlitchPixels(w: number, h: number) {
            if (s.glitchPixels.length < 40 && Math.random() < 0.3) {
                s.glitchPixels.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    alpha: 0.1 + Math.random() * 0.15,
                    life: 0,
                    maxLife: 20 + Math.random() * 40,
                    color: ['#FF2266', '#FF7EB3', '#E6457A', '#00FFFF'][Math.floor(Math.random() * 4)],
                })
            }
        }

        function drawCoinTheme(w: number, h: number) {
            for (const coin of s.coins) {
                coin.y += coin.vy
                coin.x += coin.vx + Math.sin(s.frame * 0.02 + coin.x * 0.01) * 0.2

                if (coin.y > h + 10) {
                    coin.y = -10
                    coin.x = Math.random() * w
                }

                ctx!.globalAlpha = coin.alpha
                ctx!.fillStyle = coin.color
                const sz = coin.size

                ctx!.fillRect(coin.x - sz, coin.y - sz * 0.3, sz * 2, sz * 0.6)
                ctx!.fillStyle = '#000000'
                ctx!.fillRect(coin.x - sz, coin.y - sz * 0.3, sz * 2, 1)
                ctx!.fillRect(coin.x - sz, coin.y + sz * 0.3, sz * 2, 1)
            }
            ctx!.globalAlpha = 1
        }

        function drawGearTeeth(cx: number, cy: number, r: number, angle: number, teeth: number) {
            ctx!.beginPath()
            for (let i = 0; i < teeth; i++) {
                const a = angle + (i / teeth) * Math.PI * 2
                const innerR = r * 0.75
                const outerR = r
                const toothWidth = Math.PI / teeth * 0.6

                ctx!.moveTo(
                    cx + Math.cos(a - toothWidth) * innerR,
                    cy + Math.sin(a - toothWidth) * innerR
                )
                ctx!.lineTo(
                    cx + Math.cos(a - toothWidth * 0.7) * outerR,
                    cy + Math.sin(a - toothWidth * 0.7) * outerR
                )
                ctx!.lineTo(
                    cx + Math.cos(a + toothWidth * 0.7) * outerR,
                    cy + Math.sin(a + toothWidth * 0.7) * outerR
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

                const gx = gear.cx * w
                const gy = gear.cy * h
                const teeth = Math.floor(gear.r / 4) + 6

                ctx!.globalAlpha = 0.08
                ctx!.strokeStyle = '#666677'
                ctx!.lineWidth = 1.5
                drawGearTeeth(gx, gy, gear.r, gear.angle, teeth)
                ctx!.stroke()

                ctx!.beginPath()
                ctx!.arc(gx, gy, gear.r * 0.4, 0, Math.PI * 2)
                ctx!.stroke()
            }

            const pulse = Math.sin(s.frame * 0.03) * 0.03 + 0.05
            const ringPositions = [
                { cx: 0.1, cy: 0.4 }, { cx: 0.9, cy: 0.6 },
            ]
            for (const rp of ringPositions) {
                const rx = rp.cx * w
                const ry = rp.cy * h
                for (let ring = 0; ring < 3; ring++) {
                    const r = 20 + ring * 12 + Math.sin(s.frame * 0.02 + ring) * 3
                    ctx!.globalAlpha = pulse * (1 - ring * 0.25)
                    ctx!.strokeStyle = '#888899'
                    ctx!.lineWidth = 1
                    ctx!.beginPath()
                    ctx!.arc(rx, ry, r, 0, Math.PI * 2)
                    ctx!.stroke()
                }
            }

            ctx!.globalAlpha = 1
        }

        function drawGlitchTheme(w: number, h: number) {
            spawnGlitchPixels(w, h)

            s.scanLineOffset = (s.scanLineOffset + 1.5) % 8

            for (let y = s.scanLineOffset; y < h; y += 8) {
                ctx!.globalAlpha = 0.03 + Math.sin(s.frame * 0.05 + y * 0.1) * 0.015
                ctx!.fillStyle = '#FF2266'
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
                const fadeAlpha = lifeFrac < 0.2 ? lifeFrac / 0.2 : lifeFrac > 0.7 ? (1 - lifeFrac) / 0.3 : 1

                ctx!.globalAlpha = gp.alpha * fadeAlpha
                ctx!.fillStyle = gp.color
                const sz = 2 + Math.random() * 4
                ctx!.fillRect(gp.x, gp.y, sz, sz)

                if (Math.random() < 0.1) {
                    ctx!.fillRect(gp.x + (Math.random() - 0.5) * 30, gp.y, sz * 0.5, sz * 0.5)
                }
            }

            if (Math.random() < 0.05) {
                const stripeY = Math.random() * h
                const stripeH = 2 + Math.random() * 6
                ctx!.globalAlpha = 0.06
                ctx!.fillStyle = '#00FFFF'
                ctx!.fillRect(0, stripeY, w, stripeH)
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
