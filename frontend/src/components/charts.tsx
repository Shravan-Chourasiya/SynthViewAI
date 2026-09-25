import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export function Sparkline({
  values,
  height = 64,
  stroke = 'var(--chart-1)',
  className,
}: {
  values: number[]
  height?: number
  stroke?: string
  className?: string
}) {
  const geometry = useMemo(() => {
    if (values.length < 2) return null
    const w = 240
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const pad = 6
    const pts = values.map((v, i) => [
      pad + (i * (w - pad * 2)) / (values.length - 1),
      pad + (height - pad * 2) * (1 - (v - min) / range),
    ])
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height - pad} L${pts[0][0].toFixed(1)},${height - pad} Z`
    return { w, pts, line, area }
  }, [height, values])

  if (values.length < 2) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-secondary/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        Not enough data yet
      </div>
    )
  }

  const { w, pts, line, area } = geometry!

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className={cn('w-full', className)}
      style={{ height }}
      role="img"
      aria-label={`Score trend from ${values[0]} to ${values[values.length - 1]}`}
    >
      <path d={area} fill={stroke} opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r={3}
        fill={stroke}
      />
    </svg>
  )
}

export function Bars({
  data,
  height = 140,
  color = 'var(--chart-1)',
  className,
}: {
  data: { label: string; value: number }[]
  height?: number
  color?: string
  className?: string
}) {
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data])
  return (
    <div className={cn('flex items-end gap-3', className)} style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {d.value}
          </span>
          <div
            className="print-chart-bar w-full max-w-10 rounded-t-md"
            style={{
              height: `${(d.value / max) * 78}%`,
              backgroundColor: color,
              opacity: 0.55 + 0.45 * (d.value / max),
            }}
          />
          <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ScoreRing({
  value,
  size = 120,
  stroke = 10,
}: {
  value: number
  size?: number
  stroke?: number
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - clamped / 100)
  // Draw the arc in on mount: the ring is the hero number of the report, and it
  // previously jumped to its final value while every other metric on the page
  // eased in. The CSS transition animates strokeDashoffset from empty to the
  // value one frame after mount. The early-return branch for reduced motion
  // relies on the same rAF callback (the flag just makes it a no-op), so there is
  // exactly one setState site and it never runs synchronously in the effect body.
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    if (drawn) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const raf = requestAnimationFrame(() => setDrawn(!reduce))
    return () => cancelAnimationFrame(raf)
  }, [drawn])
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Score: ${value} out of 100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={drawn ? offset : circ}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono font-semibold tabular-nums" style={{ fontSize: size / 4.5 }}>
          {value}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}
