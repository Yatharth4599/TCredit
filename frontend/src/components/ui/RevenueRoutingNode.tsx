import { useEffect, useRef } from 'react'
import { motion, useAnimation, useInView } from 'motion/react'

// Stream colours
const INPUTS = [
  { id: 'stripe',   label: 'Stripe',    color: '#6366f1', y: 80  },
  { id: 'paypal',   label: 'PayPal',    color: '#22c55e', y: 160 },
  { id: 'usdc',     label: 'USDC',      color: '#a855f7', y: 240 },
  { id: 'bank',     label: 'ACH/Bank',  color: '#f59e0b', y: 320 },
]

const OUTPUTS = [
  { id: 'senior',    label: 'Senior',    color: '#3b82f6', pct: '20%', y: 70  },
  { id: 'pool',      label: 'Pool',      color: '#a855f7', pct: '10%', y: 150 },
  { id: 'community', label: 'Community', color: '#f59e0b', pct: '5%',  y: 230 },
  { id: 'merchant',  label: 'Merchant',  color: '#22c55e', pct: '65%', y: 310 },
]

const W = 560
const H = 400
const NODE_X = W / 2
const NODE_Y = H / 2
const NODE_R = 46
const INPUT_X = 60
const OUTPUT_X = W - 60

function Particle({
  id, fromX, fromY, toX, toY, color, delay,
}: {
  id: string; fromX: number; fromY: number; toX: number; toY: number; color: string; delay: number
}) {
  return (
    <motion.circle
      key={id}
      cx={fromX}
      cy={fromY}
      r={3}
      fill={color}
      opacity={0.9}
      animate={{
        cx: [fromX, toX],
        cy: [fromY, toY],
        opacity: [0, 0.9, 0.9, 0],
        scale: [0.5, 1, 1, 0.3],
      }}
      transition={{
        duration: 1.8,
        delay,
        repeat: Infinity,
        repeatDelay: 0.4,
        ease: 'easeInOut',
      }}
    />
  )
}

export default function RevenueRoutingNode({ className = '' }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: false, margin: '-80px' })
  const nodeCtrl = useAnimation()

  useEffect(() => {
    if (inView) {
      nodeCtrl.start({ scale: 1, opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } })
    }
  }, [inView, nodeCtrl])

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        {/* Glows */}
        <filter id="rrn-glow-node" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="rrn-glow-line" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Gradients for input lines */}
        {INPUTS.map(inp => (
          <linearGradient key={inp.id} id={`grad-in-${inp.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={inp.color} stopOpacity="0.1" />
            <stop offset="60%"  stopColor={inp.color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={inp.color} stopOpacity="0.3" />
          </linearGradient>
        ))}

        {/* Gradients for output lines */}
        {OUTPUTS.map(out => (
          <linearGradient key={out.id} id={`grad-out-${out.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={out.color} stopOpacity="0.3" />
            <stop offset="40%"  stopColor={out.color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={out.color} stopOpacity="0.1" />
          </linearGradient>
        ))}

        {/* Node radial gradient */}
        <radialGradient id="rrn-node-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%"  stopColor="#FF8533" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#CC4A00" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* ── Input lines ── */}
      {INPUTS.map((inp, i) => {
        // Bezier: start at left edge, curve into node
        const cx1 = INPUT_X + (NODE_X - NODE_R - INPUT_X) * 0.5
        const cy1 = inp.y
        const cx2 = NODE_X - NODE_R - 20
        const cy2 = NODE_Y
        return (
          <motion.path
            key={inp.id}
            d={`M ${INPUT_X} ${inp.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${NODE_X - NODE_R} ${NODE_Y}`}
            stroke={`url(#grad-in-${inp.id})`}
            strokeWidth="2"
            fill="none"
            filter="url(#rrn-glow-line)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
          />
        )
      })}

      {/* ── Output lines ── */}
      {OUTPUTS.map((out, i) => {
        const cx1 = NODE_X + NODE_R + 20
        const cy1 = NODE_Y
        const cx2 = OUTPUT_X - (OUTPUT_X - NODE_X - NODE_R) * 0.5
        const cy2 = out.y
        return (
          <motion.path
            key={out.id}
            d={`M ${NODE_X + NODE_R} ${NODE_Y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${OUTPUT_X} ${out.y}`}
            stroke={`url(#grad-out-${out.id})`}
            strokeWidth="2"
            fill="none"
            filter="url(#rrn-glow-line)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.4 + 0.1 * i, ease: 'easeOut' }}
          />
        )
      })}

      {/* ── Particles on input streams ── */}
      {inView && INPUTS.map((inp, i) =>
        [0, 0.7, 1.4].map((off, j) => (
          <Particle
            key={`${inp.id}-${j}`}
            id={`${inp.id}-${j}`}
            fromX={INPUT_X}
            fromY={inp.y}
            toX={NODE_X - NODE_R}
            toY={NODE_Y}
            color={inp.color}
            delay={i * 0.3 + off + 0.8}
          />
        ))
      )}

      {/* ── Particles on output streams ── */}
      {inView && OUTPUTS.map((out, i) =>
        [0, 0.8, 1.6].map((off, j) => (
          <Particle
            key={`${out.id}-${j}`}
            id={`${out.id}-${j}`}
            fromX={NODE_X + NODE_R}
            fromY={NODE_Y}
            toX={OUTPUT_X}
            toY={out.y}
            color={out.color}
            delay={i * 0.25 + off + 1.2}
          />
        ))
      )}

      {/* ── Input labels & dots ── */}
      {INPUTS.map((inp, i) => (
        <motion.g
          key={inp.id}
          initial={{ opacity: 0, x: -10 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.05 * i }}
        >
          <circle cx={INPUT_X} cy={inp.y} r="5" fill={inp.color} opacity="0.8" />
          <text x={INPUT_X - 12} y={inp.y + 4} textAnchor="end" fontSize="11" fill={inp.color} fontFamily="monospace" opacity="0.85">
            {inp.label}
          </text>
        </motion.g>
      ))}

      {/* ── Output labels & dots ── */}
      {OUTPUTS.map((out, i) => (
        <motion.g
          key={out.id}
          initial={{ opacity: 0, x: 10 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.4 + 0.05 * i }}
        >
          <circle cx={OUTPUT_X} cy={out.y} r="5" fill={out.color} opacity="0.8" />
          <text x={OUTPUT_X + 12} y={out.y - 2} textAnchor="start" fontSize="11" fill={out.color} fontFamily="monospace" opacity="0.85">
            {out.label}
          </text>
          <text x={OUTPUT_X + 12} y={out.y + 12} textAnchor="start" fontSize="10" fill={out.color} fontFamily="monospace" opacity="0.5">
            {out.pct}
          </text>
        </motion.g>
      ))}

      {/* ── Central Node glow halo ── */}
      <motion.circle
        cx={NODE_X}
        cy={NODE_Y}
        r={NODE_R + 18}
        fill="rgba(255,92,0,0.06)"
        stroke="rgba(255,92,0,0.12)"
        strokeWidth="1"
        animate={{ r: [NODE_R + 18, NODE_R + 26, NODE_R + 18] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Central Node ── */}
      <motion.circle
        cx={NODE_X}
        cy={NODE_Y}
        r={NODE_R}
        fill="url(#rrn-node-grad)"
        stroke="rgba(255,133,51,0.5)"
        strokeWidth="1.5"
        filter="url(#rrn-glow-node)"
        initial={{ scale: 0, opacity: 0 }}
        animate={nodeCtrl}
      />

      {/* Node label */}
      <motion.text
        x={NODE_X}
        y={NODE_Y - 6}
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fontFamily="'Outfit', sans-serif"
        letterSpacing="2"
        fill="#000"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.6 }}
      >
        KREXA
      </motion.text>
      <motion.text
        x={NODE_X}
        y={NODE_Y + 12}
        textAnchor="middle"
        fontSize="8"
        fontWeight="500"
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing="1"
        fill="rgba(0,0,0,0.7)"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.7 }}
      >
        NODE
      </motion.text>
    </svg>
  )
}
