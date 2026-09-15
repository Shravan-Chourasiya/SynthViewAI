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
  return <Badge variant={DIFFICULTY_META[difficulty].variant}>{difficulty}</Badge>
}

const TYPE_VARIANT: Record<InterviewType, BadgeProps['variant']> = {
  Behavioral: 'good',
  Technical: 'default',
  // Reserved: no picker can select "Coding" and the backend never returns it.
  Coding: 'strong',
  Mixed: 'vague',
}

export function TypeBadge({ type }: { type: InterviewType }) {
  return (
    <Badge variant={TYPE_VARIANT[type]} dot>
      {type}
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