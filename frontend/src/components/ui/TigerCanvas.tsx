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

interface SmokeParticle {
    x: number; y: number
    vx: number; vy: number
    size: number
    startSize: number
    maxSize: number
    life: number; maxLife: number
    alpha: number
    rotation: number
    rotSpeed: number
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

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t)
}

const EYE_LEFT = { cx: 0.422, cy: 0.375, w: 0.042, h: 0.024 }
const EYE_RIGHT = { cx: 0.558, cy: 0.370, w: 0.045, h: 0.024 }

const EYELID_COLORS = [
    { color: '#1a1a2e', w: 1.0 },
    { color: '#2d2d44', w: 0.85 },
    { color: '#c8c8d4', w: 0.65 },
]

const MOUTH_REGION = { cx: 0.495, cy: 0.510, w: 0.155, h: 0.085 }
const NOSE_REGION = { cx: 0.470, cy: 0.440, w: 0.045, h: 0.025 }
const EAR_LEFT = { cx: 0.330, cy: 0.170, w: 0.060, h: 0.055 }
const EAR_RIGHT = { cx: 0.580, cy: 0.155, w: 0.060, h: 0.055 }

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

interface EarTwitchState {
    active: boolean
    ear: 'left' | 'right'
    frame: number
    totalFrames: number
    nextTwitchAt: number
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

function drawEyeGlow(
    ctx: CanvasRenderingContext2D,
    eyeCX: number, eyeCY: number,
    eyeW: number, eyeH: number,
    glowIntensity: number
) {
    if (glowIntensity <= 0) return

    ctx.save()
    ctx.globalAlpha = glowIntensity * 0.35
    ctx.shadowColor = '#40E0D0'
    ctx.shadowBlur = eyeW * 0.8
    ctx.fillStyle = '#40E0D0'
    ctx.fillRect(
        eyeCX - eyeW * 0.3,
        eyeCY - eyeH * 0.3,
        eyeW * 0.6,
        eyeH * 0.6
    )
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = glowIntensity * 0.15
    ctx.fillStyle = '#80F0E8'
    const highlightW = eyeW * 0.2
    const highlightH = eyeH * 0.25
    ctx.fillRect(
        eyeCX - highlightW / 2 + eyeW * 0.1,
        eyeCY - highlightH / 2 - eyeH * 0.1,
        highlightW,
        highlightH
    )
    ctx.restore()
}

function drawMouthOverlay(
    ctx: CanvasRenderingContext2D,
    mouthCX: number, mouthCY: number,
    mouthW: number, mouthH: number,
    openFraction: number,
    jawTremble: number
) {
    if (openFraction <= 0) return

    const px = Math.max(2, mouthW * 0.06)
    const extendY = mouthH * 0.55 * openFraction
    const trembleOffset = jawTremble

    ctx.fillStyle = '#1a1a2e'
    const jawW = mouthW * (0.9 - openFraction * 0.1)
    const jawX = mouthCX - jawW / 2 + trembleOffset
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
    const tongueX = mouthCX - tongueW / 2 + trembleOffset
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
    const innerX = mouthCX - innerW / 2 + trembleOffset
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
        const fangLX = mouthCX - jawW * 0.32 + trembleOffset
        const fangRX = mouthCX + jawW * 0.32 - fangW + trembleOffset
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

function drawNostrilFlare(
    ctx: CanvasRenderingContext2D,
    noseCX: number, noseCY: number,
    noseW: number, noseH: number,
    flareIntensity: number
) {
    if (flareIntensity <= 0) return

    const px = Math.max(2, noseW * 0.12)
    const expand = flareIntensity * noseW * 0.15

    ctx.save()
    ctx.globalAlpha = flareIntensity * 0.5
    ctx.fillStyle = '#d4727a'
    const leftNX = noseCX - noseW * 0.25 - expand * 0.5
    const rightNX = noseCX + noseW * 0.1 + expand * 0.3
    const nH = noseH * 0.45
    const nW = noseW * 0.2 + expand * 0.3
    ctx.fillRect(
        Math.round(leftNX / px) * px,
        Math.round((noseCY - nH / 2) / px) * px,
        Math.round(nW / px) * px,
        Math.round(nH / px) * px
    )
    ctx.fillRect(
        Math.round(rightNX / px) * px,
        Math.round((noseCY - nH / 2) / px) * px,
        Math.round(nW / px) * px,
        Math.round(nH / px) * px
    )
    ctx.restore()
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

        const smokeParticles: SmokeParticle[] = []

        function spawnSmoke(noseX: number, noseY: number, noseW: number, side: 'left' | 'right') {
            const offsetX = side === 'left' ? -noseW * 0.6 : noseW * 0.6
            const spreadX = (Math.random() - 0.5) * noseW * 0.8
            const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.0
            const speed = 0.5 + Math.random() * 1.0
            const sz = 5 + Math.random() * 8

            smokeParticles.push({
                x: noseX + offsetX + spreadX,
                y: noseY + noseW * 0.2,
                vx: Math.cos(angle) * speed * (side === 'left' ? -0.6 : 0.6) + (Math.random() - 0.5) * 0.5,
                vy: Math.abs(Math.sin(angle)) * speed * 0.6 + 0.3 + Math.random() * 0.3,
                size: sz,
                startSize: sz,
                maxSize: sz * 5,
                life: 0,
                maxLife: 90 + Math.floor(Math.random() * 70),
                alpha: 0.35 + Math.random() * 0.25,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.06,
            })
        }

        function drawSmoke(ctx: CanvasRenderingContext2D) {
            for (let i = smokeParticles.length - 1; i >= 0; i--) {
                const s = smokeParticles[i]
                s.x += s.vx
                s.y += s.vy
                s.vy += 0.005
                s.vy *= 0.997
                s.vx *= 0.993
                s.life++
                s.rotation += s.rotSpeed

                const t = s.life / s.maxLife
                s.size = s.startSize + (s.maxSize - s.startSize) * t

                let alpha: number
                if (t < 0.15) {
                    alpha = (t / 0.15) * s.alpha
                } else if (t > 0.6) {
                    alpha = ((1 - t) / 0.4) * s.alpha
                } else {
                    alpha = s.alpha
                }

                if (s.life >= s.maxLife) {
                    smokeParticles.splice(i, 1)
                    continue
                }

                ctx.save()
                ctx.globalAlpha = alpha
                ctx.translate(s.x, s.y)
                ctx.rotate(s.rotation)

                const gray = 180 + Math.floor(t * 50)
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray + 10})`
                ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size)

                if (s.size > 5) {
                    ctx.globalAlpha = alpha * 0.4
                    const innerGray = gray + 20
                    ctx.fillStyle = `rgb(${innerGray}, ${innerGray}, ${innerGray + 5})`
                    const inner = s.size * 0.5
                    ctx.fillRect(-inner / 2, -inner / 2, inner, inner)
                }

                ctx.restore()
            }
        }

        const earTwitch: EarTwitchState = {
            active: false,
            ear: 'left',
            frame: 0,
            totalFrames: 12,
            nextTwitchAt: 150 + Math.floor(Math.random() * 120),
        }

        let frameCount = 0
        let breathPhase = 0
        let eyeGlowPhase = 0
        let shimmerPhase = 0
        let headSwayPhase = 0

        const BLINK_CLOSE_FRAMES = 4
        const BLINK_HOLD_FRAMES = 3
        const BLINK_OPEN_FRAMES = 5

        const MOUTH_OPEN_FRAMES = 18
        const MOUTH_HOLD_FRAMES = 25
        const MOUTH_CLOSE_FRAMES = 22

        const BREATH_SPEED = 0.008
        const EYE_GLOW_SPEED = 0.012
        const SHIMMER_SPEED = 0.002
        const HEAD_SWAY_SPEED = 0.004

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
                case 'opening': return smoothstep(mouth.frame / MOUTH_OPEN_FRAMES)
                case 'open': return 1
                case 'closing': return 1 - smoothstep(mouth.frame / MOUTH_CLOSE_FRAMES)
            }
        }

        function updateEarTwitch() {
            if (!earTwitch.active) {
                if (frameCount >= earTwitch.nextTwitchAt) {
                    earTwitch.active = true
                    earTwitch.frame = 0
                    earTwitch.ear = Math.random() < 0.5 ? 'left' : 'right'
                    earTwitch.totalFrames = 10 + Math.floor(Math.random() * 8)
                }
            } else {
                earTwitch.frame++
                if (earTwitch.frame >= earTwitch.totalFrames) {
                    earTwitch.active = false
                    earTwitch.nextTwitchAt = frameCount + 180 + Math.floor(Math.random() * 200)
                }
            }
        }

        function getEarTwitchOffset(): { leftDx: number; leftDy: number; rightDx: number; rightDy: number } {
            if (!earTwitch.active) return { leftDx: 0, leftDy: 0, rightDx: 0, rightDy: 0 }
            const t = earTwitch.frame / earTwitch.totalFrames
            const intensity = Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 3)
            const offset = intensity * 2.5
            if (earTwitch.ear === 'left') {
                return { leftDx: offset * 0.3, leftDy: -offset, rightDx: 0, rightDy: 0 }
            } else {
                return { leftDx: 0, leftDy: 0, rightDx: -offset * 0.3, rightDy: -offset }
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
                baseSpeed: speed,
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

            breathPhase += BREATH_SPEED
            eyeGlowPhase += EYE_GLOW_SPEED
            shimmerPhase += SHIMMER_SPEED
            headSwayPhase += HEAD_SWAY_SPEED
            if (shimmerPhase > 1.3) shimmerPhase = -0.3

            const breathScale = 1 + Math.sin(breathPhase) * 0.008
            const headSwayX = Math.sin(headSwayPhase) * tigerSize * 0.003
            const headSwayY = Math.cos(headSwayPhase * 0.7) * tigerSize * 0.002

            updateMouth()
            const mouthFrac = getMouthFraction()
            const isRoaring = mouthFrac > 0

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

                updateEarTwitch()
                const earOff = getEarTwitchOffset()

                if (earOff.leftDy !== 0) {
                    const earX = imgOriginX + EAR_LEFT.cx * scaledDrawW
                    const earY = imgOriginY + EAR_LEFT.cy * scaledDrawH
                    const earW = EAR_LEFT.w * scaledDrawW
                    const earH = EAR_LEFT.h * scaledDrawH

                    ctx.save()
                    ctx.globalAlpha = Math.abs(earOff.leftDy) / 2.5 * 0.3
                    ctx.fillStyle = '#c8c8d4'
                    ctx.fillRect(
                        Math.round((earX + earOff.leftDx) / px) * px,
                        Math.round((earY + earOff.leftDy) / px) * px,
                        Math.round(earW / px) * px,
                        Math.round((earH * 0.3) / px) * px
                    )
                    ctx.restore()
                }

                if (earOff.rightDy !== 0) {
                    const earX = imgOriginX + EAR_RIGHT.cx * scaledDrawW
                    const earY = imgOriginY + EAR_RIGHT.cy * scaledDrawH
                    const earW = EAR_RIGHT.w * scaledDrawW
                    const earH = EAR_RIGHT.h * scaledDrawH

                    ctx.save()
                    ctx.globalAlpha = Math.abs(earOff.rightDy) / 2.5 * 0.3
                    ctx.fillStyle = '#c8c8d4'
                    ctx.fillRect(
                        Math.round((earX + earOff.rightDx) / px) * px,
                        Math.round((earY + earOff.rightDy) / px) * px,
                        Math.round(earW / px) * px,
                        Math.round((earH * 0.3) / px) * px
                    )
                    ctx.restore()
                }

                updateBlink()
                const blinkFrac = getBlinkFraction()

                const eyeGlowIntensity = blinkFrac > 0.5 ? 0 : (0.5 + Math.sin(eyeGlowPhase) * 0.5) * (1 - blinkFrac)

                const leftEyeX = imgOriginX + EYE_LEFT.cx * scaledDrawW
                const leftEyeY = imgOriginY + EYE_LEFT.cy * scaledDrawH
                const leftEyeW = EYE_LEFT.w * scaledDrawW
                const leftEyeH = EYE_LEFT.h * scaledDrawH

                const rightEyeX = imgOriginX + EYE_RIGHT.cx * scaledDrawW
                const rightEyeY = imgOriginY + EYE_RIGHT.cy * scaledDrawH
                const rightEyeW = EYE_RIGHT.w * scaledDrawW
                const rightEyeH = EYE_RIGHT.h * scaledDrawH

                drawEyeGlow(ctx, leftEyeX, leftEyeY, leftEyeW, leftEyeH, eyeGlowIntensity)
                drawEyeGlow(ctx, rightEyeX, rightEyeY, rightEyeW, rightEyeH, eyeGlowIntensity)

                if (blinkFrac > 0) {
                    drawEyelid(ctx, leftEyeX, leftEyeY, leftEyeW, leftEyeH, blinkFrac)
                    drawEyelid(ctx, rightEyeX, rightEyeY, rightEyeW, rightEyeH, blinkFrac)
                }

                const breathSin = Math.sin(breathPhase)
                const nostrilFlare = Math.max(0, breathSin) * 0.6
                const noseX = imgOriginX + NOSE_REGION.cx * scaledDrawW
                const noseY = imgOriginY + NOSE_REGION.cy * scaledDrawH
                const noseW = NOSE_REGION.w * scaledDrawW
                const noseH = NOSE_REGION.h * scaledDrawH
                if (nostrilFlare > 0.05) {
                    drawNostrilFlare(ctx, noseX, noseY, noseW, noseH, nostrilFlare)
                }

                if (isRoaring && mouthFrac > 0.15 && smokeParticles.length < 1500) {
                    const spawnRate = 10 + Math.floor(mouthFrac * 25)
                    for (let s = 0; s < spawnRate; s++) {
                        spawnSmoke(noseX, noseY, noseW, 'left')
                        spawnSmoke(noseX, noseY, noseW, 'right')
                    }
                }

                drawSmoke(ctx)

                if (mouthFrac > 0) {
                    let jawTremble = 0
                    if (mouthFrac > 0.6) {
                        jawTremble = (Math.sin(frameCount * 0.8) * 0.5 + Math.sin(frameCount * 1.3) * 0.3) * scaledDrawW * 0.003 * mouthFrac
                    }

                    const mouthX = imgOriginX + MOUTH_REGION.cx * scaledDrawW
                    const mouthY = imgOriginY + MOUTH_REGION.cy * scaledDrawH
                    const mouthW = MOUTH_REGION.w * scaledDrawW
                    const mouthH = MOUTH_REGION.h * scaledDrawH
                    drawMouthOverlay(ctx, mouthX, mouthY, mouthW, mouthH, mouthFrac, jawTremble)
                }
            }

            const particleBoost = isRoaring ? 1 + mouthFrac * 0.8 : 1

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.x += p.vx * particleBoost
                p.y += p.vy * particleBoost
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

            const maxParticles = particleCount + 80
            if (isRoaring && mouthFrac > 0.5 && particles.length < maxParticles) {
                const burstCount = Math.min(Math.floor(mouthFrac * 3), maxParticles - particles.length)
                for (let b = 0; b < burstCount; b++) {
                    spawnParticle()
                }
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
