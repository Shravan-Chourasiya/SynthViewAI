import { useEffect, useRef, useState } from 'react'
import { Check, ArrowUpRight, TrendingUp } from 'lucide-react'
import { Section } from '@/components/section'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/utils'

function useCountUp(target: number, inView: boolean, duration = 1400) {
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    let current = 0
    const step = target / (duration / 16)
    const id = setInterval(() => {
      current = Math.min(current + step, target)
      setVal(Math.floor(current))
      if (current >= target) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [inView, target, duration])

  return val
}

const strengths = [
  'Strong problem-solving',
  'Clear technical reasoning',
  'Good communication',
]

const improvements = [
  'System design depth',
  'Edge-case analysis',
  'Time management',
]

const topics = [
  { label: 'Data Structures', value: 86 },
  { label: 'Algorithms', value: 80 },
  { label: 'System Design', value: 64 },
  { label: 'Communication', value: 90 },
]

const questions = [
  { q: 'Two Sum', level: 'Core', score: 92, tone: 'strong' },
  { q: 'URL Shortener Design', level: 'Advanced', score: 84, tone: 'strong' },
  { q: 'Regional Bottlenecks', level: 'Advanced', score: 71, tone: 'vague' },
  { q: 'Replica Lag Handling', level: 'Core', score: 58, tone: 'weak' },
] as const

const difficulty = ['Warm-up', 'Core', 'Advanced', 'Advanced', 'Expert']

const toneColor: Record<string, string> = {
  strong: 'text-[var(--signal-strong)]',
  vague: 'text-[var(--signal-vague)]',
  weak: 'text-[var(--signal-weak)]',
}

export function FinalReport() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)

  const score = 82
  const displayScore = useCountUp(score, inView)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  const r = 52
  const circ = 2 * Math.PI * r
  const offset = inView ? circ * (1 - score / 100) : circ

  return (
    <Section bordered>
      <SectionHeading
        eyebrow="Final report"
        title="An analysis, not a scorecard"
        description="After every interview, SynthView delivers a breakdown you can actually act on — with the reasoning behind the number."
      />
      <Reveal delay={120} className="mt-12">
        <div
          ref={ref}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="grid gap-px bg-border lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* score panel */}
            <div className="flex flex-col items-center justify-center gap-4 bg-card p-8">
              <div className="relative flex size-36 items-center justify-center">
                <svg
                  className="size-full -rotate-90"
                  viewBox="0 0 120 120"
                  role="img"
                  aria-label={`Score: ${score} out of 100`}
                >
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="var(--secondary)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    style={{
                      transition:
                        'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)',
                      transitionDelay: '300ms',
                    }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-mono text-3xl font-semibold tabular-nums">
                    {displayScore}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Overall Performance</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Technical Interview · 8 questions
                </p>
              </div>
            </div>

            {/* body */}
            <div className="bg-card p-6 sm:p-7">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--signal-strong)]">
                    Strengths
                  </p>
                  <ul className="mt-3 space-y-2">
                    {strengths.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-sm">
                        <Check className="size-3.5 text-[var(--signal-strong)]" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--signal-vague)]">
                    Areas to improve
                  </p>
                  <ul className="mt-3 space-y-2">
                    {improvements.map((s) => (
                      <li
                        key={s}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <ArrowUpRight className="size-3.5 text-[var(--signal-vague)]" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* topics */}
              <div className="mt-6 border-t border-border pt-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Topic performance
                </p>
                <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {topics.map((t, i) => (
                    <div key={t.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>{t.label}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {t.value}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out"
                          style={{
                            width: inView ? `${t.value}%` : '0%',
                            transitionDelay: `${i * 100 + 300}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* difficulty progression */}
              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-3.5 text-primary" />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Difficulty progression
                  </p>
                </div>
                <div className="mt-3 flex items-end gap-1.5">
                  {difficulty.map((d, i) => {
                    const h = [30, 55, 80, 80, 100][i]
                    return (
                      <div
                        key={i}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <div className="flex h-16 w-full items-end">
                          <div
                            className="w-full rounded-t-md bg-primary/70 transition-[height] duration-700 ease-out"
                            style={{
                              height: inView ? `${h}%` : '0%',
                              transitionDelay: `${i * 90 + 400}ms`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {d}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* question-level */}
              <div className="mt-6 border-t border-border pt-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Question-level evaluation
                </p>
                <div className="mt-3 divide-y divide-border">
                  {questions.map((qq) => (
                    <div
                      key={qq.q}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="truncate">{qq.q}</span>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {qq.level}
                        </span>
                        <span
                          className={cn(
                            'w-7 text-right font-mono tabular-nums',
                            toneColor[qq.tone],
                          )}
                        >
                          {qq.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}