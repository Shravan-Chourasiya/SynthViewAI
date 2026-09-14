import { useState } from 'react'
import { Check, ChevronDown, Play, RotateCcw, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CodeResult, Question } from '@/lib/types'
import { cn } from '@/lib/utils'

export type AIState = 'idle' | 'preparing' | 'evaluating' | 'adapting' | 'ready' | 'unavailable'
export type CodeRunState = 'idle' | 'running' | 'done' | 'failed'

export function CodingPanel({
  question,
  index,
  total,
  language,
  runState,
  aiState,
  result,
  busy,
  onSubmit,
}: {
  question: Question
  index: number
  total: number
  language: string
  runState: CodeRunState
  aiState: AIState
  result: CodeResult | null
  busy: boolean
  onSubmit: (code: string) => void
}) {
  const [code, setCode] = useState(question.starter ?? '')

  const testTotal = result?.total ?? 5
  const testPassed = result?.passed ?? 0

  return (
    <div className="flex h-full flex-col rounded-xl bg-card/30 p-1">
      {/* meta */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" dot>
          AI-generated
        </Badge>
        <Badge variant="outline">
          Q{index} of {total}
        </Badge>
        <Badge variant="outline">{question.topic}</Badge>
        <Badge variant="strong" dot>
          Coding round
        </Badge>
      </div>

      {/* problem */}
      <h2 className="animate-reveal mt-5 max-w-3xl text-pretty text-xl font-medium leading-relaxed sm:text-2xl">
        {question.text}
      </h2>

      <div className="mt-5 grid flex-1 gap-4 lg:grid-cols-2">
        {/* editor */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background/60">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3.5 py-2">
            <div className="relative">
              <select
                aria-label="Language"
                value={language}
                disabled
                className="h-7 appearance-none rounded-md bg-background pl-2.5 pr-7 font-mono text-[11px] text-muted-foreground ring-1 ring-border disabled:opacity-100"
              >
                <option>{language}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            <button
              type="button"
              onClick={() => setCode(question.starter ?? '')}
              disabled={busy}
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            aria-label="Code editor"
            className="min-h-56 flex-1 resize-none bg-transparent p-3.5 font-mono text-[12.5px] leading-relaxed focus:outline-none"
          />
        </div>

        {/* output console */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background/60">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-3.5 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Codebox output
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {result ? `runtime ${result.runtime} · mem ${result.memory}` : 'sandboxed · isolated'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3.5 font-mono text-[11px] leading-relaxed">
            {runState === 'idle' ? (
              <p className="text-muted-foreground/60">
                {'// Run your code to see execution output here.'}
              </p>
            ) : null}
            {runState === 'running' ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                running tests
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1 rounded-full bg-primary"
                    style={{
                      animation: 'pulse-dot 1s ease-in-out infinite',
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </span>
            ) : null}
            {runState === 'done' && result ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-signal-strong">$ submit solution</p>
                {Array.from({ length: testTotal }, (_, i) => {
                  const passed = i < testPassed
                  return (
                    <p
                      key={i}
                      className={passed ? 'text-signal-strong' : 'text-signal-weak'}
                    >
                      {passed ? '✓' : '✗'} test case {i + 1}{' '}
                      {passed ? 'passed' : 'failed — edge case'}
                    </p>
                  )
                })}
                <p className="mt-1 text-muted-foreground">stdout: {result.stdout}</p>
                <p className="text-muted-foreground">
                  {result.passed}/{result.total} passed · {result.runtime} · {result.memory}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* submit row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Next question prepares while your code runs
        </span>
        <Button size="sm" onClick={() => onSubmit(code)} disabled={busy || !code.trim()}>
          {busy ? (
            'Submitting…'
          ) : (
            <>
              <Send className="size-3.5" />
              Run &amp; Submit
            </>
          )}
        </Button>
      </div>

      {/* parallel tracks */}
      <ParallelTracks runState={runState} aiState={aiState} />
    </div>
  )
}

function ParallelTracks({
  runState,
  aiState,
}: {
  runState: CodeRunState
  aiState: AIState
}) {
  const execActive = runState === 'running'
  const execDone = runState === 'done'
  const aiActive =
    aiState === 'preparing' || aiState === 'evaluating' || aiState === 'adapting'
  const aiDone = aiState === 'ready'

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <Track
        label="Code execution · Codebox"
        active={execActive}
        done={execDone}
        activeText="Compiling & running tests…"
        doneText="Execution complete"
      />
      <Track
        label="AI preparation · LangGraph"
        active={aiActive}
        done={aiDone}
        activeText="Evaluating & preparing next question…"
        doneText="Next question ready"
      />
    </div>
  )
}

function Track({
  label,
  active,
  done,
  activeText,
  doneText,
}: {
  label: string
  active: boolean
  done: boolean
  activeText: string
  doneText: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md ring-1 transition-colors',
          done
            ? 'bg-(--signal-strong)/10 text-signal-strong ring-(--signal-strong)/30'
            : active
              ? 'bg-primary/15 text-primary ring-primary/30'
              : 'bg-secondary text-muted-foreground ring-border',
        )}
      >
        {done ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : (
          <Play className={cn('size-3.5', active && 'animate-pulse')} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'truncate text-xs',
            done
              ? 'text-signal-strong'
              : active
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {done ? doneText : active ? activeText : 'Idle'}
        </p>
      </div>
    </div>
  )
}
