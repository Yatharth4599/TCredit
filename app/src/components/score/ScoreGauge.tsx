function scoreColor(score: number): string {
  if (score >= 750) return '#3b82f6'
  if (score >= 650) return '#22c55e'
  if (score >= 500) return '#eab308'
  if (score >= 400) return '#f97316'
  return '#ef4444'
}

function scoreColorClass(score: number): string {
  if (score >= 750) return 'text-blue-400'
  if (score >= 650) return 'text-green-400'
  if (score >= 500) return 'text-yellow-400'
  if (score >= 400) return 'text-orange-400'
  return 'text-red-400'
}

export function ScoreGauge({ score }: { score: number }) {
  const min = 200
  const max = 850
  const pct = Math.max(0, Math.min(1, (score - min) / (max - min)))
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct * 0.75)
  const color = scoreColor(score)

  return (
    <div className="relative w-56 h-56 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-[135deg]">
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="14"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold ${scoreColorClass(score)}`}>{score}</span>
        <span className="text-xs text-gray-400 mt-1">out of 850</span>
      </div>
    </div>
  )
}
