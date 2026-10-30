import { useEffect, useRef, useState } from 'react'
import { Check, Eraser, Mic, Send, SkipForward, Sparkles } from 'lucide-react'
import { Panel } from '@/components/ui/panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DIFFICULTY_LABEL } from '@/lib/format'
import type { Question } from '@/lib/types'

const KIND_LABEL: Record<Question['kind'], string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  situational: 'Situational',
  mcq: 'Multiple choice',
  rating: 'Self rating',
  structured: 'Structured answer',
  code: 'Code',
}

/**
 * The badges + index row every answer surface puts above its prompt. Shared by
 * the prose panel and the code panel so the two cannot drift apart.
 */
export function QuestionMeta({
  question,
  index,
  total,
}: {
  question: Question
  index: number
  /** `null` when the number of questions isn't known yet. */
  total: number | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">{KIND_LABEL[question.kind] ?? 'Question'}</Badge>
      <Badge variant="outline">{DIFFICULTY_LABEL[question.difficulty]}</Badge>
      <Badge variant="default">{question.topic}</Badge>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
        Q{index + 1} / {total ?? '—'}
      </span>
    </div>
  )
}

/** Typewriter effect for streamed interviewer text. */
function StreamingText({ text, active }: { text: string; active: boolean }) {
  return (
    <span>
      {text}
      {active ? <span className="ml-0.5 inline-block h-5 w-0.5 animate-caret bg-primary align-middle" /> : null}
    </span>
  )
}

export function QuestionPanel({
  question,
  index,
  total,
  streamed,
  streaming,
  answering,
  onSubmit,
  onSkip,
}: {
  question: Question
  index: number
  total: number
  streamed: string
  streaming: boolean
  answering: boolean
  onSubmit: (answer: string) => void
  onSkip: () => void
}) {
  const [answer, setAnswer] = useState('')
  const [mcq, setMcq] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [voice, setVoice] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setAnswer('')
    setMcq(null)
    setRating(null)
  }, [question.id])

  useEffect(() => {
    if (answering) textareaRef.current?.focus()
  }, [answering, question.id])

  const value =
    question.kind === 'mcq' ? (mcq ?? '') : question.kind === 'rating' ? (rating ? String(rating) : '') : answer

  return (
    <div className="space-y-4">
      <Panel className="space-y-4">
        <QuestionMeta question={question} index={index} total={total} />

        <div className="flex gap-3">
          <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
            <Sparkles className="size-3.5 text-primary" />
          </span>
          <p className="text-xl leading-snug font-medium tracking-tight sm:text-2xl">
            <StreamingText text={streaming ? streamed || question.prompt : question.prompt} active={streaming} />
          </p>
        </div>
      </Panel>

      <Panel className="space-y-3">
        {question.kind === 'mcq' && question.options ? (
          <fieldset className="space-y-2">
            <legend className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Choose one
            </legend>
            {question.options.map((option, i) => (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
                  mcq === option ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30',
                )}
              >
                <input
                  type="radio"
                  name={`mcq-${question.id}`}
                  value={option}
                  checked={mcq === option}
                  onChange={() => setMcq(option)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span className="flex-1">
                  <span className="mr-2 font-mono text-[10px] text-muted-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {question.kind === 'rating' ? (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Rate 1 – 5, then justify it
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setRating(score)}
                  aria-pressed={rating === score}
                  className={cn(
                    'size-10 rounded-xl border font-mono text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    rating === score
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/30',
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              placeholder="Why that rating?"
              aria-label="Justification"
            />
          </div>
        ) : null}

        {question.kind !== 'mcq' && question.kind !== 'rating' ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={question.kind === 'structured' ? 8 : 6}
              placeholder={
                question.kind === 'structured'
                  ? 'Answer in numbered steps…'
                  : 'Type your answer, or use the microphone below…'
              }
              aria-label="Your answer"
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
                {answer.length} characters
              </span>
              <Button
                variant={voice ? 'default' : 'outline'}
                size="sm"
                aria-pressed={voice}
                onClick={() => setVoice((v) => !v)}
              >
                <Mic className="size-3.5" />
                {voice ? 'Listening…' : 'Voice input'}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setAnswer('')
              setMcq(null)
              setRating(null)
            }}
          >
            <Eraser className="size-4" />
            Clear
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSkip}>
              <SkipForward className="size-4" />
              Skip
            </Button>
            <Button size="default" disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>
              <Send className="size-4" />
              Submit answer
            </Button>
          </div>
        </div>
      </Panel>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3">
        <Check className="size-3.5 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Answers are evaluated the moment you submit. The next question adapts to what you wrote.
        </p>
      </div>
    </div>
  )
}
