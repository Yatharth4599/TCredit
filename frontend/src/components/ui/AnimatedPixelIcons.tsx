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

const COIN_PALETTE: Record<string, string> = {
    'B': '#000000',
    'G': '#FFD700',
    'Y': '#CCAA00',
    'D': '#997700',
    'S': '#664400',
}

const COIN_ROW_TOP = 'BGGGGGGGGB'
const COIN_ROW_MID = 'BGYYYYYGB.'
const COIN_ROW_BOT = 'BDDDDDDDB.'
const COIN_ROW_RIM = 'BBBBBBBBBB'

function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, tilt = 0) {
    const w = 10
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(tilt)

    ctx.fillStyle = '#000000'
    ctx.fillRect(-w / 2 * PX, -1 * PX, w * PX, PX)

    ctx.fillStyle = '#FFD700'
    ctx.fillRect((-w / 2 + 1) * PX, -1 * PX, (w - 2) * PX, PX)

    ctx.fillStyle = '#000000'
    ctx.fillRect(-w / 2 * PX, 0, w * PX, PX)
    ctx.fillStyle = '#CCAA00'
    ctx.fillRect((-w / 2 + 1) * PX, 0, (w - 2) * PX, PX)

    ctx.fillStyle = '#000000'
    ctx.fillRect(-w / 2 * PX, PX, w * PX, PX)
    ctx.fillStyle = '#997700'
    ctx.fillRect((-w / 2 + 1) * PX, PX, (w - 2) * PX, PX)

    ctx.fillStyle = '#000000'
    ctx.fillRect(-w / 2 * PX, 2 * PX, w * PX, PX)

    ctx.restore()
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

        interface FallenCoin {
            x: number; y: number; vx: number; vy: number; tilt: number; vtilt: number
        }

        let fallenCoins: FallenCoin[] = []

        function animate() {
            frame++
            ctx!.clearRect(0, 0, 128, 128)

            const cycle = frame % 360

            const coinCount = 6
            const baseX = 64
            const baseY = 108
            const coinH = 4 * PX

            if (cycle < 120) {
                const wobble = Math.sin(cycle * 0.08) * Math.min(cycle / 60, 1) * 0.5
                for (let i = 0; i < coinCount; i++) {
                    const y = baseY - i * coinH
                    const tiltFactor = (i / coinCount) * wobble * 0.06
                    drawCoin(ctx!, baseX + Math.sin(cycle * 0.1 + i * 0.3) * wobble * i * 0.5, y, tiltFactor)
                }
            } else if (cycle === 120) {
                fallenCoins = []
                for (let i = 0; i < coinCount; i++) {
                    const y = baseY - i * coinH
                    fallenCoins.push({
                        x: baseX,
                        y: y,
                        vx: (1 + Math.random() * 2) * (i % 2 === 0 ? 1 : -0.6),
                        vy: -(2 + Math.random() * 3) - i * 0.5,
                        tilt: 0,
                        vtilt: (Math.random() - 0.5) * 0.15,
                    })
                }
            } else if (cycle < 260) {
                for (const c of fallenCoins) {
                    c.x += c.vx
                    c.y += c.vy
                    c.vy += 0.25
                    c.tilt += c.vtilt

                    if (c.y > baseY + 4) {
                        c.y = baseY + 4
                        c.vy = -c.vy * 0.3
                        c.vx *= 0.7
                        c.vtilt *= 0.5
                    }

                    drawCoin(ctx!, c.x, c.y, c.tilt)
                }
            } else if (cycle < 320) {
                const t = (cycle - 260) / 60
                const fadeAlpha = 1 - t
                ctx!.globalAlpha = fadeAlpha
                for (const c of fallenCoins) {
                    drawCoin(ctx!, c.x, c.y, c.tilt)
                }
                ctx!.globalAlpha = 1

                const buildAlpha = t
                ctx!.globalAlpha = buildAlpha
                const visibleCoins = Math.floor(t * coinCount)
                for (let i = 0; i < visibleCoins; i++) {
                    const y = baseY - i * coinH
                    drawCoin(ctx!, baseX, y, 0)
                }
                ctx!.globalAlpha = 1
            } else {
                for (let i = 0; i < coinCount; i++) {
                    const y = baseY - i * coinH
                    drawCoin(ctx!, baseX, y, 0)
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

const LOCK_PALETTE: Record<string, string> = {
    'B': '#000000',
    'L': '#FF7EB3',
    'M': '#E6457A',
    'D': '#B8255A',
    'S': '#7A1038',
    'G': '#FFD700',
    'Y': '#CCAA00',
}

const LOCK_ROWS = [
    '................................',
    '................................',
    '...........BBBBBBB.............',
    '..........BMMMMMMB.............',
    '.........BMBB..BBMB............',
    '.........BMB....BMB............',
    '.........BMB....BMB............',
    '.........BMB....BMB............',
    '........BBBBBBBBBBBB...........',
    '........BMMMMMMMMMMMB..........',
    '........BMMMMMMMMMMMMB.........',
    '........BMMMMMMMMMMMMB.........',
    '........BMMMMMBBMMMMMB.........',
    '........BMMMMB$$BMMMMB.........',
    '........BMMMMB$$BMMMMB.........',
    '........BMMMMMBBMMMMMB.........',
    '........BMMMMMMMMMMMMB.........',
    '........BMMMMMMMMMMMMB.........',
    '........BDDDDDDDDDDDB.........',
    '........BBBBBBBBBBBBBB.........',
    '................................',
    '................................',
]

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

        function animate() {
            frame++
            ctx!.clearRect(0, 0, 128, 128)

            const cycle = frame % 240

            const currentPalette = { ...LOCK_PALETTE }

            const pulsePhase = Math.sin(frame * 0.04)
            const keyR = Math.floor(255 * (0.8 + pulsePhase * 0.2))
            const keyG = Math.floor(215 * (0.8 + pulsePhase * 0.2))
            currentPalette['$'] = `rgb(${keyR}, ${keyG}, 0)`

            let glitchOffsetX = 0
            let glitchOffsetY = 0

            if (cycle > 120 && cycle < 160) {
                const intensity = Math.sin((cycle - 120) / 40 * Math.PI)
                glitchOffsetX = Math.floor(Math.sin(frame * 2.7) * 3 * intensity)
                glitchOffsetY = Math.floor(Math.cos(frame * 1.9) * 1.5 * intensity)
            }

            ctx!.save()
            ctx!.translate(glitchOffsetX, glitchOffsetY)

            drawPixelGrid(ctx!, LOCK_ROWS, currentPalette)

            if (cycle > 120 && cycle < 160) {
                const t = (cycle - 120) / 40
                const intensity = Math.sin(t * Math.PI)

                ctx!.globalAlpha = intensity * 0.3
                ctx!.fillStyle = '#FF2266'
                const sliceY = 8 * PX + Math.floor(Math.sin(frame * 0.7) * 3) * PX
                ctx!.fillRect(8 * PX + glitchOffsetX * 0.5, sliceY, 14 * PX, 2 * PX)

                ctx!.globalAlpha = intensity * 0.2
                ctx!.fillStyle = '#00FFFF'
                ctx!.fillRect(8 * PX - glitchOffsetX * 0.3, sliceY + 4 * PX, 14 * PX, 1 * PX)
                ctx!.globalAlpha = 1

                const scanlineY = ((frame * 2) % 88) + 8
                ctx!.globalAlpha = 0.08 * intensity
                ctx!.fillStyle = '#FFFFFF'
                ctx!.fillRect(0, scanlineY, 128, 2)
                ctx!.globalAlpha = 1
            }

            ctx!.restore()

            ctx!.globalAlpha = 0.06 + Math.sin(frame * 0.03) * 0.03
            ctx!.fillStyle = '#E6457A'
            const glowX = 13 * PX
            const glowY = 13 * PX
            ctx!.fillRect(glowX - 3 * PX, glowY - 3 * PX, 8 * PX, 8 * PX)
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
