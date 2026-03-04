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

const EYE_LEFT = { cx: 0.410, cy: 0.375, w: 0.042, h: 0.024 }
const EYE_RIGHT = { cx: 0.558, cy: 0.370, w: 0.045, h: 0.024 }

const EYELID_COLORS = [
    { color: '#1a1a2e', w: 1.0 },
    { color: '#2d2d44', w: 0.85 },
    { color: '#c8c8d4', w: 0.65 },
]

const MOUTH_REGION = { cx: 0.495, cy: 0.510, w: 0.155, h: 0.085 }

interface BlinkState {
    phase: 'open' | 'closing' | 'closed' | 'opening'
    frame: number
    nextBlinkAt: number
}

interface MouthState {
    phase: 'closed' | 'opening' | 'open' | 'closing'
    frame: number
    nextRoarAt: number
}

function drawEyelid(
    ctx: CanvasRenderingContext2D,
    eyeCX: number, eyeCY: number,
    eyeW: number, eyeH: number,
    closeFraction: number
) {
    if (closeFraction <= 0) return

    const coverH = eyeH * closeFraction
    const px = Math.max(2, eyeW * 0.08)

    for (const layer of EYELID_COLORS) {
        const lw = eyeW * layer.w
        const lx = eyeCX - lw / 2
        ctx.fillStyle = layer.color
        ctx.fillRect(
            Math.round(lx / px) * px,
            Math.round((eyeCY - eyeH / 2) / px) * px,
            Math.round(lw / px) * px,
            Math.round(coverH / px) * px
        )
    }

    if (closeFraction > 0.7) {
        const bottomCoverH = eyeH * (closeFraction - 0.5) * 0.6
        if (bottomCoverH > 0) {
            ctx.fillStyle = '#1a1a2e'
            const bx = eyeCX - eyeW * 0.4
            const by = eyeCY + eyeH / 2 - bottomCoverH
            ctx.fillRect(
                Math.round(bx / px) * px,
                Math.round(by / px) * px,
                Math.round((eyeW * 0.8) / px) * px,
                Math.round(bottomCoverH / px) * px
            )
        }
    }
}

function drawMouthOverlay(
    ctx: CanvasRenderingContext2D,
    mouthCX: number, mouthCY: number,
    mouthW: number, mouthH: number,
    openFraction: number
) {
    if (openFraction <= 0) return

    const px = Math.max(2, mouthW * 0.06)
    const extendY = mouthH * 0.55 * openFraction

    ctx.fillStyle = '#1a1a2e'
    const jawW = mouthW * (0.9 - openFraction * 0.1)
    const jawX = mouthCX - jawW / 2
    const jawY = mouthCY + mouthH * 0.3
    ctx.fillRect(
        Math.round(jawX / px) * px,
        Math.round(jawY / px) * px,
        Math.round(jawW / px) * px,
        Math.round(extendY / px) * px
    )

    ctx.fillStyle = '#c43a5e'
    const tongueW = jawW * 0.65
    const tongueH = extendY * 0.6
    const tongueX = mouthCX - tongueW / 2
    const tongueY = jawY + extendY * 0.1
    ctx.fillRect(
        Math.round(tongueX / px) * px,
        Math.round(tongueY / px) * px,
        Math.round(tongueW / px) * px,
        Math.round(tongueH / px) * px
    )

    ctx.fillStyle = '#e75480'
    const innerW = tongueW * 0.55
    const innerH = tongueH * 0.5
    const innerX = mouthCX - innerW / 2
    const innerY = tongueY + tongueH * 0.15
    ctx.fillRect(
        Math.round(innerX / px) * px,
        Math.round(innerY / px) * px,
        Math.round(innerW / px) * px,
        Math.round(innerH / px) * px
    )

    if (openFraction > 0.4) {
        ctx.fillStyle = '#c8a84e'
        const fangW = mouthW * 0.055
        const fangH = extendY * 0.45 * openFraction
        const fangLX = mouthCX - jawW * 0.32
        const fangRX = mouthCX + jawW * 0.32 - fangW
        const fangY = jawY - px
        ctx.fillRect(
            Math.round(fangLX / px) * px,
            Math.round(fangY / px) * px,
            Math.round(fangW / px) * px,
            Math.round(fangH / px) * px
        )
        ctx.fillRect(
            Math.round(fangRX / px) * px,
            Math.round(fangY / px) * px,
            Math.round(fangW / px) * px,
            Math.round(fangH / px) * px
        )
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

        const tigerSize = Math.min(1050, Math.max(450, W * 0.75))

        const tigerCX = W / 2
        const tigerCY = H / 2

        const baseRX = tigerSize * 0.2
        const baseRY = tigerSize * 0.24

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

        const blink: BlinkState = {
            phase: 'open',
            frame: 0,
            nextBlinkAt: 90 + Math.floor(Math.random() * 60),
        }

        const mouth: MouthState = {
            phase: 'closed',
            frame: 0,
            nextRoarAt: 200 + Math.floor(Math.random() * 120),
        }

        let frameCount = 0

        const BLINK_CLOSE_FRAMES = 4
        const BLINK_HOLD_FRAMES = 3
        const BLINK_OPEN_FRAMES = 5

        const MOUTH_OPEN_FRAMES = 18
        const MOUTH_HOLD_FRAMES = 25
        const MOUTH_CLOSE_FRAMES = 22

        function updateBlink() {
            switch (blink.phase) {
                case 'open':
                    if (frameCount >= blink.nextBlinkAt) {
                        if (mouth.phase !== 'closed') return
                        blink.phase = 'closing'
                        blink.frame = 0
                    }
                    break
                case 'closing':
                    blink.frame++
                    if (blink.frame >= BLINK_CLOSE_FRAMES) {
                        blink.phase = 'closed'
                        blink.frame = 0
                    }
                    break
                case 'closed':
                    blink.frame++
                    if (blink.frame >= BLINK_HOLD_FRAMES) {
                        blink.phase = 'opening'
                        blink.frame = 0
                    }
                    break
                case 'opening':
                    blink.frame++
                    if (blink.frame >= BLINK_OPEN_FRAMES) {
                        blink.phase = 'open'
                        blink.frame = 0
                        const doubleBlinkChance = Math.random()
                        if (doubleBlinkChance < 0.3) {
                            blink.nextBlinkAt = frameCount + 8 + Math.floor(Math.random() * 6)
                        } else {
                            blink.nextBlinkAt = frameCount + 90 + Math.floor(Math.random() * 90)
                        }
                    }
                    break
            }
        }

        function getBlinkFraction(): number {
            switch (blink.phase) {
                case 'open': return 0
                case 'closing': return blink.frame / BLINK_CLOSE_FRAMES
                case 'closed': return 1
                case 'opening': return 1 - blink.frame / BLINK_OPEN_FRAMES
            }
        }

        function updateMouth() {
            switch (mouth.phase) {
                case 'closed':
                    if (frameCount >= mouth.nextRoarAt) {
                        if (blink.phase !== 'open') return
                        mouth.phase = 'opening'
                        mouth.frame = 0
                    }
                    break
                case 'opening':
                    mouth.frame++
                    if (mouth.frame >= MOUTH_OPEN_FRAMES) {
                        mouth.phase = 'open'
                        mouth.frame = 0
                    }
                    break
                case 'open':
                    mouth.frame++
                    if (mouth.frame >= MOUTH_HOLD_FRAMES) {
                        mouth.phase = 'closing'
                        mouth.frame = 0
                    }
                    break
                case 'closing':
                    mouth.frame++
                    if (mouth.frame >= MOUTH_CLOSE_FRAMES) {
                        mouth.phase = 'closed'
                        mouth.frame = 0
                        mouth.nextRoarAt = frameCount + 200 + Math.floor(Math.random() * 150)
                    }
                    break
            }
        }

        function getMouthFraction(): number {
            switch (mouth.phase) {
                case 'closed': return 0
                case 'opening': {
                    const t = mouth.frame / MOUTH_OPEN_FRAMES
                    return t * t * (3 - 2 * t)
                }
                case 'open': return 1
                case 'closing': {
                    const t = mouth.frame / MOUTH_CLOSE_FRAMES
                    return 1 - t * t * (3 - 2 * t)
                }
            }
        }

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

        const particleCount = Math.floor(Math.max(180, (W * H) / 4000))
        for (let i = 0; i < particleCount; i++) spawnParticle()

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

        let animId: number

        function animate() {
            ctx.clearRect(0, 0, W, H)
            frameCount++

            if (offscreen) {
                const destX = tigerCX - tigerSize / 2
                const destY = tigerCY - tigerSize / 2
                ctx.drawImage(
                    offscreen,
                    0, 0, offscreen.width, offscreen.height,
                    destX, destY, tigerSize, tigerSize
                )

                const imgOriginX = destX + tigerDrawX
                const imgOriginY = destY + tigerDrawY

                updateBlink()
                const blinkFrac = getBlinkFraction()
                if (blinkFrac > 0) {
                    const leftEyeX = imgOriginX + EYE_LEFT.cx * tigerDrawW
                    const leftEyeY = imgOriginY + EYE_LEFT.cy * tigerDrawH
                    const leftEyeW = EYE_LEFT.w * tigerDrawW
                    const leftEyeH = EYE_LEFT.h * tigerDrawH
                    drawEyelid(ctx, leftEyeX, leftEyeY, leftEyeW, leftEyeH, blinkFrac)

                    const rightEyeX = imgOriginX + EYE_RIGHT.cx * tigerDrawW
                    const rightEyeY = imgOriginY + EYE_RIGHT.cy * tigerDrawH
                    const rightEyeW = EYE_RIGHT.w * tigerDrawW
                    const rightEyeH = EYE_RIGHT.h * tigerDrawH
                    drawEyelid(ctx, rightEyeX, rightEyeY, rightEyeW, rightEyeH, blinkFrac)
                }

                updateMouth()
                const mouthFrac = getMouthFraction()
                if (mouthFrac > 0) {
                    const mouthX = imgOriginX + MOUTH_REGION.cx * tigerDrawW
                    const mouthY = imgOriginY + MOUTH_REGION.cy * tigerDrawH
                    const mouthW = MOUTH_REGION.w * tigerDrawW
                    const mouthH = MOUTH_REGION.h * tigerDrawH
                    drawMouthOverlay(ctx, mouthX, mouthY, mouthW, mouthH, mouthFrac)
                }
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
