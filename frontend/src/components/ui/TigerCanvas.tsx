import React, { useRef, useEffect } from 'react'

const ACCENT_LEFT = ['#FF8C42', '#FF6B6B', '#FFAAAA', '#FF9B8C']
const ACCENT_RIGHT = ['#40E0D0', '#80F0E8', '#A8F0F0', '#88D8E8']
const WHITES = ['#FFFFFF', '#E8E8EE', '#C8CED6', '#D0D4DA']

function seededRandom(seed: number) {
    let s = seed
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}

interface Particle {
    x: number; y: number
    vx: number; vy: number
    color: string
    life: number; maxLife: number
    size: number
    baseSpeed: number
}

function drawFurShimmer(
    ctx: CanvasRenderingContext2D,
    imgOriginX: number, imgOriginY: number,
    drawW: number, drawH: number,
    shimmerPhase: number,
    px: number
) {
    const waveX = shimmerPhase * drawW
    const bandWidth = drawW * 0.08

    ctx.save()
    for (let i = 0; i < 12; i++) {
        const stripX = waveX + (i - 6) * (bandWidth * 0.6)
        if (stripX < -bandWidth || stripX > drawW + bandWidth) continue

        const dist = Math.abs(i - 6) / 6
        const alpha = (1 - dist) * 0.06

        ctx.globalAlpha = alpha
        ctx.fillStyle = '#E8E8F0'

        const segH = drawH * 0.04
        for (let sy = 0; sy < drawH; sy += segH * 1.5) {
            const wobble = Math.sin((sy / drawH) * Math.PI * 3 + shimmerPhase * Math.PI * 2) * bandWidth * 0.3
            ctx.fillRect(
                Math.round((imgOriginX + stripX + wobble) / px) * px,
                Math.round((imgOriginY + sy) / px) * px,
                Math.round((bandWidth * 0.4) / px) * px,
                Math.round(segH / px) * px
            )
        }
    }
    ctx.restore()
}

interface TigerCanvasProps {
    opacity?: number
    className?: string
    style?: React.CSSProperties
}

export default function TigerCanvas({ opacity = 1, className, style }: TigerCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        const dpr = window.devicePixelRatio || 1
        const parent = canvas.parentElement!
        let W = parent.clientWidth || window.innerWidth
        let H = parent.clientHeight || window.innerHeight

        canvas.width = W * dpr
        canvas.height = H * dpr

        const ctx = canvas.getContext('2d')!
        ctx.scale(dpr, dpr)

        const rand = seededRandom(42)
        const particles: Particle[] = []

        const tigerSize = Math.min(924, Math.max(396, W * 0.66))

        let tigerCX = W / 2
        let tigerCY = H / 2

        const baseRX = tigerSize * 0.2
        const baseRY = tigerSize * 0.24

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = '/images/tigerhome.png'

        let offscreen: HTMLCanvasElement | null = null
        let tigerDrawX = 0
        let tigerDrawY = 0
        let tigerDrawW = 0
        let tigerDrawH = 0

        img.onload = () => {
            offscreen = document.createElement('canvas')
            offscreen.width = tigerSize * dpr
            offscreen.height = tigerSize * dpr
            const offCtx = offscreen.getContext('2d')!
            offCtx.scale(dpr, dpr)

            const scale = Math.min(
                (tigerSize * 0.95) / img.naturalWidth,
                (tigerSize * 0.95) / img.naturalHeight
            )
            tigerDrawW = img.naturalWidth * scale
            tigerDrawH = img.naturalHeight * scale
            tigerDrawX = (tigerSize - tigerDrawW) / 2
            tigerDrawY = (tigerSize - tigerDrawH) / 2
            offCtx.drawImage(img, tigerDrawX, tigerDrawY, tigerDrawW, tigerDrawH)

            if (prefersReducedMotion) {
                ctx.clearRect(0, 0, W, H)
                const destX = tigerCX - tigerSize / 2
                const destY = tigerCY - tigerSize / 2
                ctx.drawImage(
                    offscreen,
                    0, 0, offscreen.width, offscreen.height,
                    destX, destY, tigerSize, tigerSize
                )
            }
        }

        let breathPhase = 0
        let shimmerPhase = 0
        let headSwayPhase = 0

        const BREATH_SPEED = 0.008
        const SHIMMER_SPEED = 0.002
        const HEAD_SWAY_SPEED = 0.004

        function spawnParticle() {
            const angle = rand() * Math.PI * 2
            const rx = baseRX + rand() * (baseRX * 0.5)
            const ry = baseRY + rand() * (baseRY * 0.5)
            const x = tigerCX + Math.cos(angle) * rx
            const y = tigerCY + Math.sin(angle) * ry

            const outAngle = Math.atan2(y - tigerCY, x - tigerCX) + (rand() * 0.6 - 0.3)
            const speed = 0.2 + rand() * 0.6

            const isLeft = x < tigerCX
            const isBottom = y > tigerCY + 30
            let color: string
            if (isBottom && isLeft) {
                color = ACCENT_LEFT[Math.floor(rand() * ACCENT_LEFT.length)]
            } else if (isBottom && !isLeft) {
                color = ACCENT_RIGHT[Math.floor(rand() * ACCENT_RIGHT.length)]
            } else {
                color = WHITES[Math.floor(rand() * WHITES.length)]
            }

            particles.push({
                x, y,
                vx: Math.cos(outAngle) * speed,
                vy: Math.sin(outAngle) * speed,
                color,
                life: 0,
                maxLife: 400 + rand() * 500,
                size: 2 + rand() * 4,
                baseSpeed: speed,
            })
        }

        const particleCount = Math.floor(Math.max(180, (W * H) / 4000))
        for (let i = 0; i < particleCount; i++) spawnParticle()

        function handleResize() {
            W = parent.clientWidth || window.innerWidth
            H = parent.clientHeight || window.innerHeight
            canvas!.width = W * dpr
            canvas!.height = H * dpr
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.scale(dpr, dpr)
            tigerCX = W / 2
            tigerCY = H / 2
        }
        const ro = new ResizeObserver(() => handleResize())
        ro.observe(parent)

        let animId: number

        function animate() {
            ctx.clearRect(0, 0, W, H)

            breathPhase += BREATH_SPEED
            shimmerPhase += SHIMMER_SPEED
            headSwayPhase += HEAD_SWAY_SPEED
            if (shimmerPhase > 1.3) shimmerPhase = -0.3

            const breathScale = 1 + Math.sin(breathPhase) * 0.008
            const headSwayX = Math.sin(headSwayPhase) * tigerSize * 0.003
            const headSwayY = Math.cos(headSwayPhase * 0.7) * tigerSize * 0.002

            if (offscreen) {
                const destX = tigerCX - (tigerSize * breathScale) / 2 + headSwayX
                const destY = tigerCY - (tigerSize * breathScale) / 2 + headSwayY
                const drawSize = tigerSize * breathScale

                ctx.drawImage(
                    offscreen,
                    0, 0, offscreen.width, offscreen.height,
                    destX, destY, drawSize, drawSize
                )

                const scaleRatio = drawSize / tigerSize
                const imgOriginX = destX + tigerDrawX * scaleRatio
                const imgOriginY = destY + tigerDrawY * scaleRatio
                const scaledDrawW = tigerDrawW * scaleRatio
                const scaledDrawH = tigerDrawH * scaleRatio

                const px = Math.max(2, scaledDrawW * 0.003)

                drawFurShimmer(ctx, imgOriginX, imgOriginY, scaledDrawW, scaledDrawH, shimmerPhase, px)
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.x += p.vx
                p.y += p.vy
                p.life++

                let alpha: number
                if (p.life < 40) {
                    alpha = p.life / 40
                } else if (p.life > p.maxLife - 100) {
                    alpha = (p.maxLife - p.life) / 100
                } else {
                    alpha = 1
                }

                if (p.life >= p.maxLife) {
                    particles.splice(i, 1)
                    spawnParticle()
                    continue
                }

                ctx.globalAlpha = alpha * 0.82
                ctx.fillStyle = p.color
                ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
            }

            ctx.globalAlpha = 1

            animId = requestAnimationFrame(animate)
        }

        if (!prefersReducedMotion) {
            animId = requestAnimationFrame(animate)
        }
        return () => {
            cancelAnimationFrame(animId)
            ro.disconnect()
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                opacity,
                imageRendering: 'pixelated',
                ...style,
            }}
        />
    )
}
