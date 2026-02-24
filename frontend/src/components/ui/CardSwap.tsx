import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import gsap from 'gsap'
import css from './CardSwap.module.css'

export interface CardSwapProps {
  width?: number | string
  height?: number | string
  cardDistance?: number
  verticalDistance?: number
  delay?: number
  pauseOnHover?: boolean
  onCardClick?: (idx: number) => void
  skewAmount?: number
  easing?: 'linear' | 'elastic'
  children: ReactNode
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  customClass?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, ...rest }, ref) => (
  <div ref={ref} {...rest} className={`${css.card} ${customClass ?? ''} ${rest.className ?? ''}`.trim()} />
))
Card.displayName = 'Card'

type CardRef = RefObject<HTMLDivElement | null>
interface Slot { x: number; y: number; z: number; zIndex: number }

const makeSlot = (i: number, dx: number, dy: number, total: number): Slot => ({
  x: i * dx, y: -i * dy, z: -i * Math.abs(dx) * 1.5, zIndex: total - i,
})

const placeNow = (el: HTMLElement, slot: Slot, skew: number) =>
  gsap.set(el, {
    x: slot.x, y: slot.y, z: slot.z,
    xPercent: -50, yPercent: -50, skewY: skew,
    transformOrigin: 'center center', zIndex: slot.zIndex, force3D: true,
  })

const CardSwap: React.FC<CardSwapProps> = ({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onCardClick,
  skewAmount = 6,
  easing = 'elastic',
  children,
}) => {
  const config = easing === 'elastic'
    ? { ease: 'elastic.out(0.6,0.9)', durDrop: 1.0, durMove: 1.0, durReturn: 1.0, promoteOverlap: 0.9, returnDelay: 0.05 }
    : { ease: 'power1.inOut', durDrop: 0.5, durMove: 0.5, durReturn: 0.5, promoteOverlap: 0.45, returnDelay: 0.2 }

  const childArr = useMemo(() => Children.toArray(children) as ReactElement<CardProps>[], [children])
  const refs = useMemo<CardRef[]>(() => childArr.map(() => React.createRef<HTMLDivElement>()), [childArr.length])
  const order = useRef<number[]>(Array.from({ length: childArr.length }, (_, i) => i))
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const timeoutRef = useRef<number>(0)
  const stoppedRef = useRef<boolean>(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    stoppedRef.current = false
    const total = refs.length
    refs.forEach((r, i) => placeNow(r.current!, makeSlot(i, cardDistance, verticalDistance, total), skewAmount))

    const pausedRef = { current: false }

    const swap = () => {
      if (stoppedRef.current || pausedRef.current || order.current.length < 2) return
      const [front, ...rest] = order.current
      const elFront = refs[front].current!
      const tl = gsap.timeline({
        onComplete: () => {
          order.current = [...rest, front]
          if (!stoppedRef.current && !pausedRef.current) {
            timeoutRef.current = window.setTimeout(swap, delay)
          }
        },
      })
      tlRef.current = tl

      tl.to(elFront, { y: '+=500', duration: config.durDrop, ease: config.ease })
      tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`)

      rest.forEach((idx, i) => {
        const slot = makeSlot(i, cardDistance, verticalDistance, total)
        tl.set(refs[idx].current!, { zIndex: slot.zIndex }, 'promote')
        tl.to(refs[idx].current!, { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease }, `promote+=${i * 0.15}`)
      })

      const backSlot = makeSlot(total - 1, cardDistance, verticalDistance, total)
      tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`)
      tl.call(() => { gsap.set(elFront, { zIndex: backSlot.zIndex }) }, undefined, 'return')
      tl.to(elFront, { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease }, 'return')
    }

    const scheduleNext = () => {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(swap, delay)
    }

    const pause = () => {
      pausedRef.current = true
      tlRef.current?.pause()
      clearTimeout(timeoutRef.current)
    }

    const resume = () => {
      if (stoppedRef.current) return
      pausedRef.current = false
      const tl = tlRef.current
      if (tl && tl.progress() < 1) {
        tl.play()
      } else {
        scheduleNext()
      }
    }

    // Recover from tab switches
    const onVisibility = () => {
      if (stoppedRef.current) return
      if (document.hidden) {
        pause()
      } else {
        resume()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    timeoutRef.current = window.setTimeout(swap, 500)

    if (pauseOnHover && container.current) {
      const node = container.current
      node.addEventListener('mouseenter', pause)
      node.addEventListener('mouseleave', resume)
      return () => {
        stoppedRef.current = true
        node.removeEventListener('mouseenter', pause)
        node.removeEventListener('mouseleave', resume)
        document.removeEventListener('visibilitychange', onVisibility)
        clearTimeout(timeoutRef.current)
        tlRef.current?.kill()
      }
    }
    return () => {
      stoppedRef.current = true
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(timeoutRef.current)
      tlRef.current?.kill()
    }
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing])

  const rendered = childArr.map((child, i) =>
    isValidElement<CardProps>(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width, height, ...(child.props.style ?? {}) },
          onClick: (e: React.MouseEvent<HTMLDivElement>) => { child.props.onClick?.(e); onCardClick?.(i) },
        } as CardProps & React.RefAttributes<HTMLDivElement>)
      : child
  )

  return (
    <div ref={container} className={css.container} style={{ width, height }}>
      {rendered}
    </div>
  )
}

export default CardSwap
