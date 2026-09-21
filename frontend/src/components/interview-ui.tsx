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