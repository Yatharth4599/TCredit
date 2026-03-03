import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion'

interface AnimatedNumberProps {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  format?: (v: number) => string
  duration?: number
  className?: string
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix,
  suffix,
  format,
  duration = 1.4,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true) },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!active || !ref.current) return
    const ctrl = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) {
          ref.current.textContent = format
            ? format(v)
            : `${prefix ?? ''}${v.toFixed(decimals)}${suffix ?? ''}`
        }
      },
    })
    return () => ctrl.stop()
  }, [active, value, decimals, prefix, suffix, format, duration])

  const initialText = format
    ? format(value)
    : `${prefix ?? ''}${value.toFixed(decimals)}${suffix ?? ''}`

  return (
    <span ref={ref} className={className}>
      {initialText}
    </span>
  )
}
