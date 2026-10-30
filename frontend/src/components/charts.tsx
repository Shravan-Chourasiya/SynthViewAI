import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from './theme-context'
import { cn } from '@/lib/utils'

export function useChartTheme() {
  // useTheme is backed by useSyncExternalStore. Recharts receives CSS variable
  // references, so its SVG colors resolve directly against the root theme.
  useTheme()
  return {
    series: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'],
    grid: 'var(--grid-line)',
    axis: 'var(--muted-foreground)',
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const CHART_SWATCHES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

function ChartTooltip({ active, payload, label, unit = '' }: any) {
  const { series } = useChartTheme()
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
      {label ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      ) : null}
      <div className="mt-1 space-y-0.5">
        {payload.map((entry: any, i: number) => (
          <p key={i} className="flex items-center gap-2 text-xs">
            <span className={cn('size-2 rounded-full', CHART_SWATCHES[Math.max(0, series.indexOf(entry.color ?? entry.fill))])} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-mono tabular-nums">{entry.value}{unit}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

const axisProps = (color: string) => ({
  stroke: color,
  tick: { fill: color, fontSize: 10, fontFamily: 'var(--font-mono)' },
  tickLine: false,
  axisLine: false,
})

export function ScoreTrendChart({
  data,
  height = 240,
  showBenchmark = true,
  className,
}: {
  data: { label: string; score: number; benchmark?: number }[]
  height?: number
  showBenchmark?: boolean
  className?: string
}) {
  const { series, grid, axis } = useChartTheme()
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series[0]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={series[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps(axis)} />
          <YAxis domain={[40, 100]} {...axisProps(axis)} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="score"
            name="Score"
            stroke={series[0]}
            strokeWidth={2}
            fill="url(#score-fill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          {showBenchmark ? (
            <Line
              type="monotone"
              dataKey="benchmark"
              name="Cohort"
              stroke={axis}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Sparkline({
  data,
  height = 48,
  className,
}: {
  data: number[]
  height?: number
  className?: string
}) {
  const { series } = useChartTheme()
  const rows = data.map((score, i) => ({ i, score }))
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="score" stroke={series[0]} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryBarChart({
  data,
  height = 240,
  className,
}: {
  data: { category: string; score: number }[]
  height?: number
  className?: string
}) {
  const { series, grid, axis } = useChartTheme()
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="category" {...axisProps(axis)} interval={0} angle={-12} dy={8} height={48} />
          <YAxis domain={[0, 100]} {...axisProps(axis)} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: grid }} />
          <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]} className="chart-bar">
            {data.map((entry, i) => (
              <Cell
                key={entry.category}
                fill={entry.score >= 82 ? series[1] : entry.score >= 70 ? series[0] : entry.score >= 58 ? series[2] : series[3]}
                opacity={0.9 - i * 0.02}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SkillRadarChart({
  data,
  height = 280,
  className,
}: {
  data: { skill: string; score: number }[]
  height?: number
  className?: string
}) {
  const { series, grid, axis } = useChartTheme()
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={grid} />
          <PolarAngleAxis dataKey="skill" tick={{ fill: axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Radar dataKey="score" name="Score" stroke={series[0]} fill={series[0]} fillOpacity={0.22} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DifficultyLineChart({
  data,
  height = 220,
  className,
}: {
  data: { label: string; score: number }[]
  height?: number
  className?: string
}) {
  const { series, grid, axis } = useChartTheme()
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps(axis)} />
          <YAxis domain={[40, 100]} {...axisProps(axis)} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke={series[1]}
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: series[1] }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StatusDonut({
  data,
  height = 220,
  className,
}: {
  data: { status: string; count: number }[]
  height?: number
  className?: string
}) {
  const { series, axis } = useChartTheme()
  const total = data.reduce((sum, d) => sum + d.count, 0)
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 24 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="status" width={92} {...axisProps(axis)} />
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Bar dataKey="count" name="Sessions" radius={[0, 4, 4, 0]} className="chart-bar">
            {data.map((entry, i) => (
              <Cell key={entry.status} fill={series[i % series.length]} opacity={total ? 0.9 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CohortChart({
  data,
  height = 240,
  className,
}: {
  data: { label: string; users: number; interviews: number }[]
  height?: number
  className?: string
}) {
  const { series, grid, axis } = useChartTheme()
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps(axis)} />
          <YAxis {...axisProps(axis)} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: grid }} />
          <Bar dataKey="users" name="Signups" fill={series[0]} radius={[4, 4, 0, 0]} className="chart-bar" />
          <Bar dataKey="interviews" name="Sessions" fill={series[1]} radius={[4, 4, 0, 0]} className="chart-bar" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
