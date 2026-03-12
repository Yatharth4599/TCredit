import React, { useEffect, useRef } from 'react'
import css from './NoiseBackground.module.css'

interface NoiseBackgroundProps {
  children: React.ReactNode
  gradientColors?: string[]
  containerClassName?: string
}

export default function NoiseBackground({
  children,
  gradientColors = ['#3B82F6', '#2563EB', '#60A5FA'],
  containerClassName = '',
}: NoiseBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 200
    canvas.width = size
    canvas.height = size

    const imageData = ctx.createImageData(size, size)
    const { data } = imageData
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 20 // low opacity noise
    }
    ctx.putImageData(imageData, 0, 0)
  }, [])

  const gradient = `linear-gradient(135deg, ${gradientColors.join(', ')})`

  return (
    <div
      className={`${css.wrapper} ${containerClassName}`}
      style={{ background: gradient }}
    >
      <canvas ref={canvasRef} className={css.noise} aria-hidden />
      <div className={css.inner}>{children}</div>
    </div>
  )
}
