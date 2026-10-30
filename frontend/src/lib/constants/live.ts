import type { LiveStatus } from '../types'

/** Human-readable label per interviewer state, shown in the room header and aside. */
export const STATUS_LABEL: Record<LiveStatus, string> = {
  idle: 'Standing by',
  listening: 'Listening',
  evaluating: 'Evaluating answer',
  generating: 'Generating question',
}
