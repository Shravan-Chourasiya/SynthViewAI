import { httpDelete, httpGet, httpPost } from '../http'
import type {
  BackendInterviewStatus,
  CreateInterviewResponse,
  InterviewResponse,
} from '../api-types'
import type {
  Interview,
  InterviewFilters,
  InterviewReport,
  NewInterviewDraft,
  Paginated,
  Question,
} from '../types'

// ── Status mapping ─────────────────────────────────────────────────────────────

function toFrontendStatus(s: BackendInterviewStatus): Interview['status'] {
  switch (s) {
    case 'INPROGRESS': return 'in-progress'
    case 'COMPLETED': return 'completed'
    case 'CANCELLED':
    case 'ABANDONED':
    case 'EXPIRED':
    case 'TIMED_OUT': return 'abandoned'
    case 'READY':
    case 'SCHEDULED': return 'scheduled'
    default: return 'draft'
  }
}

function mapInterview(r: InterviewResponse): Interview {
  const backendStatus = (r.interviewStatus ?? r.status) as BackendInterviewStatus | undefined
  const meta = r.interviewMetaData as
    | {
        domain?: string
        jobRole?: string
        questionCount?: number
        targetedCompany?: string
        targetedCompanyOther?: string
      }
    | undefined
  return {
    id: r.id,
    code: (r.code as string | undefined) ?? r.id.slice(0, 8).toUpperCase(),
    roleTitle: ((r.interviewTitle ?? r.roleTitle) as string | undefined) ?? 'Interview',
    company:
      (meta?.targetedCompany as string | undefined) ??
      (meta?.targetedCompanyOther as string | undefined) ??
      (r.company as string | null | undefined) ??
      null,
    field: (meta?.domain ?? r.field as string | undefined) ?? '',
    // The wizard's company label lands in `interviewMetaData.targetedCompany`
    // (or `targetedCompanyOther` for the non-curated archetypes the new wizard
    // offers), never on a column of its own.
    type: ((r.interviewType ?? r.type) as string | undefined)?.toLowerCase() as Interview['type'] ?? 'mixed',
    difficulty: ((r.interviewDifficulty ?? r.difficulty) as string | undefined)?.toLowerCase() as Interview['difficulty'] ?? 'medium',
    experienceLevel: (r.experienceLevel as Interview['experienceLevel'] | undefined) ?? 'mid',
    status: toFrontendStatus(backendStatus ?? 'DRAFT'),
    topics: (r.topics as string[] | undefined) ?? [],
    // The wizard's question budget lives in `interviewMetaData`, not on a column.
    questionCount: (r.questionCount as number | undefined) ?? meta?.questionCount ?? 0,
    rounds: (r.rounds as number | undefined) ?? 1,
    durationMinutes: (r.durationMinutes as number | undefined) ?? 30,
    score: (r.score as number | null | undefined) ?? null,
    band: (r.band as Interview['band'] | undefined) ?? null,
    summary: ((r.interviewDescription ?? r.summary) as string | null | undefined) ?? null,
    createdAt: r.createdAt,
    updatedAt: (r.lastActivityAt ?? r.updatedAt ?? r.createdAt),
    completedAt: (r.completedAt as string | null | undefined) ?? null,
    progress: (r.progress as number | undefined) ?? 0,
    currentRound: (r.currentRound as number | undefined) ?? 0,
    answeredCount: (r.answeredCount as number | undefined) ?? 0,
    candidateId: r.userId,
  }
}

const I = (path: string) => `/interviews${path}`

export const interviewService = {
  /**
   * `GET /interviews` is an unfiltered, unpaginated read of every interview the
   * caller owns — the backend has no search/status/type/sort/page query contract
   * (see `getAllInterviewsService`). Sending those params would be a silent
   * no-op, so the list is filtered, sorted and paged here instead of pretending
   * the server does it.
   */
  async list(filters: InterviewFilters = {}): Promise<Paginated<Interview>> {
    const { search = '', status = 'all', type = 'all', sort = 'recent', page = 1, pageSize = 8 } = filters
    const rows = (await httpGet<InterviewResponse[]>(I(''))).map(mapInterview)

    const needle = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false
      if (type !== 'all' && row.type !== type) return false
      if (!needle) return true
      return [row.roleTitle, row.code, row.company ?? '', row.field]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })

    filtered.sort((a, b) => {
      if (sort === 'score') return (b.score ?? -1) - (a.score ?? -1)
      if (sort === 'role') return a.roleTitle.localeCompare(b.roleTitle)
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })

    const total = filtered.length
    const safePage = Math.max(1, page)
    const start = (safePage - 1) * pageSize
    return {
      items: filtered.slice(start, start + pageSize),
      total,
      page: safePage,
      pageSize,
    }
  },

  async all(): Promise<Interview[]> {
    const raw = await httpGet<InterviewResponse[]>(I(''))
    return raw.map(mapInterview)
  },

  async get(id: string): Promise<Interview | null> {
    try {
      const raw = await httpGet<InterviewResponse>(I(`/${id}`))
      return mapInterview(raw)
    } catch {
      return null
    }
  },

  async getByToken(token: string): Promise<Interview | null> {
    try {
      const raw = await httpGet<{ interview: InterviewResponse }>(I(`/shared/${token}`))
      return mapInterview(raw.interview)
    } catch {
      return null
    }
  },

  async resumable(): Promise<Interview[]> {
    const raw = await httpGet<InterviewResponse[]>(I('/resumable'))
    return raw.map(mapInterview)
  },

  async questions(id: string): Promise<Question[]> {
    const raw = await httpGet<{ questions: { questionId: string; sequenceNumber: number; questionTitle: string; questionType: string; questionState: string; evaluationData: { score: number } | null; answerData: string | null; answerFormat: 'TEXT' | 'CODE' | null; answerLanguage: string | null }[] } | Question[]>(I(`/${id}/history`))
    if (Array.isArray(raw)) return raw
    return (raw.questions ?? []).map((q, i) => ({
      id: q.questionId,
      interviewId: id,
      index: q.sequenceNumber ?? i + 1,
      kind: q.answerFormat === 'CODE' ? 'code' : (q.questionType?.toLowerCase() as Question['kind'] ?? 'behavioral'),
      prompt: q.questionTitle ?? '',
      topic: '',
      difficulty: 'medium' as Question['difficulty'],
      answer: q.answerData ?? null,
      answerFormat: q.answerFormat ?? null,
      codeLanguage: q.answerLanguage ?? null,
      score: q.evaluationData?.score ?? null,
      band: null,
      headline: null,
      feedback: null,
      strengths: [],
      improvements: [],
      decision: null,
      durationSeconds: 0,
    }))
  },

  async report(id: string): Promise<InterviewReport> {
    type BackendReport = {
      id: string
      interviewId: string
      overallScore: string | number
      technicalScore: string | number
      communicationScore: string | number
      problemSolvingScore: string | number
      confidenceScore: string | number
      questionsAnswered: number
      questionsSkipped: number
      questionsEvaluated: number
      totalDuration: number
      feedback: string
      strengths: string[]
      weaknesses: string[]
      createdAt: string
      updatedAt: string
      difficultyProgression?: string[]
    }
    type BackendHistory = {
      questions: {
        questionId: string
        sequenceNumber: number
        questionTitle: string
        questionType: string
        answerData: string | null
        answerFormat: 'TEXT' | 'CODE' | null
        answerLanguage: string | null
        evaluationData: {
          score: number
          correctness: number
          relevance: number
          clarity: number
          technicalDepth: number
          feedback: string
          strengths: string[]
          weaknesses: string[]
        } | null
        timeTakenSeconds: number | null
      }[]
    }

    const [raw, history] = await Promise.all([
      httpGet<BackendReport>(I(`/${id}/report`)),
      httpGet<BackendHistory>(I(`/${id}/history`)).catch(() => ({ questions: [] })),
    ])

    const score = (v: string | number) => Math.round(Number(v))
    const overall = score(raw.overallScore)

    const questions: Question[] = (history.questions ?? []).map((q, i) => ({
      id: q.questionId,
      interviewId: id,
      index: q.sequenceNumber ?? i + 1,
      kind: q.answerFormat === 'CODE' ? 'code' : (q.questionType?.toLowerCase() as Question['kind'] ?? 'behavioral'),
      prompt: q.questionTitle ?? '',
      topic: q.questionType ?? '',
      difficulty: 'medium' as Question['difficulty'],
      answer: q.answerData ?? null,
      answerFormat: q.answerFormat ?? null,
      codeLanguage: q.answerLanguage ?? null,
      score: q.evaluationData?.score ?? null,
      band: null,
      headline: null,
      feedback: q.evaluationData?.feedback ?? null,
      strengths: q.evaluationData?.strengths ?? [],
      improvements: q.evaluationData?.weaknesses ?? [],
      decision: null,
      durationSeconds: q.timeTakenSeconds ?? 0,
    }))

    const skills = [
      { skill: 'Technical', score: score(raw.technicalScore) },
      { skill: 'Communication', score: score(raw.communicationScore) },
      { skill: 'Problem Solving', score: score(raw.problemSolvingScore) },
      { skill: 'Confidence', score: score(raw.confidenceScore) },
    ]

    const progression = questions.map((q, i) => ({
      index: i + 1,
      label: `Q${i + 1}`,
      score: q.score ?? 0,
      difficulty: 'medium' as Question['difficulty'],
    }))

    const topicMap = new Map<string, { total: number; count: number }>()
    questions.forEach((q) => {
      const t = q.topic || 'General'
      const entry = topicMap.get(t) ?? { total: 0, count: 0 }
      topicMap.set(t, { total: entry.total + (q.score ?? 0), count: entry.count + 1 })
    })
    const topics = Array.from(topicMap.entries()).map(([topic, { total, count }]) => ({
      topic,
      score: Math.round(total / count),
    }))

    const bandScore = overall >= 85 ? 'strong' : overall >= 70 ? 'good' : overall >= 55 ? 'vague' : 'weak'

    return {
      interviewId: id,
      overallScore: overall,
      band: bandScore as InterviewReport['band'],
      headline: raw.feedback ? raw.feedback.split('.')[0] ?? 'Interview complete' : 'Interview complete',
      summary: raw.feedback || 'No summary available.',
      strengths: raw.strengths ?? [],
      weaknesses: raw.weaknesses ?? [],
      recommendations: raw.weaknesses?.slice(0, 3) ?? [],
      skills,
      progression,
      topics,
      shareToken: '',
      generatedAt: raw.createdAt,
      questions,
    }
  },

  async reportByToken(token: string): Promise<InterviewReport> {
    type BackendSharedReport = {
      report: {
        overallScore: string | number
        technicalScore: string | number
        communicationScore: string | number
        problemSolvingScore: string | number
        confidenceScore: string | number
        feedback: string
        strengths: string[]
        weaknesses: string[]
        createdAt: string
      }
      interview: { id: string; title: string; type: string; difficulty: string }
      questions: {
        sequenceNumber: number
        questionTitle: string
        questionType: string
      answerData: string | null
      answerFormat: 'TEXT' | 'CODE' | null
      answerLanguage: string | null
      evaluationData: { score: number; feedback: string; strengths: string[]; weaknesses: string[] } | null
        timeTakenSeconds: number | null
      }[]
    }
    const raw = await httpGet<BackendSharedReport>(I(`/shared/${token}`))
    const score = (v: string | number) => Math.round(Number(v))
    const overall = score(raw.report.overallScore)
    const questions: Question[] = (raw.questions ?? []).map((q, i) => ({
      id: `${i}`,
      interviewId: raw.interview.id,
      index: q.sequenceNumber ?? i + 1,
      kind: q.answerFormat === 'CODE' ? 'code' : (q.questionType?.toLowerCase() as Question['kind'] ?? 'behavioral'),
      prompt: q.questionTitle ?? '',
      topic: q.questionType ?? '',
      difficulty: 'medium' as Question['difficulty'],
      answer: q.answerData ?? null,
      answerFormat: q.answerFormat ?? null,
      codeLanguage: q.answerLanguage ?? null,
      score: q.evaluationData?.score ?? null,
      band: null,
      headline: null,
      feedback: q.evaluationData?.feedback ?? null,
      strengths: q.evaluationData?.strengths ?? [],
      improvements: q.evaluationData?.weaknesses ?? [],
      decision: null,
      durationSeconds: q.timeTakenSeconds ?? 0,
    }))
    const bandScore = overall >= 85 ? 'strong' : overall >= 70 ? 'good' : overall >= 55 ? 'vague' : 'weak'
    return {
      interviewId: raw.interview.id,
      overallScore: overall,
      band: bandScore as InterviewReport['band'],
      headline: raw.report.feedback?.split('.')[0] ?? 'Interview complete',
      summary: raw.report.feedback || 'No summary available.',
      strengths: raw.report.strengths ?? [],
      weaknesses: raw.report.weaknesses ?? [],
      recommendations: raw.report.weaknesses?.slice(0, 3) ?? [],
      skills: [
        { skill: 'Technical', score: score(raw.report.technicalScore) },
        { skill: 'Communication', score: score(raw.report.communicationScore) },
        { skill: 'Problem Solving', score: score(raw.report.problemSolvingScore) },
        { skill: 'Confidence', score: score(raw.report.confidenceScore) },
      ],
      progression: questions.map((q, i) => ({ index: i + 1, label: `Q${i + 1}`, score: q.score ?? 0, difficulty: 'medium' as Question['difficulty'] })),
      topics: [],
      shareToken: token,
      generatedAt: raw.report.createdAt,
      questions,
    }
  },

  /**
   * Maps the wizard draft onto `createInterviewSchema` (`backend/src/modules/
   * interview/zodschemas/interview.zschema.ts`). The draft's wire names and enum
   * values are display-level and would fail validation verbatim — `jobrole` and
   * `duration` are required, and the enums are uppercase.
   *
   * Deliberately not sent: `rounds` and scheduling (`isScheduled` /
   * `scheduledDate`) — the backend create contract has no rounds concept and
   * the wizard collects no date, so both are documented as deferred in
   * docs/frontend-backend-gaps.md rather than smuggled in as unknown keys.
   */
  async create(draft: NewInterviewDraft): Promise<Interview> {
    const experience =
      draft.experienceLevel === 'intern'
        ? 'fresher'
        : draft.experienceLevel === 'junior'
          ? 'junior'
          : draft.experienceLevel === 'mid'
            ? 'mid-level'
            : 'senior'
    const difficulty =
      draft.difficulty === 'easy'
        ? 'EASY'
        : draft.difficulty === 'hard' || draft.difficulty === 'expert'
          ? 'HARD'
          : 'MEDIUM'
    const interviewType =
      draft.type === 'behavioral'
        ? 'BEHAVIORAL'
        : draft.type === 'technical'
          ? 'TECHNICAL'
          : 'MIXED'

    // `companyChoice` is the wizard's archetype id (none | series-b-startup |
    // big-tech | fintech | agency | other) and `company` is its label. None of
    // them are in the backend's curated `TARGET_COMPANIES` enum, so they travel
    // as `targetedCompanyOther` — which is what the service stores in
    // `interviewMetaData.targetedCompany`.
    const company =
      draft.companyChoice === 'none' ? null : (draft.company || draft.companyChoice)

    const body = {
      jobrole: draft.roleTitle,
      domain: draft.field,
      experience,
      jobSkills: draft.topics,
      difficulty,
      isAdaptive: false,
      // The wizard collects no style, and REGULAR is the backend's
      // "no culture slant" option — FAANG is only the schema's placeholder default.
      interviewStyle: 'REGULAR',
      interviewType,
      duration: draft.durationMinutes,
      isScheduled: false,
      endingCriteria: 'DURATION',
      ...(company ? { targetedCompanyOther: company } : {}),
    }
    const res = await httpPost<CreateInterviewResponse>(I(''), body)
    const newId = res.id ?? res.interviewId ?? ''
    const raw = await httpGet<InterviewResponse>(I(`/${newId}`))
    return mapInterview(raw)
  },

  async cancel(id: string): Promise<void> {
    await httpPost(I(`/${id}/cancel`))
  },

  async start(id: string): Promise<void> {
    await httpPost(I(`/${id}/start`))
  },

  async end(id: string): Promise<void> {
    await httpPost(I(`/${id}/end`))
  },

  async delete(id: string): Promise<void> {
    await httpDelete(I(`/${id}`))
  },

  async createShareLink(id: string): Promise<{ token: string }> {
    return httpPost<{ token: string }>(I(`/${id}/share`))
  },

  async revokeShareLink(id: string, token: string): Promise<void> {
    await httpPost(I(`/${id}/share/revoke`), { token })
  },
}
