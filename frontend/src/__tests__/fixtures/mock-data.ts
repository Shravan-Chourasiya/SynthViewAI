import { pick, seeded } from '@/lib/utils'
import type {
  AnalyticsSummary,
  AppNotification,
  AdminUserRow,
  Difficulty,
  DeviceSession,
  Interview,
  InterviewReport,
  PlatformStats,
  Question,
  QuestionKind,
  SignalBand,
  User,
} from '@/lib/types'

export const CURRENT_USER: User = {
  id: 'usr_ada',
  name: 'Ada Okonkwo',
  username: 'ada.o',
  email: 'ada.okonkwo@synthview.ai',
  role: 'candidate',
  status: 'active',
  headline: 'Senior frontend engineer',
  location: 'Lagos, NG',
  joinedAt: '2026-01-18T09:12:00.000Z',
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
}

export const ADMIN_USER: User = { ...CURRENT_USER, role: 'admin' }

const ROLE_TITLES = [
  'Frontend Engineer',
  'Senior Frontend Engineer',
  'Backend Engineer',
  'Full-stack Engineer',
  'Platform Engineer',
  'Data Scientist',
  'Machine Learning Engineer',
  'Engineering Manager',
]

const FIELDS = [
  'Frontend Engineering',
  'Backend Engineering',
  'Full-stack Engineering',
  'Data Science',
  'Machine Learning',
  'DevOps / Platform',
]

const COMPANIES = ['Series B startup', 'Big tech', 'Fintech', 'Agency / Consultancy', null]

const TOPIC_SETS = [
  ['Caching', 'Performance', 'Testing'],
  ['Sharding', 'Queues', 'Databases'],
  ['React', 'State management', 'Accessibility'],
  ['Observability', 'Rate limiting', 'API design'],
  ['Model evaluation', 'Feature engineering', 'Latency'],
  ['Concurrency', 'Deployment', 'Incident response'],
]

const TYPES = ['behavioral', 'technical', 'mixed'] as const
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
const STATUSES = ['completed', 'completed', 'completed', 'in-progress', 'scheduled', 'abandoned', 'draft'] as const

const SUMMARY_BANK = [
  'Comfortable with trade-offs when pushed, but leaned on familiar examples.',
  'Strong fundamentals. Needs sharper structure when answering behavioural prompts.',
  'Concrete, measurable answers — the depth held up under follow-ups.',
  'Good instincts on architecture; skipped capacity numbers more than once.',
  'Narrated reasoning clearly, then got lost in the edge cases.',
]

function isoDaysAgo(days: number, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, (days * 7) % 60, 0, 0)
  return d.toISOString()
}

function buildInterview(i: number): Interview {
  const rand = seeded(i * 97 + 13)
  const type = pick(TYPES, rand)
  const difficulty = pick(DIFFICULTIES, rand)
  const status = pick(STATUSES, rand)
  const roleTitle = pick(ROLE_TITLES, rand)
  const score =
    status === 'completed' ? 61 + Math.round(rand() * 25) : status === 'in-progress' ? null : null
  const questionCount = 6 + Math.round(rand() * 4)
  // A session that was abandoned or is still running has real answers behind it;
  // only drafts and scheduled sessions have none yet.
  const answered =
    status === 'completed'
      ? questionCount
      : status === 'in-progress' || status === 'abandoned'
        ? 1 + Math.round(rand() * 4)
        : 0
  const createdDaysAgo = 2 + i * 4 + Math.round(rand() * 3)

  return {
    id: `itv_${1000 + i}`,
    code: `SV-${2900 + i * 7}`,
    roleTitle,
    company: pick(COMPANIES, rand),
    field: pick(FIELDS, rand),
    type,
    difficulty,
    experienceLevel: pick(['junior', 'mid', 'senior', 'staff'] as const, rand),
    status,
    topics: pick(TOPIC_SETS, rand),
    questionCount,
    rounds: 1 + Math.round(rand() * 2),
    durationMinutes: pick([15, 30, 45, 60], rand),
    score,
    band: score === null ? null : score >= 82 ? 'strong' : score >= 70 ? 'good' : score >= 58 ? 'vague' : 'weak',
    summary: status === 'completed' ? pick(SUMMARY_BANK, rand) : null,
    createdAt: isoDaysAgo(createdDaysAgo),
    updatedAt: isoDaysAgo(createdDaysAgo - 1),
    completedAt: status === 'completed' ? isoDaysAgo(createdDaysAgo - 1, 14) : null,
    progress: answered / questionCount,
    currentRound: status === 'completed' ? 2 : answered > 0 ? 1 : 0,
    answeredCount: answered,
    candidateId: CURRENT_USER.id,
  }
}

export const INTERVIEWS: Interview[] = Array.from({ length: 18 }, (_, i) => buildInterview(i))

export const RESUME_TARGET = INTERVIEWS.find((i) => i.status === 'in-progress') ?? INTERVIEWS[3]!

const PROMPT_BANK: Record<QuestionKind, string[]> = {
  code: [
    'Write a function that reverses a singly linked list and explain the complexity.',
    'Implement a rate limiter that allows N requests per minute per client.',
    'Parse a nested JSON structure into a flat dot-notation object.',
    'Find the first non-repeating character in a stream, in O(1) amortised time.',
  ],
  technical: [
    'Walk me through how you would design a caching layer for a read-heavy product surface. What do you invalidate first, and why?',
    'You inherit a queue that is backing up under load. How do you diagnose it, and what changes do you ship in the first hour?',
    'Explain how you would shard a table that has already outgrown a single primary. Where does the hot key problem show up?',
    'How would you make this page interactive in under a second on a mid-range phone? Be specific about the measurements you would take.',
  ],
  behavioral: [
    'Tell me about a time you disagreed with a technical decision that had already shipped. What did you do next?',
    'Describe the hardest piece of feedback you have received. How did it change how you work?',
    'Talk me through a project that slipped. What did you personally change in the following quarter?',
    'Tell me about a moment you had to say no to a stakeholder. How did you keep the relationship intact?',
  ],
  situational: [
    'Your on-call rotation is exhausted and an incident is still open. How do you decide what to fix first?',
    'A teammate ships a change that quietly breaks a downstream contract. What is your first move?',
    'You have two weeks and three competing priorities from three different leads. How do you choose?',
    'Halfway through a migration you realise the target schema cannot model a core case. What now?',
  ],
  mcq: [
    'Which of these is the most reliable way to prevent a cache stampede on a hot key?',
    'You need exactly-once processing with at-least-once delivery infrastructure. Which approach fits best?',
  ],
  rating: [
    'Rate your confidence with distributed tracing as a debugging tool, and then justify the rating.',
    'Rate how comfortable you are owning a production incident end to end, and say why.',
  ],
  structured: [
    'Outline, in numbered steps, how you would roll back a bad deploy that has already corrupted a day of writes.',
    'Structure your answer: how would you onboard onto an unfamiliar codebase in your first week?',
  ],
}

const STRENGTH_BANK = [
  'Named concrete trade-offs instead of hedging',
  'Used real numbers and measurements',
  'Explained the "why" before the "how"',
  'Recovered well after a follow-up exposed a gap',
  'Structured the answer clearly under pressure',
]

const IMPROVEMENT_BANK = [
  'Lean more on measurable outcomes',
  'Say the decision first, then the reasoning',
  'Cover failure modes explicitly',
  'Slow down on the second half of the answer',
  'Quantify the impact, not just the activity',
]

const HEADLINES: Record<SignalBand, string[]> = {
  strong: ['Strong technical understanding', 'Clear, structured thinking'],
  good: ['Solid, but light on trade-offs', 'Good instinct, thin on numbers'],
  vague: ['Vague — needs specifics', 'Directionally right, under-explained'],
  weak: ['Missed the core question', 'Answer did not address the prompt'],
}

const DECISIONS = ['Difficulty increased', 'Probing deeper', 'Easier follow-up', 'Switching topic']

export function questionsFor(interview: Interview): Question[] {
  const rand = seeded(interview.code.charCodeAt(4) * 31 + interview.questionCount)
  const kinds: QuestionKind[] =
    interview.type === 'behavioral'
      ? ['behavioral', 'situational', 'behavioral', 'behavioral', 'situational']
      : interview.type === 'technical'
        ? ['technical', 'technical', 'structured', 'technical', 'mcq']
        : ['behavioral', 'technical', 'situational', 'technical', 'rating']

  return Array.from({ length: interview.questionCount }, (_, i) => {
    const kind = kinds[i % kinds.length]!
    const difficulty = DIFFICULTIES[Math.min(3, Math.floor(i / 2) + (rand() > 0.6 ? 1 : 0))]!
    const answered = i < interview.answeredCount
    const score = answered ? 54 + Math.round(rand() * 34) : null
    const band = score === null ? null : score >= 82 ? 'strong' : score >= 70 ? 'good' : score >= 58 ? 'vague' : 'weak'
    const topic = interview.topics[i % interview.topics.length] ?? 'Caching'

    return {
      id: `${interview.id}_q${i + 1}`,
      interviewId: interview.id,
      index: i + 1,
      kind,
      prompt: pick(PROMPT_BANK[kind], rand),
      topic,
      difficulty,
      answer: answered
        ? 'I would start by writing down the constraints — read volume, acceptable staleness, and the cost of a stale read. Then I would put a short-TTL cache in front of the read path, keyed by the hottest access pattern, and back it with a single-flight lock so a cold key does not stampede the primary. For invalidation I would prefer time-based expiry plus explicit busting on write for the two surfaces where staleness is user-visible.'
        : null,
      score,
      band,
      headline: band ? pick(HEADLINES[band], rand) : null,
      feedback: answered
        ? pick(
            [
              'Good shape to the answer. You named the constraint first, which made the rest easy to follow. The invalidation story was the weakest part — you described the mechanism but not how you would detect a stale read in production.',
              'You got to the right architecture, but the reasoning arrived after the conclusion. Lead with the decision, then justify it, and you will read as more senior.',
              'Strong on trade-offs. You compared two approaches without prompting, which is exactly what the follow-ups are designed to reward.',
            ],
            rand,
          )
        : null,
      strengths: answered
        ? Array.from(new Set([pick(STRENGTH_BANK, rand), pick(STRENGTH_BANK, rand)]))
        : [],
      improvements: answered ? [pick(IMPROVEMENT_BANK, rand)] : [],
      decision: answered ? pick(DECISIONS, rand) : null,
      durationSeconds: answered ? 90 + Math.round(rand() * 150) : 0,
      options:
        kind === 'mcq'
          ? [
              'Per-key request coalescing with a short lease',
              'Increasing the cache TTL to one hour',
              'Warming the cache on every deploy',
              'Removing the cache and scaling the primary',
            ]
          : undefined,
    }
  })
}

export class ReportUnavailableError extends Error {}

/** Stable share token for an interview — derived from its code, not its report. */
export function shareTokenFor(interview: Interview) {
  return `shr_${interview.code.toLowerCase().replace('-', '')}`
}

/**
 * A report describes answers that were actually evaluated. Sessions with no
 * answers yet (drafts, scheduled) throw, and the UI shows an empty state.
 */
export function reportFor(interview: Interview): InterviewReport {
  const rand = seeded(interview.id.charCodeAt(4) * 17 + 3)
  const questions = questionsFor(interview).filter((question) => question.score !== null)
  if (questions.length === 0) {
    throw new ReportUnavailableError('This session has not been answered yet.')
  }
  const overall =
    interview.score ??
    Math.round(questions.reduce((total, question) => total + (question.score ?? 0), 0) / questions.length)
  const band: SignalBand = overall >= 82 ? 'strong' : overall >= 70 ? 'good' : overall >= 58 ? 'vague' : 'weak'

  return {
    interviewId: interview.id,
    overallScore: overall,
    band,
    headline:
      band === 'strong'
        ? 'Ready for a senior loop'
        : band === 'good'
          ? 'Solid, with clear room to sharpen'
          : band === 'vague'
            ? 'Fundamentals present, specifics missing'
            : 'Needs another pass before a real loop',
    summary: interview.summary ?? 'A steady session with a few standout moments and one or two answers that stayed too abstract.',
    strengths: [
      'Trade-off reasoning — you compared options without being prompted',
      'Structure — most answers opened with the constraint, not the solution',
      'Composure — the follow-ups after a weak answer did not derail you',
    ],
    weaknesses: [
      'Measurement — you rarely named the number you would watch',
      'Failure modes — edge cases arrived late, or not at all',
      'Concision — two answers ran well past the point being made',
    ],
    recommendations: [
      'Practise a 60-second "decision first" answer format for architecture questions',
      'Attach one concrete metric to every claim about impact',
      'Re-run this session at Hard difficulty to pressure-test the trade-off answers',
    ],
    skills: [
      { skill: 'System design', score: Math.min(98, overall + 4) },
      { skill: 'Communication', score: Math.max(40, overall - 6) },
      { skill: 'Trade-offs', score: Math.min(98, overall + 2) },
      { skill: 'Depth', score: Math.max(40, overall - 10) },
      { skill: 'Adaptability', score: Math.min(98, overall + 7) },
      { skill: 'Structure', score: Math.max(40, overall - 2) },
    ],
    progression: questions.map((q) => ({
      index: q.index,
      label: `Q${q.index}`,
      score: q.score ?? 0,
      difficulty: q.difficulty,
    })),
    topics: interview.topics.map((topic) => ({ topic, score: Math.max(45, overall + Math.round((rand() - 0.5) * 26)) })),
    shareToken: shareTokenFor(interview),
    generatedAt: interview.completedAt ?? interview.updatedAt,
    questions,
  }
}

export const ANALYTICS: AnalyticsSummary = {
  kpis: [
    { label: 'Sessions', value: '24', delta: '+3 this month', trend: 'up', hint: 'Completed interviews' },
    { label: 'Average score', value: '74', delta: '+5 vs last month', trend: 'up', hint: 'Across all sessions' },
    { label: 'Best score', value: '86', delta: 'Frontend Engineer', trend: 'flat', hint: 'Highest recorded' },
    { label: 'Practice time', value: '9h 40m', delta: '+1h 15m', trend: 'up', hint: 'Time in the live room' },
  ],
  scoreOverTime: [
    { label: 'Wk 1', score: 61, benchmark: 68 },
    { label: 'Wk 2', score: 64, benchmark: 68 },
    { label: 'Wk 3', score: 66, benchmark: 69 },
    { label: 'Wk 4', score: 71, benchmark: 70 },
    { label: 'Wk 5', score: 69, benchmark: 70 },
    { label: 'Wk 6', score: 75, benchmark: 71 },
    { label: 'Wk 7', score: 78, benchmark: 71 },
    { label: 'Wk 8', score: 81, benchmark: 72 },
    { label: 'Wk 9', score: 79, benchmark: 72 },
    { label: 'Wk 10', score: 84, benchmark: 73 },
  ],
  byCategory: [
    { category: 'System design', score: 79, attempts: 14 },
    { category: 'Communication', score: 71, attempts: 24 },
    { category: 'Trade-offs', score: 77, attempts: 18 },
    { category: 'Depth', score: 66, attempts: 22 },
    { category: 'Adaptability', score: 83, attempts: 11 },
    { category: 'Structure', score: 74, attempts: 24 },
  ],
  byDifficulty: [
    { difficulty: 'Easy', score: 82, attempts: 6 },
    { difficulty: 'Medium', score: 75, attempts: 10 },
    { difficulty: 'Hard', score: 68, attempts: 6 },
    { difficulty: 'Expert', score: 61, attempts: 2 },
  ],
  skills: [
    { skill: 'Caching', score: 81, delta: 6 },
    { skill: 'Databases', score: 74, delta: 3 },
    { skill: 'Queues', score: 69, delta: -2 },
    { skill: 'Sharding', score: 63, delta: 1 },
    { skill: 'Observability', score: 72, delta: 4 },
    { skill: 'API design', score: 78, delta: 5 },
  ],
  strengths: ['Adaptability under follow-ups', 'System design trade-offs', 'Answer structure'],
  gaps: ['Quantifying impact', 'Edge-case coverage', 'Queues and backpressure'],
}

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'ntf_1',
    title: 'Report ready',
    body: 'Your Frontend Engineer session finished evaluating — score 84/100.',
    kind: 'report',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
  },
  {
    id: 'ntf_2',
    title: 'Session paused',
    body: 'A Backend Engineer interview was interrupted 12 minutes in. It is resumable.',
    kind: 'interview',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'ntf_3',
    title: 'Weekly insight',
    body: 'Your depth score has held flat for three sessions — try Hard difficulty.',
    kind: 'system',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
]

export const SESSIONS: DeviceSession[] = [
  {
    id: 'ses_1',
    device: 'MacBook Pro 14"',
    browser: 'Arc 1.62',
    os: 'macOS 15.3',
    location: 'Lagos, NG',
    ip: '102.89.44.12',
    current: true,
    createdAt: isoDaysAgo(0, 8),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: 'ses_2',
    device: 'iPhone 16 Pro',
    browser: 'Safari',
    os: 'iOS 18.3',
    location: 'Lagos, NG',
    ip: '102.89.44.90',
    current: false,
    createdAt: isoDaysAgo(9, 19),
    lastActiveAt: isoDaysAgo(1, 21),
  },
  {
    id: 'ses_3',
    device: 'ThinkPad X1',
    browser: 'Chrome 133',
    os: 'Windows 11',
    location: 'Abuja, NG',
    ip: '197.210.53.4',
    current: false,
    createdAt: isoDaysAgo(21, 11),
    lastActiveAt: isoDaysAgo(16, 9),
  },
]

const ADMIN_NAMES = [
  'Ada Okonkwo',
  'Bo Chen',
  'Camila Ferreira',
  'Devansh Rao',
  'Elif Demir',
  'Farouk Haddad',
  'Grace Mwangi',
  'Hana Sato',
  'Ines Duarte',
  'Jonas Berg',
  'Kofi Mensah',
  'Lena Novak',
]

export const ADMIN_USERS: AdminUserRow[] = ADMIN_NAMES.map((name, i) => {
  const rand = seeded(i * 53 + 7)
  const status = pick(['active', 'active', 'active', 'invited', 'suspended'] as const, rand)
  return {
    id: `usr_${200 + i}`,
    name,
    username: name.toLowerCase().replace(/[^a-z]+/g, '.'),
    email: `${name.toLowerCase().split(' ')[0]}@example.com`,
    role: i === 1 ? 'admin' : i % 5 === 3 ? 'reviewer' : 'candidate',
    status,
    interviews: status === 'invited' ? 0 : 3 + Math.round(rand() * 19),
    avgScore: status === 'invited' ? null : 58 + Math.round(rand() * 27),
    joinedAt: isoDaysAgo(30 + i * 9),
    lastActiveAt: isoDaysAgo(Math.round(rand() * 14)),
  }
})

export const PLATFORM_STATS: PlatformStats = {
  kpis: [
    { label: 'Total users', value: '4,281', delta: '+312 this month', trend: 'up', hint: 'All roles' },
    { label: 'Interviews run', value: '18,904', delta: '+9.4%', trend: 'up', hint: 'Lifetime sessions' },
    { label: 'Avg. session', value: '31m 20s', delta: '+1m 04s', trend: 'up', hint: 'Time in the room' },
    { label: 'Completion rate', value: '82.6%', delta: '-0.8%', trend: 'down', hint: 'Finished vs abandoned' },
  ],
  signups: [
    { label: 'Wk 1', users: 240, interviews: 410 },
    { label: 'Wk 2', users: 262, interviews: 448 },
    { label: 'Wk 3', users: 251, interviews: 501 },
    { label: 'Wk 4', users: 298, interviews: 534 },
    { label: 'Wk 5', users: 316, interviews: 588 },
    { label: 'Wk 6', users: 342, interviews: 641 },
  ],
  statusMix: [
    { status: 'Completed', count: 15612 },
    { status: 'In progress', count: 1480 },
    { status: 'Scheduled', count: 902 },
    { status: 'Abandoned', count: 610 },
    { status: 'Draft', count: 300 },
  ],
  scoreBands: [
    { band: 'Strong', count: 5210 },
    { band: 'Good', count: 6820 },
    { band: 'Vague', count: 4310 },
    { band: 'Weak', count: 2564 },
  ],
  topRoles: [
    { role: 'Frontend Engineer', count: 3120, avgScore: 74 },
    { role: 'Backend Engineer', count: 2860, avgScore: 72 },
    { role: 'Full-stack Engineer', count: 2140, avgScore: 71 },
    { role: 'Data Scientist', count: 1380, avgScore: 69 },
    { role: 'Platform Engineer', count: 940, avgScore: 76 },
  ],
}
