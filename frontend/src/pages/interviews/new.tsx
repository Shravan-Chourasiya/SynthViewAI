import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CircleSlash,
  Loader2,
  MessageSquare,
  Plus,
  Shuffle,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Panel } from '@/components/ui/panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import { Meter } from '@/components/ui/meter'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { interviewService } from '@/lib/services'
import {
  COMMON_TOPICS,
  DIFFICULTY_OPTIONS,
  DURATION_OPTIONS,
  EXPERIENCE_LEVELS,
  FIELDS,
  ROUND_OPTIONS,
  TARGET_COMPANIES,
  TOPIC_LIBRARY,
} from '@/lib/constants/interview'
import { DIFFICULTY_LABEL, EXPERIENCE_LABEL, TYPE_LABEL } from '@/lib/format'
import type { Difficulty, ExperienceLevel, InterviewType, NewInterviewDraft } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS = ['Role', 'Format', 'Topics', 'Level', 'Length', 'Review'] as const

const TYPE_CARDS: { value: InterviewType; label: string; body: string; icon: typeof Brain }[] = [
  {
    value: 'behavioral',
    label: 'Behavioral',
    body: 'Judgement, collaboration and how you handle disagreement.',
    icon: MessageSquare,
  },
  {
    value: 'technical',
    label: 'Technical',
    body: 'Design, debugging and trade-offs under follow-up pressure.',
    icon: Brain,
  },
  {
    value: 'mixed',
    label: 'Mixed',
    body: 'Alternates formats the way a real full-loop day does.',
    icon: Shuffle,
  },
]

export default function NewInterviewPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [topicDraft, setTopicDraft] = useState('')

  const [draft, setDraft] = useState<NewInterviewDraft>({
    field: FIELDS[0],
    roleTitle: '',
    company: null,
    companyChoice: 'none',
    type: null,
    topics: ['Caching', 'Sharding', 'Queues'],
    experienceLevel: 'senior',
    difficulty: null,
    durationMinutes: 30,
    rounds: 2,
  })

  const suggestions = useMemo(() => {
    const library = TOPIC_LIBRARY[draft.field] ?? COMMON_TOPICS
    return [...COMMON_TOPICS, ...library].filter((topic, i, all) => all.indexOf(topic) === i)
  }, [draft.field])

  function patch(next: Partial<NewInterviewDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  function addTopic(topic: string) {
    const clean = topic.trim()
    if (!clean) return
    if (draft.topics.length >= 10) {
      toast.error('Up to 10 skills per session')
      return
    }
    if (draft.topics.some((t) => t.toLowerCase() === clean.toLowerCase())) return
    patch({ topics: [...draft.topics, clean] })
    setTopicDraft('')
  }

  const createMutation = useMutation({
    mutationFn: () => interviewService.create(draft),
    onSuccess: (interview) => {
      toast.success('Interview created')
      navigate(`/interviews/${interview.id}/lobby`)
    },
    onError: () => toast.error('Could not create the interview'),
  })

  const canContinue =
    step === 0
      ? draft.roleTitle.trim().length > 1
      : step === 1
        ? draft.type !== null
        : step === 2
          ? draft.topics.length >= 1
          : step === 3
            ? draft.difficulty !== null
            : true

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Configure your interview."
        lede="Six short steps. Everything here shapes the questions the interviewer will ask."
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                index === step
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : index < step
                    ? 'border-border bg-card text-foreground/70 hover:border-primary/30'
                    : 'border-border bg-card text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Meter value={progress} label="Wizard progress" className="flex-1" />
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
      </div>

      <div key={step} className="animate-fade-in">
        {step === 0 ? (
          <Panel className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="field">Field</Label>
              <Select value={draft.field} onValueChange={(value) => patch({ field: value })}>
                <SelectTrigger id="field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Target role</Label>
              <Input
                id="role"
                value={draft.roleTitle}
                onChange={(e) => patch({ roleTitle: e.target.value })}
                placeholder="Senior Frontend Engineer"
              />
              <p className="text-xs text-muted-foreground">
                The role title is used to bias the question bank and the report wording.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Target company</Label>
              <div className="flex flex-wrap gap-2">
                {TARGET_COMPANIES.map((company) => (
                  <button
                    key={company.value}
                    type="button"
                    onClick={() => patch({ companyChoice: company.value, company: company.label })}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      draft.companyChoice === company.value
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30',
                    )}
                  >
                    {company.label}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {TYPE_CARDS.map((card) => (
                <button
                  key={card.value}
                  type="button"
                  onClick={() => patch({ type: card.value })}
                  aria-pressed={draft.type === card.value}
                  className={cn(
                    'rounded-2xl border p-5 text-left transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    draft.type === card.value
                      ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/5'
                      : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/40',
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                    <card.icon className="size-4.5 text-primary" />
                  </span>
                  <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
                    {card.label}
                    {draft.type === card.value ? <Check className="size-4 text-primary" /> : null}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary ring-1 ring-border">
                <CircleSlash className="size-4 text-muted-foreground" />
              </span>
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Coding rounds are not available</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Structured written answers are supported, but there is no shared editor or test runner yet.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <Panel className="space-y-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="topic-input">Skills and topics</Label>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {draft.topics.length}/10 skills added
              </span>
            </div>

            <div className="flex gap-2">
              <Input
                id="topic-input"
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTopic(topicDraft)
                  }
                }}
                placeholder="Add a topic and press Enter"
              />
              <Button type="button" variant="outline" onClick={() => addTopic(topicDraft)}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>

            {draft.topics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {draft.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs"
                  >
                    {topic}
                    <button
                      type="button"
                      aria-label={`Remove ${topic}`}
                      onClick={() => patch({ topics: draft.topics.filter((t) => t !== topic) })}
                      className="rounded-full text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No topics yet — add at least one so the interviewer has somewhere to start.
              </p>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Suggestions for {draft.field}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 10).map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => addTopic(topic)}
                    disabled={draft.topics.includes(topic)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      draft.topics.includes(topic)
                        ? 'border-border bg-secondary text-muted-foreground/50'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <Panel className="space-y-2">
              <Label htmlFor="level">Experience level</Label>
              <Select
                value={draft.experienceLevel}
                onValueChange={(value) => patch({ experienceLevel: value as ExperienceLevel })}
              >
                <SelectTrigger id="level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label} — {level.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Panel>

            <div className="grid gap-3 sm:grid-cols-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => patch({ difficulty: option.value as Difficulty })}
                  aria-pressed={draft.difficulty === option.value}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    draft.difficulty === option.value
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-semibold tracking-tight">{option.label}</span>
                    {draft.difficulty === option.value ? <Check className="size-4 text-primary" /> : null}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>

            <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              Starting difficulty is a hint, not a ceiling — the session will move either way.
            </p>
          </div>
        ) : null}

        {step === 4 ? (
          <Panel className="space-y-6">
            <div className="space-y-3">
              <Label>Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => patch({ durationMinutes: minutes })}
                    className={cn(
                      'rounded-full border px-4 py-1.5 font-mono text-xs tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      draft.durationMinutes === minutes
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30',
                    )}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Rounds</Label>
              <div className="flex flex-wrap gap-2">
                {ROUND_OPTIONS.map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    onClick={() => patch({ rounds })}
                    className={cn(
                      'rounded-full border px-4 py-1.5 font-mono text-xs tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      draft.rounds === rounds
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30',
                    )}
                  >
                    {rounds} round{rounds > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Each round is scored separately, then combined into the overall report.
              </p>
            </div>
          </Panel>
        ) : null}

        {step === 5 ? (
          <Panel className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                <Sparkles className="size-4.5 text-primary" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  {draft.roleTitle || 'Practice interview'}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {draft.field} · {draft.companyChoice === 'none' ? 'no target company' : draft.company}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-border rounded-xl border border-border">
              {[
                { label: 'Format', value: draft.type ? TYPE_LABEL[draft.type] : 'Mixed' },
                { label: 'Experience', value: EXPERIENCE_LABEL[draft.experienceLevel] },
                { label: 'Difficulty', value: draft.difficulty ? DIFFICULTY_LABEL[draft.difficulty] : 'Medium' },
                { label: 'Duration', value: `${draft.durationMinutes} minutes` },
                { label: 'Rounds', value: `${draft.rounds}` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="text-sm">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Topics ({draft.topics.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {draft.topics.map((topic) => (
                  <Badge key={topic} variant="default">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </Panel>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {step + 1} / {STEPS.length}
        </span>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canContinue}>
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button size="lg" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create &amp; Enter Lobby
          </Button>
        )}
      </div>
    </div>
  )
}
