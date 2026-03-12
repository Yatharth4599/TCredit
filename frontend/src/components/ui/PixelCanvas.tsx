import { useEffect, useRef, useCallback } from 'react'
import styles from './PixelCanvas.module.css'

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    alpha: number
    life: number
    maxLife: number
    size: number
    color: string
}

interface PixelCanvasProps {
    pixelMap: (string | null)[][]
    pixelSize?: number
    animation?: 'swim' | 'float' | 'none'
    speed?: number
    direction?: number
    opacity?: number
    particleCount?: number
    particleColor?: string
    gap?: number
    className?: string
}

export default function PixelCanvas({
    pixelMap,
    pixelSize = 14,
    animation = 'swim',
    speed = 20,
    direction = 180,
    opacity = 0.1,
    particleCount = 20,
    particleColor = 'rgba(59, 130, 246, 0.3)',
    gap = 2,
    className,
}: PixelCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const visibleRef = useRef(false)
    const particlesRef = useRef<Particle[]>([])
    const startTimeRef = useRef(0)
    const posRef = useRef({ x: 0, y: 0 })

    // Compute shape dimensions
    const shapeW = pixelMap[0]?.length ?? 0
    const shapeH = pixelMap.length
    const totalW = shapeW * (pixelSize + gap)
    const totalH = shapeH * (pixelSize + gap)

    // Direction to dx/dy
    const rad = (direction * Math.PI) / 180
    const dx = Math.cos(rad)
    const dy = Math.sin(rad)

    const spawnParticle = useCallback(
        (_canvasW: number, _canvasH: number): Particle => {
            const cx = posRef.current.x + totalW / 2
            const cy = posRef.current.y + totalH / 2
            const angle = Math.random() * Math.PI * 2
            const dist = Math.max(totalW, totalH) * 0.4
            return {
                x: cx + Math.cos(angle) * dist * (0.5 + Math.random() * 0.5),
                y: cy + Math.sin(angle) * dist * (0.5 + Math.random() * 0.5),
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                alpha: 0,
                life: 0,
                maxLife: 120 + Math.random() * 180,
                size: 2 + Math.random() * 3,
                color: particleColor,
            }
        },
        [totalW, totalH, particleColor]
    )

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Resize canvas to container
        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect()
            if (!rect) return
            const dpr = window.devicePixelRatio || 1
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            ctx.scale(dpr, dpr)
            canvas.style.width = `${rect.width}px`
            canvas.style.height = `${rect.height}px`
        }
        resize()

        // Initialize position — start off-screen or centered based on animation
        const canvasW = canvas.width / (window.devicePixelRatio || 1)
        const canvasH = canvas.height / (window.devicePixelRatio || 1)

        if (animation === 'swim') {
            // Start from the right side, swim left
            posRef.current = {
                x: canvasW + 50,
                y: (canvasH - totalH) / 2,
            }
        } else {
            // Center the shape
            posRef.current = {
                x: (canvasW - totalW) / 2,
                y: (canvasH - totalH) / 2,
            }
        }

        // Initialize particles
        particlesRef.current = Array.from({ length: particleCount }, () =>
            spawnParticle(canvasW, canvasH)
        )

        startTimeRef.current = performance.now()

        // IntersectionObserver — only animate when visible
        const observer = new IntersectionObserver(
            ([entry]) => {
                visibleRef.current = entry.isIntersecting
                if (entry.isIntersecting && !animRef.current) {
                    startTimeRef.current = performance.now()
                    animRef.current = requestAnimationFrame(loop)
                }
            },
            { threshold: 0.1 }
        )
        observer.observe(canvas)

        function loop(time: number) {
            if (!visibleRef.current || !ctx || !canvas) {
                animRef.current = 0
                return
            }

            const w = canvas.width / (window.devicePixelRatio || 1)
            const h = canvas.height / (window.devicePixelRatio || 1)
            const elapsed = (time - startTimeRef.current) / 1000

            ctx.clearRect(0, 0, w, h)
            ctx.globalAlpha = opacity

            // Update position based on animation
            if (animation === 'swim') {
                posRef.current.x += dx * speed * (1 / 60)
                posRef.current.y =
                    (h - totalH) / 2 + Math.sin(elapsed * 0.8) * 30

                // Wrap around when off-screen
                if (dx < 0 && posRef.current.x < -totalW - 50) {
                    posRef.current.x = w + 50
                } else if (dx > 0 && posRef.current.x > w + 50) {
                    posRef.current.x = -totalW - 50
                }
            } else if (animation === 'float') {
                const cx = (w - totalW) / 2
                const cy = (h - totalH) / 2
                posRef.current.x = cx + Math.sin(elapsed * 0.3) * 15
                posRef.current.y = cy + Math.sin(elapsed * 0.5) * 10
            }

            // Draw pixels
            const px = posRef.current.x
            const py = posRef.current.y
            for (let row = 0; row < shapeH; row++) {
                for (let col = 0; col < shapeW; col++) {
                    const color = pixelMap[row][col]
                    if (!color) continue

                    // Edge dissolve effect — pixels near edges flicker
                    const isEdge =
                        row === 0 ||
                        row === shapeH - 1 ||
                        col === 0 ||
                        col === shapeW - 1 ||
                        !pixelMap[row - 1]?.[col] ||
                        !pixelMap[row + 1]?.[col] ||
                        !pixelMap[row][col - 1] ||
                        !pixelMap[row][col + 1]

                    if (isEdge) {
                        const flicker =
                            0.3 +
                            0.7 *
                                (0.5 +
                                    0.5 *
                                        Math.sin(
                                            elapsed * 3 +
                                                row * 0.5 +
                                                col * 0.7
                                        ))
                        ctx.globalAlpha = opacity * flicker
                    } else {
                        ctx.globalAlpha = opacity
                    }

                    ctx.fillStyle = color
                    ctx.fillRect(
                        px + col * (pixelSize + gap),
                        py + row * (pixelSize + gap),
                        pixelSize,
                        pixelSize
                    )
                }
            }

            // Draw particles
            ctx.globalAlpha = 1
            for (const p of particlesRef.current) {
                p.x += p.vx
                p.y += p.vy
                p.life++

                // Fade in then out
                const progress = p.life / p.maxLife
                if (progress < 0.2) {
                    p.alpha = (progress / 0.2) * opacity * 0.6
                } else if (progress > 0.8) {
                    p.alpha = ((1 - progress) / 0.2) * opacity * 0.6
                } else {
                    p.alpha = opacity * 0.6
                }

                // Respawn dead particles
                if (p.life >= p.maxLife) {
                    const newP = spawnParticle(w, h)
                    p.x = newP.x
                    p.y = newP.y
                    p.vx = newP.vx
                    p.vy = newP.vy
                    p.alpha = 0
                    p.life = 0
                    p.maxLife = newP.maxLife
                    p.size = newP.size
                }

                ctx.globalAlpha = p.alpha
                ctx.fillStyle = p.color
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
            }

            animRef.current = requestAnimationFrame(loop)
        }

        // Handle resize
        const onResize = () => {
            resize()
        }
        window.addEventListener('resize', onResize)

        return () => {
            observer.disconnect()
            window.removeEventListener('resize', onResize)
            if (animRef.current) {
                cancelAnimationFrame(animRef.current)
                animRef.current = 0
            }
        }
    }, [pixelMap, pixelSize, animation, speed, direction, opacity, particleCount, gap, dx, dy, shapeW, shapeH, totalW, totalH, spawnParticle])

    return (
        <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${className ?? ''}`}
        />
    )
}
