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

const SKULL_PALETTE: Record<string, string> = {
    'B': '#000000',
    'W': '#E8E8E8',
    'G': '#C0C0C0',
    'D': '#888888',
    'R': '#FF3333',
    'O': '#CC2222',
}

const SKULL_ROWS = [
    '................................',
    '................................',
    '..........BBBBBBBBBB...........',
    '.........BWWWWWWWWWWB..........',
    '........BWWWWWWWWWWWWB.........',
    '.......BWWWWWWWWWWWWWWB........',
    '.......BWWWWWWWWWWWWWWB........',
    '......BWWWWWWWWWWWWWWWB........',
    '......BWWWWWWWWWWWWWWWWB.......',
    '......BWWBBBBWWWWBBBBWWB.......',
    '......BWWB%%BWWWWB%%BWWB.......',
    '......BWWB%%BWWWWB%%BWWB.......',
    '......BWWBBBBWWWWBBBBWWB.......',
    '......BWWWWWWWWWWWWWWWWB.......',
    '.......BWWWWWWBBWWWWWWB........',
    '.......BWWWWWWBBWWWWWWB........',
    '........BWWWWWWWWWWWWB.........',
    '........BWGWBWBWBWGWB..........',
    '.........BGWBWBWBWGB...........',
    '..........BBBBBBBBBB...........',
    '................................',
    '................................',
]

const CHAIN_PALETTE: Record<string, string> = {
    'B': '#000000',
    'L': '#FFB86C',
    'M': '#FF8C42',
    'D': '#D4621A',
    'S': '#8B3E0F',
}

const CHAIN_LEFT_ROWS = [
    '................................',
    '................................',
    '.......BBBBB................... ',
    '......BLLLLBB..................',
    '.....BLLMMMLB..................',
    '.....BLMB.BMB..................',
    '.....BLMB.BMB..................',
    '.....BLMB.BMB..................',
    '.....BLLMMMLB..................',
    '......BDDDDBB.................',
    '.......BBBBBBB.................',
    '..........BBBBB................',
    '.........BLLLLBB...............',
    '........BLLMMMLB...............',
    '........BLMB.BMB...............',
    '........BLMB.BMB...............',
    '........BLMB.BMB...............',
    '........BLLMMMLB...............',
    '.........BDDDDBB..............',
    '..........BBBBB................',
    '................................',
    '................................',
]

const CHAIN_RIGHT_ROWS = [
    '................................',
    '................................',
    '...............BBBBB...........',
    '..............BLLLLBB..........',
    '.............BLLMMMLB..........',
    '.............BLMB.BMB..........',
    '.............BLMB.BMB..........',
    '.............BLMB.BMB..........',
    '.............BLLMMMLB..........',
    '..............BDDDDBB.........',
    '...............BBBBBBB.........',
    '..................BBBBB........',
    '.................BLLLLBB.......',
    '................BLLMMMLB.......',
    '................BLMB.BMB.......',
    '................BLMB.BMB.......',
    '................BLMB.BMB.......',
    '................BLLMMMLB.......',
    '.................BDDDDBB......',
    '..................BBBBB........',
    '................................',
    '................................',
]

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

export function AnimatedSkullIcon({ size = 96, className, style }: AnimatedIconProps) {
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

        const eyePositions = [
            { x: 9, y: 9, w: 4, h: 4 },
            { x: 17, y: 9, w: 4, h: 4 },
        ]

        function animate() {
            frame++
            ctx!.clearRect(0, 0, 128, 128)

            const blinkCycle = frame % 180
            const isBlinking = blinkCycle > 170 && blinkCycle <= 178

            const breathScale = Math.sin(frame * 0.03) * 0.5
            const bobY = Math.sin(frame * 0.02) * 1.5

            ctx!.save()
            ctx!.translate(0, bobY)

            const currentPalette = { ...SKULL_PALETTE }

            if (isBlinking) {
                currentPalette['%'] = '#000000'
            } else {
                const glowPhase = Math.sin(frame * 0.05)
                const r = Math.floor(255 - glowPhase * 30)
                const g = Math.floor(50 + glowPhase * 20)
                currentPalette['%'] = `rgb(${r}, ${g}, 50)`
            }

            drawPixelGrid(ctx!, SKULL_ROWS, currentPalette)

            if (!isBlinking) {
                const glowIntensity = (Math.sin(frame * 0.05) + 1) * 0.5
                ctx!.globalAlpha = 0.15 + glowIntensity * 0.15
                eyePositions.forEach(eye => {
                    ctx!.fillStyle = '#FF3333'
                    ctx!.fillRect(
                        (eye.x - 0.5) * PX,
                        (eye.y - 0.5 + breathScale * 0.3) * PX,
                        (eye.w + 1) * PX,
                        (eye.h + 1) * PX
                    )
                })
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

export function AnimatedChainIcon({ size = 96, className, style }: AnimatedIconProps) {
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

            const cycle = frame % 300

            let leftOffset = 0
            let rightOffset = 0
            let shakeX = 0
            let shakeY = 0
            let breakAlpha = 1

            if (cycle < 150) {
                const tension = Math.sin(cycle * 0.15) * Math.min(cycle / 50, 1)
                shakeX = tension * 1.5
                shakeY = Math.sin(cycle * 0.3) * tension * 0.5
            } else if (cycle < 200) {
                const t = (cycle - 150) / 50
                const ease = t * t
                leftOffset = -ease * 20
                rightOffset = ease * 20
                breakAlpha = 1 - t
            } else if (cycle < 260) {
                leftOffset = -20
                rightOffset = 20
                breakAlpha = 0
            } else {
                const t = (cycle - 260) / 40
                const ease = 1 - (1 - t) * (1 - t)
                leftOffset = -20 * (1 - ease)
                rightOffset = 20 * (1 - ease)
                breakAlpha = t
            }

            ctx!.save()
            ctx!.translate(shakeX, shakeY)

            ctx!.save()
            ctx!.translate(leftOffset, 0)
            drawPixelGrid(ctx!, CHAIN_LEFT_ROWS, CHAIN_PALETTE)
            ctx!.restore()

            ctx!.save()
            ctx!.translate(rightOffset, 0)
            drawPixelGrid(ctx!, CHAIN_RIGHT_ROWS, CHAIN_PALETTE)
            ctx!.restore()

            if (cycle >= 150 && cycle < 200) {
                const sparkCount = 4
                const t = (cycle - 150) / 50
                for (let i = 0; i < sparkCount; i++) {
                    const angle = (i / sparkCount) * Math.PI * 2 + frame * 0.1
                    const dist = t * 15
                    const sx = 64 + Math.cos(angle) * dist
                    const sy = 48 + Math.sin(angle) * dist
                    ctx!.globalAlpha = (1 - t) * 0.8
                    ctx!.fillStyle = '#FFB86C'
                    ctx!.fillRect(sx, sy, PX, PX)
                }
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
