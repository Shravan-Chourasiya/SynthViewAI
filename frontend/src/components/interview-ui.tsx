import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  DIFFICULTY_META,
  type Difficulty,
  type Interview,
  type InterviewType,
} from '@/lib/types'
import { cn } from '@/lib/utils'

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  // Same guard as StatusBadge: an unknown difficulty must not unmount the page.
  const meta = DIFFICULTY_META[difficulty] ?? { variant: 'neutral' as const }
  return <Badge variant={meta.variant}>{difficulty ?? 'Unknown'}</Badge>
}

const TYPE_VARIANT: Record<InterviewType, BadgeProps['variant']> = {
  Behavioral: 'good',
  Technical: 'default',
  // Reserved: no picker can select "Coding" and the backend never returns it.
  Coding: 'strong',
  Mixed: 'vague',
}

export function TypeBadge({ type }: { type: InterviewType }) {
  // Unknown types fall back to a neutral badge instead of crashing the page.
  const variant = (type && TYPE_VARIANT[type]) ?? 'neutral'
  return (
    <Badge variant={variant} dot>
      {type ?? 'Unknown'}
    </Badge>
  )
}

/** State-aware action — respects the interview lifecycle (FR-26 rules). */
export function RowAction({ interview }: { interview: Interview }) {
  if (interview.status === 'COMPLETED') {
    return (
      <Link
        to={`/interviews/${interview.id}/report`}
        className={cn(buttonVariants({ variant: 'outline', size: 'xs' }))}
      >
        Report
      </Link>
    )
  }
  if (
    interview.status === 'IN_PROGRESS' ||
    interview.status === 'CREATED' ||
    interview.status === 'READY'
  ) {
    return (
      <Link
        to={`/interviews/${interview.id}/lobby`}
        className={cn(buttonVariants({ size: 'xs' }))}
      >
        {interview.status === 'IN_PROGRESS' ? (
          <>
            <Play className="size-3" />
            Resume
          </>
        ) : (
          'Start'
        )}
      </Link>
    )
  }
  return (
    <Link
      to={`/interviews/${interview.id}`}
      className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }))}
    >
      Details
    </Link>
  )
}

/**
 * A recorded answer, rendered the way it was written.
 *
 * The report page and the public share view show the same box — only the
 * heading differs. Prose keeps the original paragraph; a code answer becomes a
 * monospaced block with preserved whitespace, long lines scrolled on screen
 * (wrapped by the print rule in index.css) and labelled with its language, plus
 * the standing note that no code was executed.
 */
export function AnswerDisplay({
  answer,
  answerFormat,
  codeLanguage,
  label = 'Your answer',
  className,
}: {
  answer: string
  /** Absent on older payloads — those answers render as prose. */
  answerFormat?: 'TEXT' | 'CODE' | null
  /** Language recorded alongside the code answer. */
  codeLanguage?: string | null
  /** Box heading; the shared page labels the same box "Answer". */
  label?: string
  className?: string
}) {
  const isCode = answerFormat === 'CODE'
  const language = codeLanguage?.trim() || 'code'

  return (
    <div className={cn('rounded-lg border border-border bg-background/50 px-3.5 py-2.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {isCode ? (
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary ring-1 ring-primary/25">
            {language}
          </span>
        ) : null}
      </div>

      {isCode ? (
        <>
          <pre
            className="mt-2 max-h-80 overflow-auto whitespace-pre rounded-md bg-background/60 p-3 font-mono text-xs leading-relaxed ring-1 ring-border"
            data-testid="answer-code"
          >
            {answer}
          </pre>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Code was reviewed, not executed
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm leading-relaxed">{answer}</p>
      )}
    </div>
  )
}