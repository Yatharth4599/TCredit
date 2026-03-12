import { useEffect, useRef } from 'react'
import { motion, useAnimation, useInView } from 'motion/react'

/* ── Stage definitions ─────────────────────────────────────────── */
const STAGES = [
  {
    id: 'earn',
    label: 'Agent Earns',
    sub: 'Revenue',
    color: '#60A5FA',
    // Bot / agent icon
    icon: 'M12 2a2 2 0 012 2v1h2a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2h2V4a2 2 0 012-2zm-1 6H9v2h2V8zm4 0h-2v2h2V8zm-2 4H9v2h4v-2z',
  },
  {
    id: 'vault',
    label: 'Revenue → Vault',
    sub: 'Deposited on-chain',
    color: '#3B82F6',
    // Lock / vault icon
    icon: 'M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-6 9a3 3 0 110-6 3 3 0 010 6zm3-9H9V6a3 3 0 116 0v2z',
  },
  {
    id: 'credit',
    label: 'Credit Line',
    sub: 'Backed by revenue',
    color: '#06B6D4',
    // Credit card icon
    icon: 'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 1v3h14V6H5zm0 5v6h14v-6H5zm2 2h3v2H7v-2z',
  },
  {
    id: 'repay',
    label: 'Auto-Repay',
    sub: 'Waterfall split',
    color: '#10B981',
    // Refresh / cycle icon
    icon: 'M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 013.51 15',
  },
]

/* ── Layout ─────────────────────────────────────────────────────── */
const W = 520
const H = 440
const CX = W / 2
const CY = H / 2

// Stage positions: arranged in a diamond/rhombus loop
// Top → Right → Bottom → Left
const POSITIONS = [
  { x: CX, y: 50 },       // top center
  { x: W - 70, y: CY },   // right
  { x: CX, y: H - 50 },   // bottom center
  { x: 70, y: CY },        // left
]

const NODE_W = 140
const NODE_H = 60

/* ── Particle along a quadratic path ────────────────────────────── */
function Particle({
  path, color, delay, duration = 1.6,
}: {
  id: string; path: string; color: string; delay: number; duration?: number
}) {
  return (
    <>
      <motion.circle
        r={3}
        fill={color}
        opacity={0}
      >
        <animateMotion
          dur={`${duration}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
          path={path}
          fill="freeze"
        />
        <animate
          attributeName="opacity"
          values="0;0.9;0.9;0"
          dur={`${duration}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="1.5;3;3;1"
          dur={`${duration}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </motion.circle>
    </>
  )
}

/* ── Build curved path between two stage positions ──────────────── */
function curvePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  // Pull control point toward center for a nice curve
  const cpx = mx + (CX - mx) * 0.5
  const cpy = my + (CY - my) * 0.5
  return `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${to.x} ${to.y}`
}

/* ── Stage node icon (simplified SVG path) ──────────────────────── */
function StageIcon({ d, color, isStroke }: { d: string; color: string; isStroke?: boolean }) {
  if (isStroke) {
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="scale(0.7) translate(-5, -5)"
      />
    )
  }
  return (
    <path
      d={d}
      fill={color}
      opacity="0.9"
      transform="scale(0.7) translate(-5, -5)"
    />
  )
}

/* ── Main component ─────────────────────────────────────────────── */
export default function RevenueRoutingNode({ className = '' }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: false, margin: '-60px' })
  const nodeCtrl = useAnimation()

  useEffect(() => {
    if (inView) {
      nodeCtrl.start({ scale: 1, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } })
    }
  }, [inView, nodeCtrl])

  // Build paths between consecutive stages (and last → first)
  const paths = STAGES.map((_, i) => {
    const from = POSITIONS[i]
    const to = POSITIONS[(i + 1) % STAGES.length]
    return curvePath(from, to)
  })

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        {/* Glow filters */}
        <filter id="acl-glow-node" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="acl-glow-line" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Path gradients */}
        {STAGES.map((stage, i) => {
          const next = STAGES[(i + 1) % STAGES.length]
          return (
            <linearGradient key={stage.id} id={`acl-grad-${stage.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={stage.color} stopOpacity="0.6" />
              <stop offset="100%" stopColor={next.color} stopOpacity="0.6" />
            </linearGradient>
          )
        })}

        {/* Central krexa gradient */}
        <radialGradient id="acl-center-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.15" />
        </radialGradient>
      </defs>

      {/* ── Connection paths ── */}
      {paths.map((d, i) => (
        <motion.path
          key={STAGES[i].id}
          d={d}
          stroke={`url(#acl-grad-${STAGES[i].id})`}
          strokeWidth="2"
          fill="none"
          filter="url(#acl-glow-line)"
          strokeDasharray="6 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.15 * i, ease: 'easeOut' }}
        />
      ))}

      {/* ── Particles on each path ── */}
      {inView && paths.map((d, i) =>
        [0, 0.8, 1.6].map((off, j) => (
          <Particle
            key={`p-${STAGES[i].id}-${j}`}
            id={`p-${STAGES[i].id}-${j}`}
            path={d}
            color={STAGES[i].color}
            delay={i * 0.4 + off}
            duration={1.8}
          />
        ))
      )}

      {/* ── Central Krexa badge ── */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={nodeCtrl}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <circle cx={CX} cy={CY} r={32} fill="url(#acl-center-grad)" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
        <motion.circle
          cx={CX} cy={CY} r={40}
          fill="none"
          stroke="rgba(59,130,246,0.1)"
          strokeWidth="1"
          animate={{ r: [40, 48, 40] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <text
          x={CX} y={CY - 4}
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          fontFamily="'Outfit', sans-serif"
          letterSpacing="1.5"
          fill="#60A5FA"
        >
          KREXA
        </text>
        <text
          x={CX} y={CY + 10}
          textAnchor="middle"
          fontSize="7"
          fontWeight="500"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.5"
          fill="rgba(148,163,184,0.7)"
        >
          PROTOCOL
        </text>
      </motion.g>

      {/* ── Stage nodes ── */}
      {STAGES.map((stage, i) => {
        const pos = POSITIONS[i]
        const isRepayStage = stage.id === 'repay'
        return (
          <motion.g
            key={stage.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 + 0.15 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
          >
            {/* Node background */}
            <rect
              x={pos.x - NODE_W / 2}
              y={pos.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={12}
              fill="rgba(17,24,39,0.85)"
              stroke={stage.color}
              strokeWidth="1"
              strokeOpacity="0.35"
            />

            {/* Glow behind node */}
            <rect
              x={pos.x - NODE_W / 2}
              y={pos.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={12}
              fill="none"
              stroke={stage.color}
              strokeWidth="1"
              strokeOpacity="0.15"
              filter="url(#acl-glow-node)"
            />

            {/* Icon circle */}
            <circle
              cx={pos.x - NODE_W / 2 + 28}
              cy={pos.y}
              r={16}
              fill={`${stage.color}15`}
              stroke={stage.color}
              strokeWidth="0.5"
              strokeOpacity="0.3"
            />

            {/* Icon */}
            <g transform={`translate(${pos.x - NODE_W / 2 + 16}, ${pos.y - 12})`}>
              <StageIcon d={stage.icon} color={stage.color} isStroke={isRepayStage} />
            </g>

            {/* Stage number badge */}
            <circle
              cx={pos.x - NODE_W / 2 + 8}
              cy={pos.y - NODE_H / 2 + 8}
              r={8}
              fill={stage.color}
              opacity="0.9"
            />
            <text
              x={pos.x - NODE_W / 2 + 8}
              y={pos.y - NODE_H / 2 + 12}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#050A12"
              fontFamily="'Inter', sans-serif"
            >
              {i + 1}
            </text>

            {/* Label */}
            <text
              x={pos.x + 4}
              y={pos.y - 6}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#F1F5F9"
              fontFamily="'Inter', sans-serif"
            >
              {stage.label}
            </text>

            {/* Sub-label */}
            <text
              x={pos.x + 4}
              y={pos.y + 10}
              textAnchor="middle"
              fontSize="9"
              fill="#94A3B8"
              fontFamily="'JetBrains Mono', monospace"
            >
              {stage.sub}
            </text>
          </motion.g>
        )
      })}

      {/* ── Direction arrows on paths ── */}
      {STAGES.map((stage, i) => {
        const from = POSITIONS[i]
        const to = POSITIONS[(i + 1) % STAGES.length]
        const mx = (from.x + to.x) / 2 + (CX - (from.x + to.x) / 2) * 0.25
        const my = (from.y + to.y) / 2 + (CY - (from.y + to.y) / 2) * 0.25
        const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
        return (
          <motion.g
            key={`arrow-${stage.id}`}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 0.6 } : {}}
            transition={{ delay: 0.6 + 0.1 * i }}
          >
            <polygon
              points="0,-4 8,0 0,4"
              fill={stage.color}
              transform={`translate(${mx},${my}) rotate(${angle})`}
            />
          </motion.g>
        )
      })}
    </svg>
  )
}
