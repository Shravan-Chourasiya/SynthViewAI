import type { Difficulty, ExperienceLevel } from '../types'

export const FIELDS = [
  'Frontend Engineering',
  'Backend Engineering',
  'Full-stack Engineering',
  'Data Science',
  'Machine Learning',
  'DevOps / Platform',
  'Mobile Engineering',
  'Product Management',
] as const

export const TOPIC_LIBRARY: Record<string, string[]> = {
  'Frontend Engineering': ['React', 'Caching', 'Accessibility', 'Performance', 'State management', 'Testing', 'CSS architecture', 'Rendering'],
  'Backend Engineering': ['Caching', 'Queues', 'Sharding', 'Databases', 'Observability', 'Concurrency', 'API design', 'Rate limiting'],
  'Full-stack Engineering': ['Caching', 'API design', 'Auth', 'Queues', 'Databases', 'React', 'Deployment', 'Testing'],
  'Data Science': ['Statistics', 'Feature engineering', 'SQL', 'Experimentation', 'Visualisation', 'Model evaluation', 'ETL', 'Storytelling'],
  'Machine Learning': ['Model evaluation', 'Feature engineering', 'Training pipelines', 'Inference', 'Embeddings', 'Evaluation sets', 'Data quality', 'Latency'],
  'DevOps / Platform': ['CI/CD', 'Sharding', 'Observability', 'Kubernetes', 'Incident response', 'Cost control', 'Networking', 'Secrets'],
  'Mobile Engineering': ['Offline-first', 'Rendering', 'Battery', 'Networking', 'Navigation', 'Testing', 'Release trains', 'Accessibility'],
  'Product Management': ['Prioritisation', 'Discovery', 'Metrics', 'Roadmapping', 'Stakeholders', 'Pricing', 'Experimentation', 'Positioning'],
}

export const COMMON_TOPICS = [
  'Caching',
  'Sharding',
  'Queues',
  'Observability',
  'API design',
  'Testing',
  'Databases',
  'Concurrency',
  'Performance',
  'Rate limiting',
]

export const TARGET_COMPANIES = [
  { value: 'none', label: 'None' },
  { value: 'series-b-startup', label: 'Series B startup' },
  { value: 'big-tech', label: 'Big tech' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'agency', label: 'Agency / Consultancy' },
  { value: 'other', label: 'Other' },
] as const

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: 'intern', label: 'Intern', hint: 'Fundamentals, guided prompts' },
  { value: 'junior', label: 'Junior', hint: '1–2 years, core concepts' },
  { value: 'mid', label: 'Mid-level', hint: '3–5 years, ownership' },
  { value: 'senior', label: 'Senior', hint: '5+ years, trade-offs & scale' },
  { value: 'staff', label: 'Staff', hint: 'Cross-team, ambiguity' },
  { value: 'lead', label: 'Lead / Manager', hint: 'People, strategy' },
]

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', hint: 'Warm-up, fundamentals' },
  { value: 'medium', label: 'Medium', hint: 'Standard loop difficulty' },
  { value: 'hard', label: 'Hard', hint: 'Trade-offs under pressure' },
  { value: 'expert', label: 'Expert', hint: 'Ambiguous, system-level' },
]

export const DURATION_OPTIONS = [15, 30, 45, 60]
export const ROUND_OPTIONS = [1, 2, 3, 4, 6]

export const RULES = [
  'Answer out loud — the interviewer listens and reacts in real time.',
  'You can pause between questions; the session is resumable.',
  'Skipping a question costs you a small amount of signal, not a failure.',
  'Do not open other tabs during the session — focus mode is recorded.',
  'You will get an honest, detailed report the moment you finish.',
]

export const SESSION_SECONDS_PER_QUESTION = 210
