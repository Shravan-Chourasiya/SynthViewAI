import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Brain,
  Camera,
  CircleSlash,
  FileText,
  MessageSquare,
  Mic,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wifi,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Eyebrow, Section, SectionHeading } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { Panel } from '@/components/ui/panel'
import { Badge, SignalBadge } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { buttonVariants } from '@/components/ui/button'
import { ScoreChip } from '@/components/stat-card'
import { TiltCard, SpotlightPanel } from '@/components/motion/tilt-card'
import { Magnetic } from '@/components/motion/magnetic'
import { ScoreOrb } from '@/components/score-orb'
import { Parallax } from '@/components/motion/parallax'
import { useMotion } from '@/components/motion-context'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { useAuthStore } from '@/lib/stores/auth-store'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------- differentiator */

const CONTRASTS = [
  { static: 'A fixed list of 20 questions, same order for everyone', adaptive: 'Each next question depends on your last answer' },
  { static: 'Scores appear days later, if at all', adaptive: 'Scores arrive while the session is still running' },
  { static: 'Difficulty is a dropdown you pick yourself', adaptive: 'Difficulty moves with your demonstrated ability' },
  { static: 'Ends when you close the tab', adaptive: 'Session state survives a refresh or a dead battery' },
]

export function Differentiator() {
  return (
    <Section id="why" border>
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Why adaptive"
            title={<>Static questionnaires measure nothing.</>}
            description="A fixed script cannot tell the difference between a rehearsed answer and real understanding. SynthView listens to the content of your answer and decides what to ask next."
          />
        </Reveal>

        <Reveal delay={80} staggerSelector="li" stagger={70}>
          <Panel flush>
            <ul className="divide-y divide-border">
              {CONTRASTS.map((row) => (
                <li key={row.static} className="grid gap-3 p-5 sm:grid-cols-2 sm:gap-6">
                  <div className="flex gap-3">
                    <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                    <p className="text-sm leading-relaxed text-muted-foreground line-through decoration-border">
                      {row.static}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed">{row.adaptive}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------- interview types */

export function InterviewTypes() {
  return (
    <Section id="interview-types" border>
      <Reveal>
        <SectionHeading
          eyebrow="Two formats"
          title="Pick the loop you are actually facing."
          description="Behavioral rounds probe judgement and collaboration. Technical rounds probe design and trade-offs. Choose one, or let the session mix them."
        />
      </Reveal>

      <Reveal staggerSelector="article" stagger={110} className="mt-12 grid gap-6 md:grid-cols-2">
        {[
          {
            icon: MessageSquare,
            title: 'Behavioral',
            body: 'Situational prompts with follow-ups that push past the rehearsed story into what you actually decided.',
            points: ['Conflict and feedback', 'Ownership under pressure', 'Prioritisation'],
            accent: 'Good judgment, told honestly',
          },
          {
            icon: Brain,
            title: 'Technical',
            body: 'Design and debugging questions where the next prompt bends toward the weak part of your last answer.',
            points: ['Caching and data modelling', 'Queues and backpressure', 'Trade-offs at scale'],
            accent: 'Depth, not buzzwords',
          },
        ].map((card, i) => (
          <TiltCard
            key={card.title}
            as="article"
            max={9}
            lift={20}
            sheen
            className="h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors duration-300 hover:border-primary/40"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
              <card.icon className="size-5 text-primary" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>

            <div className="mt-5 space-y-2 rounded-xl border border-border bg-secondary/30 p-4">
              {card.points.map((point, index) => (
                <div key={point} className="flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-primary/60" aria-hidden />
                  <span className="flex-1 text-xs text-foreground/80">{point}</span>
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {72 + index * 6}
                  </span>
                </div>
              ))}
              <Meter value={72 + i * 8} className="mt-1 h-1.5" />
            </div>

            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {card.accent}
            </p>
          </TiltCard>
        ))}
      </Reveal>

      <Reveal delay={160}>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary ring-1 ring-border">
            <CircleSlash className="size-4 text-muted-foreground" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Live coding rounds aren&apos;t available yet</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              SynthView evaluates spoken and written reasoning today. A shared editor with test execution is on
              the roadmap.
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ---------------------------------------------------------- live experience */

const ROOM_STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Mic, title: 'Answer out loud', body: 'Speak or type. The interviewer transcribes and follows what you said.' },
  { icon: Activity, title: 'Watch the signal', body: 'Status moves between listening, evaluating and generating as you talk.' },
  { icon: Camera, title: 'See yourself', body: 'A camera tile with a REC chip keeps the session honest and realistic.' },
  { icon: Wifi, title: 'Survive the network', body: 'Connection state is visible, and the session reconnects rather than failing.' },
]

export function LiveExperience() {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'

  // Walking the steps lights up the one you are level with, so the sticky room
  // panel reads as a walkthrough instead of a screenshot.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track || reduced) return
    const steps = Array.from(track.querySelectorAll<HTMLElement>('[data-step]'))
    if (!steps.length) return
    track.dataset.armed = 'true'
    const ctx = gsap.context(() => {
      steps.forEach((step) => {
        ScrollTrigger.create({
          trigger: step,
          // A band roughly one card tall, so the walkthrough lights a single
          // step at a time instead of glowing three at once.
          start: 'top 58%',
          end: 'bottom 50%',
          onToggle: (self) => {
            step.dataset.active = self.isActive ? 'true' : 'false'
          },
        })
      })
    }, track)
    return () => {
      ctx.revert()
      delete track.dataset.armed
      steps.forEach((step) => delete step.dataset.active)
    }
  }, [reduced])

  return (
    <Section id="how-it-works" border>
      <Reveal>
        <SectionHeading
          eyebrow="Inside the room"
          title="A room that behaves like a real interview."
          description="One question at a time, a timer you can see, and a status bar that tells you exactly what the interviewer is doing."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal>
            <Panel flush className="h-full">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
                  <Activity className="size-4 text-primary" />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight">Frontend Engineer</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Technical · Hard · Round 1 of 2
                  </p>
                </div>
              </div>
              <Badge variant="weak" dot>
                Live interview
              </Badge>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3">
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-end gap-0.5" aria-hidden>
                    {[0, 1, 2, 3].map((d) => (
                      <span
                        key={d}
                        className="h-3 w-0.5 animate-typing-bar rounded-full bg-primary"
                        style={{ animationDelay: `${d * 130}ms` }}
                      />
                    ))}
                  </span>
                  Listening
                </span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">04:12</span>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">Technical</Badge>
                  <Badge variant="vague">Hard</Badge>
                  <Badge variant="outline">Caching</Badge>
                </div>
                <p className="text-xl leading-snug font-medium tracking-tight">
                  Walk me through how you would design a caching layer for a read-heavy product surface.
                </p>
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="h-16 rounded-lg border border-dashed border-border bg-card/40" />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      128 characters
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Q3 / 8
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Difficulty', value: 'Hard' },
                  { label: 'Elapsed', value: '04:12' },
                  { label: 'Answered', value: '2 / 8' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            </Panel>
          </Reveal>
        </div>

        <div ref={trackRef} className="min-w-0">
          <Reveal staggerSelector="[data-step]" stagger={90} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {ROOM_STEPS.map((step, i) => (
              <SpotlightPanel
                key={step.title}
                data-step
                className="flex h-full flex-col justify-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 lg:min-h-[13rem] lg:gap-4 lg:p-6"
              >
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  {`0${i + 1}`}
                </span>
                <div className="flex items-center gap-3">
                  <span className="step-icon flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                    <step.icon className="size-4.5 text-primary" />
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">{step.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </SpotlightPanel>
            ))}
          </Reveal>
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------ evaluation analytics */

export function EvaluationAnalytics() {
  const rows = [
    { label: 'System design', value: 79, band: 'good' as const },
    { label: 'Communication', value: 71, band: 'good' as const },
    { label: 'Depth', value: 66, band: 'vague' as const },
    { label: 'Adaptability', value: 83, band: 'strong' as const },
  ]

  return (
    <Section id="scoring" border>
      <div className="grid gap-12 lg:grid-cols-[1fr_0.95fr] lg:gap-16">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Evaluation"
            title="Every answer is scored on a fixed scale."
            description="Same four signals every session — strong, good, vague, weak — so the trend line means something over time."
          />

          <Reveal staggerSelector="[data-row]" stagger={70} className="mt-8 space-y-4">
            {rows.map((row) => (
              <div key={row.label} data-row className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{row.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{row.value}/100</span>
                </div>
                <Meter value={row.value} tone={row.band} />
              </div>
            ))}
          </Reveal>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <SignalBadge band="strong">Strong</SignalBadge>
            <SignalBadge band="good">Good</SignalBadge>
            <SignalBadge band="vague">Vague</SignalBadge>
            <SignalBadge band="weak">Weak</SignalBadge>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              consistent everywhere
            </span>
          </div>
        </Reveal>

        <Reveal delay={90} staggerSelector="li" stagger={65}>
          <Panel flush>
            <div className="border-b border-border bg-secondary/40 px-5 py-3">
              <h3 className="text-sm font-semibold tracking-tight">Session signals</h3>
            </div>
            <ul className="divide-y divide-border">
              {[
                { q: 'Q1', text: 'Nailed the invalidation strategy', score: 86 },
                { q: 'Q2', text: 'Right answer, thin on numbers', score: 74 },
                { q: 'Q3', text: 'Needed a nudge to reach specifics', score: 61 },
                { q: 'Q4', text: 'Recovered well after a follow-up', score: 81 },
              ].map((row) => (
                <li key={row.q} className="flex items-center gap-4 px-5 py-4">
                  <span className="font-mono text-[11px] text-muted-foreground">{row.q}</span>
                  <p className="min-w-0 flex-1 truncate text-sm">{row.text}</p>
                  <ScoreChip score={row.score} />
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-secondary/30 px-5 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                average 75.5 · 4 questions
              </p>
            </div>
          </Panel>
        </Reveal>
      </div>
    </Section>
  )
}

/* ---------------------------------------------------------- adaptive example */

export function AdaptiveExample() {
  const barsRef = useRef<HTMLDivElement | null>(null)
  const { resolvedMotion } = useMotion()
  const reduced = resolvedMotion === 'reduced'

  // The decision bars fill in sequence as the panel arrives.
  useLayoutEffect(() => {
    const node = barsRef.current
    if (!node || reduced) return
    const bars = node.querySelectorAll('[data-bar]')
    if (!bars.length) return
    const ctx = gsap.context(() => {
      gsap.from(bars, {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.9,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: node, start: 'top 78%', once: true },
      })
    }, node)
    return () => ctx.revert()
  }, [reduced])

  const steps = [
    { label: 'Warm-up', detail: 'Fundamentals, low stakes', level: 'Easy', width: '34%' },
    { label: 'Strong answer', detail: 'You covered trade-offs', level: 'Medium', width: '52%' },
    { label: 'Difficulty up', detail: 'Now: sharding a hot table', level: 'Hard', width: '74%' },
    { label: 'Partial answer', detail: 'Thin on capacity maths', level: 'Medium', width: '52%' },
    { label: 'Probe instead', detail: 'Same topic, narrower', level: 'Hard', width: '66%' },
  ]

  return (
    <Section border>
      <Reveal>
        <SectionHeading
          eyebrow="Branching"
          title="The path bends around your answers."
          description="Answer well and the session escalates. Stall, and it probes the same topic from a different angle instead of moving on."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <Reveal staggerSelector="[data-row]" stagger={80}>
          <div ref={barsRef}>
          <Panel className="space-y-4">
            {steps.map((step, i) => (
              <div key={step.label} data-row className="flex items-center gap-4">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {step.level}
                  </p>
                </div>
                <div className="relative h-9 flex-1 overflow-hidden rounded-lg border border-border bg-secondary/30">
                  <div
                    data-bar
                    className={cn(
                      'h-full rounded-md transition-colors duration-300',
                      i === 2 ? 'bg-signal-vague/25' : 'bg-primary/20',
                    )}
                    style={{ width: step.width }}
                  />
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs text-foreground/80">
                    {step.detail}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Workflow className="size-4 text-primary" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                decision made after every answer
              </p>
            </div>
          </Panel>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div className="flex h-full flex-col gap-4">
            {[
              { icon: TrendingUp, title: 'Escalate when ready', body: 'Two strong answers in a row raises difficulty and changes the topic.' },
              { icon: Target, title: 'Probe when shaky', body: 'A vague answer triggers a narrower follow-up on the same topic.' },
              { icon: RefreshCcw, title: 'Back off when stuck', body: 'Repeated misses drop difficulty so the session stays useful.' },
            ].map((card) => (
              <TiltCard
                key={card.title}
                max={10}
                lift={16}
                className="flex-1 overflow-hidden rounded-2xl border border-border bg-card p-5"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                  <card.icon className="size-4.5 text-primary" />
                </span>
                <h3 className="mt-4 text-sm font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </TiltCard>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------- final report */

export function FinalReport() {
  const skills = [
    { skill: 'System design', score: 86 },
    { skill: 'Trade-offs', score: 81 },
    { skill: 'Communication', score: 74 },
    { skill: 'Depth', score: 69 },
    { skill: 'Structure', score: 78 },
  ]

  return (
    <Section id="reports" border>
      <Reveal>
        <SectionHeading
          eyebrow="The report"
          title="An honest write-up, the moment you finish."
          description="Overall score, per-question breakdown, strengths, gaps and the specific things to practise next."
        />
      </Reveal>

      <Reveal delay={80}>
        <Panel flush className="mt-12">
          <div className="grid gap-6 border-b border-border p-6 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex items-center gap-5">
              <ScoreOrb score={84} band="strong" size={148} label="Sample overall score" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Overall · Frontend Engineer
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">Solid, with clear room to sharpen</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <SignalBadge band="strong">Strong</SignalBadge>
                  <Badge variant="neutral">8 questions</Badge>
                  <Badge variant="outline">Hard</Badge>
                </div>
              </div>
            </div>

            <Reveal staggerSelector="[data-skill]" stagger={60} className="space-y-3 lg:border-l lg:border-border lg:pl-6">
              {skills.map((skill) => (
                <div key={skill.skill} data-skill className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs">{skill.skill}</span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {skill.score}
                    </span>
                  </div>
                  <Meter value={skill.score} className="h-1.5" />
                </div>
              ))}
            </Reveal>
          </div>

          <Reveal staggerSelector="[data-col]" stagger={80} className="grid gap-6 p-6 md:grid-cols-3">
            {[
              { title: 'Strengths', items: ['Named trade-offs unprompted', 'Structured answers clearly', 'Held composure after pushback'] },
              { title: 'Gaps', items: ['Rarely quantified impact', 'Edge cases arrived late', 'Two answers ran long'] },
              { title: 'Practise next', items: ['Decision-first answers', 'Attach a metric to each claim', 'Re-run at Hard'] },
            ].map((column) => (
              <div key={column.title} data-col>
                <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {column.title}
                </h4>
                <ul className="mt-3 space-y-2">
                  {column.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm text-foreground/85">
                      <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Reveal>
        </Panel>
      </Reveal>
    </Section>
  )
}

/* --------------------------------------------------------- interview history */

export function InterviewHistoryPreview() {
  const rows = [
    { role: 'Frontend Engineer', meta: 'SV-2907 · 12 Mar · Hard', status: 'Completed', score: 84 },
    { role: 'Backend Engineer', meta: 'SV-2900 · 06 Mar · Expert', status: 'Completed', score: 71 },
    { role: 'Platform Engineer', meta: 'SV-2893 · 27 Feb · Medium', status: 'In progress', score: null },
    { role: 'Frontend Engineer', meta: 'SV-2886 · 19 Feb · Medium', status: 'Completed', score: 66 },
  ]

  return (
    <Section id="history" border>
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="History"
            title="Every session, kept and comparable."
            description="Scores, roles and difficulty sit side by side so you can see whether practice is actually moving anything."
          />
          <Link
            to="/interviews"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-8 h-11 px-6')}
          >
            Browse interviews
            <ArrowRight className="size-4" />
          </Link>
        </Reveal>

        <Reveal delay={80} staggerSelector="li" stagger={70}>
          <Panel flush>
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
              <h3 className="text-sm font-semibold tracking-tight">Recent interviews</h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                18 total
              </span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.meta} className="flex items-center gap-4 px-5 py-4">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.role}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{row.meta}</p>
                  </div>
                  <Badge
                    variant={
                      row.status === 'Completed' ? 'strong' : row.status === 'In progress' ? 'vague' : 'neutral'
                    }
                    dot
                  >
                    {row.status}
                  </Badge>
                  <ScoreChip score={row.score} />
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>
    </Section>
  )
}

/* ---------------------------------------------------------------- principles */

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Mic, title: 'Realistic', body: 'A live room with a timer, a camera and follow-ups — not a form.' },
  { icon: Workflow, title: 'Adaptive', body: 'The next question is chosen from what your last answer contained.' },
  { icon: MessageSquare, title: 'Interactive', body: 'Speak or type, pause, resume. The interviewer reacts as you go.' },
  { icon: TrendingUp, title: 'Insightful', body: 'Per-question feedback you can act on, not a single opaque number.' },
  { icon: ShieldCheck, title: 'Resilient', body: 'Refresh, lose signal, close the laptop — the session waits for you.' },
]

export function Principles() {
  return (
    <Section id="principles" border>
      <Reveal>
        <SectionHeading
          eyebrow="Principles"
          title="Five things we refuse to compromise on."
        />
      </Reveal>

      <Reveal
        staggerSelector="[data-principle]"
        stagger={70}
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {PRINCIPLES.map((item) => (
          <SpotlightPanel
            key={item.title}
            data-principle
            className="h-full overflow-hidden rounded-2xl border border-border bg-card p-5"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
              <item.icon className="size-4.5 text-primary" />
            </span>
            <h3 className="mt-4 text-sm font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </SpotlightPanel>
        ))}
      </Reveal>
    </Section>
  )
}

/* ----------------------------------------------------------------- final CTA */

export function FinalCta() {
  const user = useAuthStore((s) => s.user)

  return (
    <Section border>
      <Reveal>
        <div className="sv-conic-border relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center sm:px-12">
          <Parallax distance={80} className="pointer-events-none absolute inset-0">
            <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-70" />
          </Parallax>
          <div
            aria-hidden
            className="sv-aurora pointer-events-none absolute inset-x-0 top-0 h-full animate-aurora opacity-40"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 animate-glow-pulse rounded-full bg-primary/25 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl">
            <Eyebrow className="mx-auto">Ready when you are</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
              Your next interview <span className="text-primary">shouldn&apos;t be a surprise.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground text-pretty">
              Run one session and read the report. It takes half an hour and it is more honest than most
              feedback you will get from a real loop.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Magnetic strength={0.24}>
                {user ? (
                  <Link to="/dashboard" className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-6')}>
                    Go to dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <Link to="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 px-6')}>
                    <Play className="size-4" />
                    Sign In
                  </Link>
                )}
              </Magnetic>
              <Magnetic strength={0.28}>
                <Link
                  to="/register"
                  className={cn(buttonVariants({ size: 'lg' }), 'sv-sheen relative h-12 px-6')}
                >
                  Get Started
                  <ArrowRight className="size-4" />
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
