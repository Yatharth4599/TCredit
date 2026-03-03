import React, { useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════
// TigerCanvas — Full-viewport canvas. Loads pixel-art
// tiger JPEG, removes white bg via flood-fill, renders
// with particles flowing outward to screen edges.
// ═══════════════════════════════════════════════════════

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
}

function removeBackground(
    data: Uint8ClampedArray,
    w: number,
    h: number,
    tolerance: number = 42
) {
    const visited = new Uint8Array(w * h)
    const isNearWhite = (i: number) =>
        data[i] > (255 - tolerance) &&
        data[i + 1] > (255 - tolerance) &&
        data[i + 2] > (255 - tolerance)

    const queue: number[] = []
    const enqueue = (x: number, y: number) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return
        const idx = y * w + x
        if (visited[idx]) return
        const pi = idx * 4
        if (!isNearWhite(pi)) return
        visited[idx] = 1
        data[pi + 3] = 0
        queue.push(idx)
    }

    for (let x = 0; x < w; x++) { enqueue(x, 0); enqueue(x, h - 1) }
    for (let y = 0; y < h; y++) { enqueue(0, y); enqueue(w - 1, y) }

    while (queue.length > 0) {
        const idx = queue.shift()!
        const x = idx % w
        const y = (idx - x) / w
        enqueue(x - 1, y)
        enqueue(x + 1, y)
        enqueue(x, y - 1)
        enqueue(x, y + 1)
    }
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

        const dpr = window.devicePixelRatio || 1
        let W = window.innerWidth
        let H = window.innerHeight

        canvas.width = W * dpr
        canvas.height = H * dpr
        canvas.style.width = `${W}px`
        canvas.style.height = `${H}px`

        const ctx = canvas.getContext('2d')!
        ctx.scale(dpr, dpr)

        const rand = seededRandom(42)
        const particles: Particle[] = []

        // Tiger image size: responsive — 75% of viewport width
        const tigerSize = Math.min(1050, Math.max(450, W * 0.75))

        // Tiger centered in viewport
        const tigerCX = W / 2
        const tigerCY = H / 2

        // Spawn radius scales with tiger size
        const baseRX = tigerSize * 0.2
        const baseRY = tigerSize * 0.24

        // ── Load image, remove background, build offscreen ──
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = '/images/tiger-pixel.jpeg'

        let offscreen: HTMLCanvasElement | null = null
        let tigerDrawX = 0
        let tigerDrawY = 0
        let tigerDrawW = 0
        let tigerDrawH = 0

        img.onload = () => {
            const tmp = document.createElement('canvas')
            tmp.width = img.naturalWidth
            tmp.height = img.naturalHeight
            const tmpCtx = tmp.getContext('2d')!
            tmpCtx.drawImage(img, 0, 0)

            const imgData = tmpCtx.getImageData(0, 0, tmp.width, tmp.height)
            removeBackground(imgData.data, tmp.width, tmp.height, 45)
            tmpCtx.putImageData(imgData, 0, 0)

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
            offCtx.drawImage(tmp, tigerDrawX, tigerDrawY, tigerDrawW, tigerDrawH)
        }

        // ── Particle system ──
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
            })
        }

        // More particles on bigger screens
        const particleCount = Math.floor(Math.max(180, (W * H) / 4000))
        for (let i = 0; i < particleCount; i++) spawnParticle()

        // ── Resize handler ──
        function handleResize() {
            W = window.innerWidth
            H = window.innerHeight
            canvas.width = W * dpr
            canvas.height = H * dpr
            canvas.style.width = `${W}px`
            canvas.style.height = `${H}px`
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.scale(dpr, dpr)
        }
        window.addEventListener('resize', handleResize)

        // ── Animation loop ──
        let animId: number

        function animate() {
            ctx.clearRect(0, 0, W, H)

            // Draw cleaned tiger image centered
            if (offscreen) {
                const destX = tigerCX - tigerSize / 2
                const destY = tigerCY - tigerSize / 2
                ctx.drawImage(
                    offscreen,
                    0, 0, offscreen.width, offscreen.height,
                    destX, destY, tigerSize, tigerSize
                )
            }

            // Draw particles
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

        animId = requestAnimationFrame(animate)
        return () => {
            cancelAnimationFrame(animId)
            window.removeEventListener('resize', handleResize)
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
