import { useRef, useEffect, useCallback } from 'react'
import styles from './AsciiRain.module.css'

const CHARSET = 'KREXA01アイウエオカキクケコ.:;|╎─═╗╔'
const FONT_SIZE = 14
const COLOR = [170, 170, 170] // #AAAAAA — gray, no cyan
const MAX_OPACITY = 0.35
const TAIL_LENGTH = 14
const BASE_SPEED = 1.0

interface Column {
  x: number
  y: number
  speed: number
  chars: string[]
  delay: number
}

function randomChar() {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)]
}

export default function AsciiRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const columnsRef = useRef<Column[]>([])
  const rafRef = useRef<number>(0)
  const visibleRef = useRef(true)

  const initColumns = useCallback((width: number) => {
    const count = Math.floor(width / FONT_SIZE)
    const cols: Column[] = []
    for (let i = 0; i < count; i++) {
      const chars: string[] = []
      for (let j = 0; j < TAIL_LENGTH + 4; j++) chars.push(randomChar())
      cols.push({
        x: i * FONT_SIZE,
        y: -Math.random() * 600,
        speed: BASE_SPEED * (0.6 + Math.random() * 0.8),
        chars,
        delay: 0,
      })
    }
    columnsRef.current = cols
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Respect reduced motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.scale(dpr, dpr)
      initColumns(w)
    }

    resize()
    window.addEventListener('resize', resize)

    // Visibility gating
    const obs = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0.1 }
    )
    obs.observe(canvas)

    // Animation loop
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      if (!visibleRef.current) return

      const w = canvas.width / dpr
      const h = canvas.height / dpr

      ctx.clearRect(0, 0, w, h)
      ctx.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`
      ctx.textBaseline = 'top'

      const cols = columnsRef.current
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i]

        if (col.delay > 0) {
          col.delay -= 16
          continue
        }

        col.y += col.speed

        // Draw tail characters
        for (let j = 0; j < TAIL_LENGTH; j++) {
          const charY = col.y - j * FONT_SIZE
          if (charY < -FONT_SIZE || charY > h) continue

          const fade = 1 - j / TAIL_LENGTH
          const opacity = MAX_OPACITY * fade * fade // quadratic falloff
          if (opacity < 0.01) continue

          ctx.fillStyle = `rgba(${COLOR[0]},${COLOR[1]},${COLOR[2]},${opacity})`
          ctx.fillText(col.chars[j % col.chars.length], col.x, charY)
        }

        // Randomly swap a character in the tail
        if (Math.random() < 0.03) {
          const idx = Math.floor(Math.random() * col.chars.length)
          col.chars[idx] = randomChar()
        }

        // Reset column when head passes bottom
        if (col.y - TAIL_LENGTH * FONT_SIZE > h) {
          col.y = -FONT_SIZE * (2 + Math.random() * 8)
          col.speed = BASE_SPEED * (0.6 + Math.random() * 0.8)
          col.delay = Math.random() * 3000
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      obs.disconnect()
    }
  }, [initColumns])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
