import { useRef, useEffect } from 'react'

interface MerchantBackgroundProps {
    className?: string
}

interface PaymentPacket {
    t: number
    speed: number
    pathIndex: number
    size: number
    alpha: number
    color: string
}

interface PulseRing {
    cx: number
    cy: number
    r: number
    maxR: number
    alpha: number
    color: string
}

interface DataStream {
    x: number
    y: number
    vy: number
    length: number
    alpha: number
    color: string
}

export default function MerchantBackground({ className }: MerchantBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const visibleRef = useRef(false)
    const stateRef = useRef({
        packets: [] as PaymentPacket[],
        pulseRings: [] as PulseRing[],
        dataStreams: [] as DataStream[],
        frame: 0,
        initialized: false,
        paths: [] as { cx: number; cy: number; rx: number; ry: number; rotation: number }[],
    })

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animId: number
        const s = stateRef.current

        const observer = new IntersectionObserver(
            ([entry]) => { visibleRef.current = entry.isIntersecting },
            { threshold: 0 }
        )
        observer.observe(canvas)

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
            s.paths = [
                { cx: 0.5, cy: 0.5, rx: 0.35, ry: 0.25, rotation: 0 },
                { cx: 0.5, cy: 0.5, rx: 0.25, ry: 0.35, rotation: Math.PI / 4 },
                { cx: 0.5, cy: 0.5, rx: 0.4, ry: 0.15, rotation: -Math.PI / 6 },
                { cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.3, rotation: Math.PI / 3 },
                { cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.2, rotation: -Math.PI / 5 },
            ]

            const colors = ['#E0115F', '#FF2D78', '#FF5C93', '#CC0E52', '#FF7EB3']
            for (let i = 0; i < 30; i++) {
                s.packets.push({
                    t: Math.random() * Math.PI * 2,
                    speed: 0.008 + Math.random() * 0.012,
                    pathIndex: Math.floor(Math.random() * s.paths.length),
                    size: 2 + Math.random() * 3,
                    alpha: 0.2 + Math.random() * 0.4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                })
            }

            for (let i = 0; i < 20; i++) {
                s.dataStreams.push({
                    x: Math.random(),
                    y: Math.random(),
                    vy: -(0.3 + Math.random() * 0.8),
                    length: 10 + Math.random() * 30,
                    alpha: 0.08 + Math.random() * 0.12,
                    color: colors[Math.floor(Math.random() * colors.length)],
                })
            }

            s.initialized = true
        }

        function getPathPoint(path: typeof s.paths[0], t: number, w: number, h: number) {
            const cos = Math.cos(path.rotation)
            const sin = Math.sin(path.rotation)
            const px = path.rx * w * Math.cos(t)
            const py = path.ry * h * Math.sin(t)
            return {
                x: path.cx * w + px * cos - py * sin,
                y: path.cy * h + px * sin + py * cos,
            }
        }

        function animate() {
            animId = requestAnimationFrame(animate)
            if (!visibleRef.current) return

            s.frame++
            const rect = canvas!.getBoundingClientRect()
            const w = rect.width
            const h = rect.height

            ctx!.clearRect(0, 0, w, h)

            for (const path of s.paths) {
                const pathAlpha = 0.04 + Math.sin(s.frame * 0.01) * 0.02
                ctx!.globalAlpha = pathAlpha
                ctx!.strokeStyle = '#E0115F'
                ctx!.lineWidth = 0.5
                ctx!.beginPath()
                for (let t = 0; t <= Math.PI * 2; t += 0.05) {
                    const pt = getPathPoint(path, t, w, h)
                    if (t === 0) ctx!.moveTo(pt.x, pt.y)
                    else ctx!.lineTo(pt.x, pt.y)
                }
                ctx!.closePath()
                ctx!.stroke()
            }

            for (const packet of s.packets) {
                packet.t += packet.speed
                if (packet.t > Math.PI * 2) packet.t -= Math.PI * 2

                const path = s.paths[packet.pathIndex]
                const pt = getPathPoint(path, packet.t, w, h)

                const trailLength = 5
                for (let j = trailLength; j >= 0; j--) {
                    const trailT = packet.t - j * packet.speed * 2
                    const trailPt = getPathPoint(path, trailT, w, h)
                    const trailAlpha = packet.alpha * (1 - j / trailLength) * 0.5
                    ctx!.globalAlpha = trailAlpha
                    ctx!.fillStyle = packet.color
                    ctx!.beginPath()
                    ctx!.arc(trailPt.x, trailPt.y, packet.size * (1 - j / trailLength * 0.5), 0, Math.PI * 2)
                    ctx!.fill()
                }

                ctx!.globalAlpha = packet.alpha
                ctx!.fillStyle = packet.color
                ctx!.beginPath()
                ctx!.arc(pt.x, pt.y, packet.size, 0, Math.PI * 2)
                ctx!.fill()

                ctx!.globalAlpha = packet.alpha * 0.3
                ctx!.shadowColor = packet.color
                ctx!.shadowBlur = 8
                ctx!.beginPath()
                ctx!.arc(pt.x, pt.y, packet.size * 1.5, 0, Math.PI * 2)
                ctx!.fill()
                ctx!.shadowBlur = 0
            }

            if (s.frame % 90 === 0) {
                const ringColors = ['#E0115F', '#FF2D78', '#FF5C93']
                s.pulseRings.push({
                    cx: 0.3 + Math.random() * 0.4,
                    cy: 0.3 + Math.random() * 0.4,
                    r: 0,
                    maxR: 60 + Math.random() * 80,
                    alpha: 0.15 + Math.random() * 0.1,
                    color: ringColors[Math.floor(Math.random() * ringColors.length)],
                })
            }

            for (let i = s.pulseRings.length - 1; i >= 0; i--) {
                const ring = s.pulseRings[i]
                ring.r += 0.8
                const progress = ring.r / ring.maxR
                if (progress >= 1) {
                    s.pulseRings.splice(i, 1)
                    continue
                }

                const fadeAlpha = ring.alpha * (1 - progress)
                ctx!.globalAlpha = fadeAlpha
                ctx!.strokeStyle = ring.color
                ctx!.lineWidth = 1.5 * (1 - progress)
                ctx!.beginPath()
                ctx!.arc(ring.cx * w, ring.cy * h, ring.r, 0, Math.PI * 2)
                ctx!.stroke()
            }

            for (const stream of s.dataStreams) {
                stream.y += stream.vy / h * 0.5
                if (stream.y < -0.1) {
                    stream.y = 1.1
                    stream.x = Math.random()
                }

                const sx = stream.x * w
                const sy = stream.y * h
                const grad = ctx!.createLinearGradient(sx, sy, sx, sy + stream.length)
                grad.addColorStop(0, stream.color)
                grad.addColorStop(1, 'transparent')
                ctx!.globalAlpha = stream.alpha
                ctx!.strokeStyle = grad
                ctx!.lineWidth = 1
                ctx!.beginPath()
                ctx!.moveTo(sx, sy)
                ctx!.lineTo(sx, sy + stream.length)
                ctx!.stroke()
            }

            const centerPulse = Math.sin(s.frame * 0.015) * 0.04 + 0.06
            ctx!.globalAlpha = centerPulse
            const radGrad = ctx!.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.35)
            radGrad.addColorStop(0, '#E0115F')
            radGrad.addColorStop(1, 'transparent')
            ctx!.fillStyle = radGrad
            ctx!.fillRect(0, 0, w, h)

            ctx!.globalAlpha = 1
        }

        animId = requestAnimationFrame(animate)
        return () => {
            cancelAnimationFrame(animId)
            window.removeEventListener('resize', resize)
            observer.disconnect()
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
