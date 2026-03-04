import { useRef, useEffect } from 'react'

interface InvestorBackgroundProps {
    className?: string
}

interface Particle {
    x: number
    y: number
    vy: number
    vx: number
    size: number
    alpha: number
    color: string
    pulsePhase: number
}

interface WavePoint {
    baseY: number
    amplitude: number
    frequency: number
    phase: number
    speed: number
}

export default function InvestorBackground({ className }: InvestorBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef = useRef({
        particles: [] as Particle[],
        waves: [] as WavePoint[][],
        gridOffset: 0,
        frame: 0,
        initialized: false,
    })

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

            for (let i = 0; i < 60; i++) {
                s.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vy: -(0.3 + Math.random() * 0.8),
                    vx: (Math.random() - 0.5) * 0.3,
                    size: 1.5 + Math.random() * 3,
                    alpha: 0.1 + Math.random() * 0.3,
                    color: ['#2CFF05', '#1acc04', '#33ff1a', '#00cc00', '#44ff22'][Math.floor(Math.random() * 5)],
                    pulsePhase: Math.random() * Math.PI * 2,
                })
            }

            for (let w_i = 0; w_i < 3; w_i++) {
                const wave: WavePoint[] = []
                const baseY = h * (0.3 + w_i * 0.25)
                for (let j = 0; j < 12; j++) {
                    wave.push({
                        baseY,
                        amplitude: 8 + Math.random() * 15,
                        frequency: 0.003 + Math.random() * 0.004,
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.01 + Math.random() * 0.015,
                    })
                }
                s.waves.push(wave)
            }

            s.initialized = true
        }

        function drawParticles(w: number, h: number) {
            for (const p of s.particles) {
                p.y += p.vy
                p.x += p.vx + Math.sin(s.frame * 0.01 + p.x * 0.005) * 0.2
                p.pulsePhase += 0.03

                if (p.y < -10) {
                    p.y = h + 10
                    p.x = Math.random() * w
                }
                if (p.x < -10) p.x = w + 10
                if (p.x > w + 10) p.x = -10

                const pulse = 0.6 + Math.sin(p.pulsePhase) * 0.4
                const glowSize = p.size * 3

                ctx!.globalAlpha = p.alpha * pulse * 0.3
                const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
                glow.addColorStop(0, p.color)
                glow.addColorStop(1, 'transparent')
                ctx!.fillStyle = glow
                ctx!.beginPath()
                ctx!.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
                ctx!.fill()

                ctx!.globalAlpha = p.alpha * pulse
                ctx!.fillStyle = p.color
                ctx!.beginPath()
                ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                ctx!.fill()
            }
            ctx!.globalAlpha = 1
        }

        function drawWaveforms(w: number, _h: number) {
            for (let wi = 0; wi < s.waves.length; wi++) {
                const wave = s.waves[wi]
                const waveAlpha = 0.06 + wi * 0.02

                ctx!.globalAlpha = waveAlpha
                ctx!.strokeStyle = '#2CFF05'
                ctx!.lineWidth = 1
                ctx!.beginPath()

                for (let x = 0; x <= w; x += 3) {
                    let y = 0
                    for (const pt of wave) {
                        y += Math.sin(x * pt.frequency + s.frame * pt.speed + pt.phase) * pt.amplitude
                    }
                    y += wave[0].baseY

                    if (x === 0) {
                        ctx!.moveTo(x, y)
                    } else {
                        ctx!.lineTo(x, y)
                    }
                }
                ctx!.stroke()
            }
            ctx!.globalAlpha = 1
        }

        function drawGrid(w: number, h: number) {
            s.gridOffset = (s.gridOffset + 0.15) % 40

            ctx!.globalAlpha = 0.04
            ctx!.strokeStyle = '#2CFF05'
            ctx!.lineWidth = 0.5

            for (let x = -s.gridOffset; x < w; x += 40) {
                ctx!.beginPath()
                ctx!.moveTo(x, 0)
                ctx!.lineTo(x, h)
                ctx!.stroke()
            }

            for (let y = -s.gridOffset; y < h; y += 40) {
                ctx!.beginPath()
                ctx!.moveTo(0, y)
                ctx!.lineTo(w, y)
                ctx!.stroke()
            }
            ctx!.globalAlpha = 1
        }

        function drawCenterPulse(w: number, h: number) {
            const cx = w * 0.5
            const cy = h * 0.5
            const pulsePhase = s.frame * 0.015
            const numRings = 3

            for (let i = 0; i < numRings; i++) {
                const phase = pulsePhase + (i * Math.PI * 2) / numRings
                const radius = 40 + ((phase % (Math.PI * 2)) / (Math.PI * 2)) * Math.min(w, h) * 0.4
                const life = (phase % (Math.PI * 2)) / (Math.PI * 2)
                const alpha = (1 - life) * 0.08

                ctx!.globalAlpha = alpha
                ctx!.strokeStyle = '#2CFF05'
                ctx!.lineWidth = 1.5
                ctx!.beginPath()
                ctx!.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx!.stroke()
            }
            ctx!.globalAlpha = 1
        }

        let observer: IntersectionObserver | null = null
        let isVisible = true

        observer = new IntersectionObserver(
            (entries) => {
                isVisible = entries[0]?.isIntersecting ?? true
            },
            { threshold: 0 }
        )
        observer.observe(canvas)

        function animate() {
            if (isVisible) {
                s.frame++
                const rect = canvas!.getBoundingClientRect()
                const w = rect.width
                const h = rect.height

                ctx!.clearRect(0, 0, w, h)

                drawGrid(w, h)
                drawWaveforms(w, h)
                drawParticles(w, h)
                drawCenterPulse(w, h)
            }

            animId = requestAnimationFrame(animate)
        }

        animate()
        return () => {
            cancelAnimationFrame(animId)
            window.removeEventListener('resize', resize)
            if (observer) observer.disconnect()
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
