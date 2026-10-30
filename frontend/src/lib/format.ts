import type { Difficulty, ExperienceLevel, InterviewStatus, InterviewType, SignalBand } from './types'

const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const DATE_SHORT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

export function formatDate(iso: string) {
  return DATE.format(new Date(iso))
}

export function formatDateShort(iso: string) {
  return DATE_SHORT.format(new Date(iso))
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${DATE.format(d)} · ${TIME.format(d)}`
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return formatDate(iso)
}

/** mm:ss */
export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatScore(score: number | null | undefined) {
  if (score === null || score === undefined) return '—'
  return `${Math.round(score)}/100`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GB').format(value)
}

export function formatPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`
}

export function bandFromScore(score: number): SignalBand {
  if (score >= 82) return 'strong'
  if (score >= 70) return 'good'
  if (score >= 58) return 'vague'
  return 'weak'
}

export const BAND_LABEL: Record<SignalBand, string> = {
  strong: 'Strong',
  good: 'Good',
  vague: 'Vague',
  weak: 'Weak',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
}

export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  lead: 'Lead / Manager',
}

export const TYPE_LABEL: Record<InterviewType, string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  mixed: 'Mixed',
}

export const STATUS_LABEL: Record<InterviewStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

export function titleCase(value: string) {
  return value.replace(/(^|[\s-])\w/g, (m) => m.toUpperCase())
}

/** Short US date — the shape the report and timeline rows were built around. */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Human relative time: "Just now", "5m ago", "3h ago", then a date. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

/** Minutes as "30 min" / "1h" / "1h 15m". */
export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
