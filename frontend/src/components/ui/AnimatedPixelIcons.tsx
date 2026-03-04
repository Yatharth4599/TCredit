import React, { useRef, useEffect } from 'react'

interface AnimatedIconProps {
    size?: number
    className?: string
    style?: React.CSSProperties
}

const PX = 4

function drawPixelGrid(
    ctx: CanvasRenderingContext2D,
    rows: string[],
    palette: Record<string, string>,
    offsetX = 0,
    offsetY = 0,
    cellSize = PX
) {
    for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
            const ch = rows[y][x]
            if (ch === '.' || !palette[ch]) continue
            ctx.fillStyle = palette[ch]
            ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize)
        }
    }
}

function drawCoin3D(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
    const hw = w / 2
    const thickness = 3

    ctx.fillStyle = '#997700'
    ctx.beginPath()
    ctx.ellipse(cx, cy + thickness, hw, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#664400'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#CCAA00'
    ctx.fillRect(cx - hw, cy, w, thickness)
    ctx.fillStyle = '#997700'
    ctx.fillRect(cx - hw, cy + 1, 1, thickness)
    ctx.fillRect(cx + hw - 1, cy + 1, 1, thickness)

    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    ctx.ellipse(cx, cy, hw, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#CCAA00'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#FFEE66'
    ctx.beginPath()
    ctx.ellipse(cx, cy - 1, hw * 0.5, h * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#CCAA00'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.ellipse(cx, cy, hw * 0.65, h * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#CCAA00'
    ctx.font = 'bold 5px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('$', cx, cy + 0.5)
}

function drawStack(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, count: number, coinW: number, coinH: number, spacing: number, wobbleOffset: number, wobbleAmt: number) {
    for (let i = 0; i < count; i++) {
        const y = baseY - i * spacing
        const xOff = Math.sin(wobbleOffset + i * 0.4) * wobbleAmt * (i / Math.max(count - 1, 1))
        drawCoin3D(ctx, baseX + xOff, y, coinW, coinH)
    }
}

interface FallenCoin3D {
    x: number; y: number; vx: number; vy: number; rot: number; vrot: number; w: number; h: number
}

export function AnimatedCoinStackIcon({ size = 96, className, style }: AnimatedIconProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = 128
        canvas.height = 128

        let frame = 0
        let animId: number

        const stacks = [
            { x: 30, count: 4, coinW: 22, coinH: 10 },
            { x: 64, count: 6, coinW: 24, coinH: 11 },
            { x: 98, count: 3, coinW: 20, coinH: 9 },
        ]
        const baseY = 112
        const spacing = 8

        let fallenCoins: FallenCoin3D[] = []
        let dustParticles: { x: number; y: number; vx: number; vy: number; life: number; alpha: number }[] = []

        function animate() {
            frame++
            ctx!.clearRect(0, 0, 128, 128)

            const cycle = frame % 400

            if (cycle < 140) {
                const wobbleAmt = Math.sin(cycle * 0.06) * Math.min(cycle / 70, 1) * 1.2
                const wobblePhase = cycle * 0.12

                for (const st of stacks) {
                    drawStack(ctx!, st.x, baseY, st.count, st.coinW, st.coinH, spacing, wobblePhase, wobbleAmt)
                }

                if (cycle > 80) {
                    const shakeIntensity = ((cycle - 80) / 60) * 0.5
                    ctx!.save()
                    ctx!.translate(
                        Math.sin(cycle * 0.8) * shakeIntensity,
                        Math.cos(cycle * 1.1) * shakeIntensity * 0.3
                    )
                    ctx!.restore()
                }
            } else if (cycle === 140) {
                fallenCoins = []
                dustParticles = []
                for (const st of stacks) {
                    for (let i = 0; i < st.count; i++) {
                        const y = baseY - i * spacing
                        const direction = st.x < 64 ? -1 : st.x > 64 ? 1 : (Math.random() > 0.5 ? 1 : -1)
                        fallenCoins.push({
                            x: st.x,
                            y: y,
                            vx: direction * (0.8 + Math.random() * 1.8) + (Math.random() - 0.5) * 0.5,
                            vy: -(1.5 + Math.random() * 2.5) - i * 0.6,
                            rot: 0,
                            vrot: (Math.random() - 0.5) * 0.08,
                            w: st.coinW,
                            h: st.coinH,
                        })
                    }
                    for (let d = 0; d < 3; d++) {
                        dustParticles.push({
                            x: st.x + (Math.random() - 0.5) * 10,
                            y: baseY,
                            vx: (Math.random() - 0.5) * 2,
                            vy: -(1 + Math.random() * 2),
                            life: 30 + Math.random() * 20,
                            alpha: 0.3,
                        })
                    }
                }
            } else if (cycle < 290) {
                for (const c of fallenCoins) {
                    c.x += c.vx
                    c.y += c.vy
                    c.vy += 0.18
                    c.rot += c.vrot

                    if (c.y > baseY + 2) {
                        c.y = baseY + 2
                        c.vy = -c.vy * 0.25
                        c.vx *= 0.6
                        c.vrot *= 0.4
                        if (Math.abs(c.vy) > 0.5) {
                            dustParticles.push({
                                x: c.x,
                                y: baseY,
                                vx: (Math.random() - 0.5) * 1,
                                vy: -(0.5 + Math.random()),
                                life: 15 + Math.random() * 10,
                                alpha: 0.15,
                            })
                        }
                    }

                    ctx!.save()
                    ctx!.translate(c.x, c.y)
                    ctx!.rotate(c.rot)
                    drawCoin3D(ctx!, 0, 0, c.w, c.h)
                    ctx!.restore()
                }

                for (let i = dustParticles.length - 1; i >= 0; i--) {
                    const p = dustParticles[i]
                    p.x += p.vx
                    p.y += p.vy
                    p.vy += 0.05
                    p.life--
                    if (p.life <= 0) { dustParticles.splice(i, 1); continue }
                    ctx!.globalAlpha = p.alpha * (p.life / 30)
                    ctx!.fillStyle = '#CCAA00'
                    ctx!.fillRect(p.x - 1, p.y - 1, 2, 2)
                }
                ctx!.globalAlpha = 1
            } else if (cycle < 360) {
                const t = (cycle - 290) / 70
                const fadeAlpha = 1 - t
                ctx!.globalAlpha = fadeAlpha
                for (const c of fallenCoins) {
                    ctx!.save()
                    ctx!.translate(c.x, c.y)
                    ctx!.rotate(c.rot)
                    drawCoin3D(ctx!, 0, 0, c.w, c.h)
                    ctx!.restore()
                }
                ctx!.globalAlpha = 1

                const buildAlpha = t
                ctx!.globalAlpha = buildAlpha
                for (const st of stacks) {
                    const visibleCoins = Math.floor(t * st.count)
                    for (let i = 0; i < visibleCoins; i++) {
                        const y = baseY - i * spacing
                        drawCoin3D(ctx!, st.x, y, st.coinW, st.coinH)
                    }
                }
                ctx!.globalAlpha = 1
            } else {
                for (const st of stacks) {
                    drawStack(ctx!, st.x, baseY, st.count, st.coinW, st.coinH, spacing, 0, 0)
                }
            }

            animId = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animId)
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ ...style, width: size, height: size, imageRendering: 'pixelated' }}
        />
    )
}

const VAULT_PALETTE: Record<string, string> = {
    'B': '#000000',
    'M': '#666677',
    'L': '#888899',
    'D': '#444455',
    'S': '#222233',
    'H': '#AAAABB',
    'R': '#FF2222',
    'G': '#22FF55',
}

const VAULT_BODY_ROWS = [
    '................................',
    '................................',
    '....BBBBBBBBBBBBBBBBBBBB........',
    '....BLLLLLLLLLLLLLLLLLLB........',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLMMMMMMMMMMMMMMMMLB.......',
    '....BLLLLLLLLLLLLLLLLLLB........',
    '....BDDDDDDDDDDDDDDDDDB.......',
    '....BBBBBBBBBBBBBBBBBBBB........',
    '................................',
]

export function AnimatedVaultIcon({ size = 96, className, style }: AnimatedIconProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = 128
        canvas.height = 128

        let frame = 0
        let animId: number

        function drawVaultBody() {
            drawPixelGrid(ctx!, VAULT_BODY_ROWS, VAULT_PALETTE)
        }

        function drawDoor(openFrac: number) {
            const doorLeft = 9 * PX
            const doorTop = 4 * PX
            const doorFullW = 14 * PX
            const doorH = 16 * PX

            const doorW = doorFullW * (1 - openFrac * 0.85)
            const doorX = doorLeft + doorFullW - doorW

            ctx!.fillStyle = '#555566'
            ctx!.fillRect(doorX, doorTop, doorW, doorH)

            ctx!.fillStyle = '#444455'
            ctx!.fillRect(doorX, doorTop, doorW, PX)
            ctx!.fillRect(doorX, doorTop + doorH - PX, doorW, PX)
            ctx!.fillRect(doorX, doorTop, PX, doorH)

            if (openFrac < 0.3) {
                const handleCX = doorX + doorW * 0.5
                const handleCY = doorTop + doorH * 0.5
                const handleR = Math.min(doorW, doorH) * 0.22

                ctx!.strokeStyle = '#AAAABB'
                ctx!.lineWidth = 2
                ctx!.beginPath()
                ctx!.arc(handleCX, handleCY, handleR, 0, Math.PI * 2)
                ctx!.stroke()

                ctx!.strokeStyle = '#888899'
                ctx!.lineWidth = 1.5
                const spoke = handleR * 0.7
                for (let a = 0; a < 4; a++) {
                    const angle = (a / 4) * Math.PI * 2 + frame * 0.02
                    ctx!.beginPath()
                    ctx!.moveTo(handleCX, handleCY)
                    ctx!.lineTo(handleCX + Math.cos(angle) * spoke, handleCY + Math.sin(angle) * spoke)
                    ctx!.stroke()
                }

                const lockY = handleCY + handleR + 6
                ctx!.fillStyle = '#FF2222'
                ctx!.fillRect(handleCX - 2 * PX, lockY, 4 * PX, 2 * PX)
            }

            if (openFrac > 0.2) {
                const glowAlpha = Math.min(1, (openFrac - 0.2) / 0.3) * 0.4
                ctx!.globalAlpha = glowAlpha
                ctx!.fillStyle = '#22FF55'
                ctx!.fillRect(doorLeft, doorTop + 2 * PX, doorFullW * openFrac * 0.5, doorH - 4 * PX)
                ctx!.globalAlpha = 1
            }
        }

        function animate() {
            frame++
            ctx!.clearRect(0, 0, 128, 128)

            const cycle = frame % 300

            let openFrac = 0
            let shakeX = 0
            let shakeY = 0
            let flashAlpha = 0

            if (cycle < 80) {
                openFrac = 0.8
            } else if (cycle < 110) {
                const t = (cycle - 80) / 30
                const ease = t * t * t
                openFrac = 0.8 * (1 - ease)
            } else if (cycle === 110) {
                flashAlpha = 0.3
            } else if (cycle < 130) {
                const t = (cycle - 110) / 20
                openFrac = 0
                shakeX = Math.sin(t * Math.PI * 6) * 3 * (1 - t)
                shakeY = Math.cos(t * Math.PI * 4) * 1.5 * (1 - t)
                flashAlpha = Math.max(0, 0.3 - t * 0.5)
            } else if (cycle < 220) {
                openFrac = 0
            } else if (cycle < 260) {
                const t = (cycle - 220) / 40
                const ease = 1 - (1 - t) * (1 - t)
                openFrac = ease * 0.8
            } else {
                openFrac = 0.8
            }

            ctx!.save()
            ctx!.translate(shakeX, shakeY)

            drawVaultBody()
            drawDoor(openFrac)

            if (flashAlpha > 0) {
                ctx!.globalAlpha = flashAlpha
                ctx!.fillStyle = '#FFFFFF'
                ctx!.fillRect(0, 0, 128, 128)
                ctx!.globalAlpha = 1
            }

            ctx!.restore()

            animId = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animId)
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ ...style, width: size, height: size, imageRendering: 'pixelated' }}
        />
    )
}

export function AnimatedLockIcon({ size = 96, className, style }: AnimatedIconProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = 128
        canvas.height = 128

        let frame = 0
        let animId: number

        function drawShackle(cx: number, topY: number, w: number, h: number, liftAmount: number) {
            const outerW = w
            const outerH = h
            const thickness = 4

            ctx!.strokeStyle = '#888899'
            ctx!.lineWidth = thickness + 2
            ctx!.beginPath()
            ctx!.arc(cx, topY + outerH - liftAmount, outerW / 2, Math.PI, 0)
            ctx!.stroke()

            ctx!.strokeStyle = '#AAAABB'
            ctx!.lineWidth = thickness
            ctx!.beginPath()
            ctx!.arc(cx, topY + outerH - liftAmount, outerW / 2, Math.PI, 0)
            ctx!.stroke()

            ctx!.fillStyle = '#AAAABB'
            ctx!.fillRect(cx - outerW / 2 - thickness / 2, topY + outerH - liftAmount, thickness, liftAmount + 2)
            ctx!.fillRect(cx + outerW / 2 - thickness / 2, topY + outerH - liftAmount, thickness, liftAmount + 2)

            ctx!.fillStyle = '#666677'
            ctx!.fillRect(cx - outerW / 2 - thickness / 2 - 1, topY + outerH - liftAmount, 1, liftAmount + 2)
            ctx!.fillRect(cx + outerW / 2 + thickness / 2, topY + outerH - liftAmount, 1, liftAmount + 2)
        }

        function drawBody(cx: number, topY: number, w: number, h: number) {
            ctx!.fillStyle = '#333344'
            ctx!.fillRect(cx - w / 2 + 1, topY + 1, w - 2, h)

            ctx!.fillStyle = '#555566'
            ctx!.fillRect(cx - w / 2, topY, w, h)

            ctx!.fillStyle = '#666677'
            ctx!.fillRect(cx - w / 2, topY, w, 3)
            ctx!.fillRect(cx - w / 2, topY, 2, h)

            ctx!.fillStyle = '#444455'
            ctx!.fillRect(cx - w / 2, topY + h - 3, w, 3)
            ctx!.fillRect(cx + w / 2 - 2, topY, 2, h)

            ctx!.fillStyle = '#777788'
            ctx!.fillRect(cx - w / 2 + 2, topY + 2, w - 4, 1)
        }

        function drawKeyhole(cx: number, cy: number, pulsePhase: number) {
            const glow = 0.15 + Math.sin(pulsePhase) * 0.1
            ctx!.globalAlpha = glow
            ctx!.fillStyle = '#FF5C00'
            ctx!.beginPath()
            ctx!.arc(cx, cy - 2, 10, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.globalAlpha = 1

            ctx!.fillStyle = '#222233'
            ctx!.beginPath()
            ctx!.arc(cx, cy - 2, 5, 0, Math.PI * 2)
            ctx!.fill()

            ctx!.fillStyle = '#222233'
            ctx!.fillRect(cx - 2, cy + 1, 4, 10)

            ctx!.fillStyle = '#111122'
            ctx!.beginPath()
            ctx!.arc(cx, cy - 2, 3, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.fillRect(cx - 1, cy + 2, 2, 8)

            ctx!.fillStyle = '#FF5C00'
            ctx!.globalAlpha = 0.4 + Math.sin(pulsePhase * 2) * 0.2
            ctx!.beginPath()
            ctx!.arc(cx, cy - 2, 2, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.globalAlpha = 1
        }

        function drawScrews(cx: number, bodyTop: number, bodyW: number, bodyH: number) {
            const screwPositions = [
                { x: cx - bodyW / 2 + 6, y: bodyTop + 6 },
                { x: cx + bodyW / 2 - 6, y: bodyTop + 6 },
                { x: cx - bodyW / 2 + 6, y: bodyTop + bodyH - 6 },
                { x: cx + bodyW / 2 - 6, y: bodyTop + bodyH - 6 },
            ]
            for (const s of screwPositions) {
                ctx!.fillStyle = '#888899'
                ctx!.beginPath()
                ctx!.arc(s.x, s.y, 2.5, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.strokeStyle = '#666677'
                ctx!.lineWidth = 0.5
                ctx!.beginPath()
                ctx!.moveTo(s.x - 1.5, s.y - 1.5)
                ctx!.lineTo(s.x + 1.5, s.y + 1.5)
                ctx!.stroke()
            }
        }

        function animate() {
            frame++
            ctx!.clearRect(0, 0, 128, 128)

            const cycle = frame % 300

            const lockCX = 64
            const bodyW = 52
            const bodyH = 40
            const bodyTop = 60
            const shackleW = 30
            const shackleH = 20
            const shackleTopY = 28

            let shackleLift = 0
            let glitchX = 0
            let glitchY = 0
            let glitchIntensity = 0

            if (cycle < 60) {
                shackleLift = 0
            } else if (cycle < 90) {
                const t = (cycle - 60) / 30
                shackleLift = t * t * 18
                glitchIntensity = t * 0.3
            } else if (cycle < 130) {
                shackleLift = 18
                glitchIntensity = 0.6 + Math.sin(cycle * 0.3) * 0.3
            } else if (cycle < 160) {
                const t = (cycle - 130) / 30
                shackleLift = 18 * (1 - t * t)
                glitchIntensity = (1 - t) * 0.5
            } else if (cycle < 240) {
                shackleLift = 0
            } else if (cycle < 270) {
                const t = (cycle - 240) / 30
                glitchIntensity = Math.sin(t * Math.PI) * 0.8
            } else {
                shackleLift = 0
            }

            if (glitchIntensity > 0.05) {
                glitchX = Math.floor(Math.sin(frame * 2.7) * 3 * glitchIntensity)
                glitchY = Math.floor(Math.cos(frame * 1.9) * 1.5 * glitchIntensity)
            }

            ctx!.save()
            ctx!.translate(glitchX, glitchY)

            drawShackle(lockCX, shackleTopY, shackleW, shackleH, shackleLift)
            drawBody(lockCX, bodyTop, bodyW, bodyH)
            drawKeyhole(lockCX, bodyTop + bodyH * 0.45, frame * 0.04)
            drawScrews(lockCX, bodyTop, bodyW, bodyH)

            ctx!.restore()

            if (glitchIntensity > 0.1) {
                ctx!.globalAlpha = glitchIntensity * 0.25
                ctx!.fillStyle = '#FF2266'
                const sliceY1 = 50 + Math.floor(Math.sin(frame * 0.7) * 15)
                ctx!.fillRect(glitchX * 2, sliceY1, 128, 3)

                ctx!.fillStyle = '#00FFFF'
                const sliceY2 = 70 + Math.floor(Math.cos(frame * 0.5) * 12)
                ctx!.fillRect(-glitchX, sliceY2, 128, 2)

                for (let sl = 0; sl < 128; sl += 4) {
                    if (Math.random() < glitchIntensity * 0.15) {
                        ctx!.globalAlpha = glitchIntensity * 0.06
                        ctx!.fillStyle = '#FFFFFF'
                        ctx!.fillRect(0, sl, 128, 1)
                    }
                }
                ctx!.globalAlpha = 1

                const sparkCount = Math.floor(glitchIntensity * 6)
                for (let i = 0; i < sparkCount; i++) {
                    ctx!.fillStyle = ['#FF5C00', '#FF2266', '#00FFFF', '#FFD700'][i % 4]
                    ctx!.globalAlpha = 0.3 + Math.random() * 0.4
                    const sx = Math.random() * 128
                    const sy = Math.random() * 128
                    ctx!.fillRect(sx, sy, 2 + Math.random() * 3, 2)
                }
                ctx!.globalAlpha = 1
            }

            ctx!.globalAlpha = 0.04 + Math.sin(frame * 0.03) * 0.02
            ctx!.fillStyle = '#FF5C00'
            ctx!.beginPath()
            ctx!.arc(lockCX, bodyTop + bodyH * 0.45, 18, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.globalAlpha = 1

            animId = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animId)
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ ...style, width: size, height: size, imageRendering: 'pixelated' }}
        />
    )
}
