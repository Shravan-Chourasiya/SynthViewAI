import { describe, it, expect } from 'vitest'
import { buildFullReportPdf, pdfSafe, safeFilename } from '@/lib/pdf-export'
import type { Interview, InterviewReport, TimelineEvent } from '@/lib/types'

/**
 * Regression coverage for two defects that only showed up in a real export:
 *
 *  1. jsPDF's built-in Helvetica is single-byte. Text above U+00FF was dropped or
 *     re-encoded as UTF-16, so a single em dash in an AI sentence garbled the rest
 *     of that line in the downloaded report.
 *  2. A list item that crossed a page boundary pulled the draw cursor back to the
 *     page it started on, which pushed every later item onto a page of its own.
 *
 * Both are asserted against the document jsPDF actually produced, not against the
 * inputs, because the input being right is not what was broken.
 */

// ── Reading the generated document ──────────────────────────────────────────

/** jsPDF keeps each page's content stream on `internal.pages`, uncompressed. */
function pages(doc: unknown): string[][] {
  const internal = (doc as { internal: { pages: string[][] } }).internal
  return internal.pages.slice(1)
}

/** Every `(...) Tj` literal on a page, paired with its baseline y coordinate. */
function pageText(page: string[]): { text: string; y: number }[] {
  return page.flatMap((fragment) => {
    const tj = fragment.indexOf(' Tj')
    if (tj === -1) return []
    const text = fragment.slice(fragment.lastIndexOf('(', tj) + 1, tj - 1)
    const position = fragment.match(/-?[\d.]+ (-?[\d.]+) Td/)
    return [{ text, y: Number(position?.[1] ?? NaN) }]
  })
}

const allText = (doc: unknown) =>
  pages(doc)
    .flatMap(pageText)
    .map((run) => run.text)
    .join('\n')

// ── Fixtures ────────────────────────────────────────────────────────────────

const interview: Interview = {
  id: 'iv-1',
  userId: 'user-1',
  status: 'COMPLETED',
  createdAt: '2026-09-23T19:45:00.000Z',
  lastActivityAt: '2026-09-23T19:48:00.000Z',
  progress: 1,
  score: 85.75,
  currentRound: 1,
  currentQuestion: 4,
  domain: 'Mobile Development',
  roleTitle: 'Flutter developer',
  company: 'Netflix',
  experienceLevel: 'Mid-level',
  difficulty: 'Adaptive',
  type: 'Mixed',
  durationMin: 15,
  rounds: 1,
  topics: ['Performance', 'Communication'],
  interviewStyle: 'MAANG',
  endingCriteria: 'DURATION',
}

const evaluation = (score: number, overrides: Partial<InterviewReport['questions'][number]['evaluation']> = {}) => ({
  score,
  signal: 'strong' as const,
  feedback: 'You explained a clear, severity—based prioritisation strategy.',
  strengths: ['Specific mention of DevTools features'],
  weaknesses: ['Did not mention CPU/memory timelines'],
  ...overrides,
})

const history: TimelineEvent[] = [
  {
    id: 'e1',
    type: 'question_delivered',
    label: 'Question 1',
    detail: 'What profiling tools did you use?',
    at: '2026-09-23T19:45:55.000Z',
  },
]

function reportWith(questions: InterviewReport['questions'], weaknesses: string[] = []): InterviewReport {
  return {
    interviewId: 'iv-1',
    overallScore: 85.75,
    categoryScores: [
      { label: 'Technical', value: 88.75 },
      { label: 'Communication', value: 85.5 },
    ],
    strengths: ['Clear metric—based verification'],
    weaknesses,
    summary: 'Solid coverage of profiling tools — with room to quantify impact.',
    recommendations: [],
    difficultyProgression: ['Adaptive', 'Follow-up'],
    questions,
  }
}

// ── Text encoding ───────────────────────────────────────────────────────────

describe('pdfSafe', () => {
  it('transliterates the punctuation the core font cannot encode', () => {
    expect(pdfSafe('a—b')).toBe('a-b')
    expect(pdfSafe('a–b')).toBe('a-b')
    expect(pdfSafe('“quoted”')).toBe('"quoted"')
    expect(pdfSafe('don’t')).toBe("don't")
    expect(pdfSafe('watch → verify')).toBe('watch -> verify')
    expect(pdfSafe('13 ≥ 12 ≥ 11')).toBe('13 >= 12 >= 11')
    expect(pdfSafe('• bullet')).toBe('- bullet')
    expect(pdfSafe('✓ done')).toBe('+ done')
    expect(pdfSafe('a\u00A0b')).toBe('a b')
  })

  it('leaves the Latin-1 characters the font does render alone', () => {
    expect(pdfSafe('Q1 · TECHNICAL · 80/100')).toBe('Q1 · TECHNICAL · 80/100')
    expect(pdfSafe('café 32° 2×')).toBe('café 32° 2×')
  })

  it('replaces out-of-range characters with one placeholder each', () => {
    expect(pdfSafe('coffee ☕ please')).toBe('coffee ? please')
    expect(pdfSafe('नमस्ते')).toBe('??????')
  })

  it('never leaves a character above U+00FF for jsPDF to mangle', () => {
    const dirty = '— “q” ✓ → ≥ ☕ 漢字 \u0000'
    for (const char of pdfSafe(dirty)) {
      expect(char.codePointAt(0)!).toBeLessThanOrEqual(0xff)
    }
  })
})

describe('safeFilename', () => {
  it('strips punctuation out of the download name', () => {
    expect(safeFilename('Flutter developer at Netflix — full report')).toBe(
      'flutter-developer-at-netflix-full-report',
    )
  })
})

// ── Generated document ──────────────────────────────────────────────────────

describe('buildFullReportPdf', () => {
  it('renders evaluator punctuation as text instead of corrupting the line', () => {
    const doc = buildFullReportPdf({
      interview,
      report: reportWith([{ question: 'Q?', answer: 'Answer ☕ text', level: 'TECHNICAL', evaluation: evaluation(80) }]),
      metrics: null,
      history,
    })

    const text = allText(doc)

    // The em dash became a hyphen and the sentence survived intact — before the
    // fix, everything after the dash in that string was re-encoded as UTF-16.
    expect(text).toContain('severity-based prioritisation strategy')
    expect(text).toContain('Clear metric-based verification')
    expect(text).not.toContain('\u2014')

    // No control characters: their presence is the signature of the corruption.
    expect(text).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/)

    // Out-of-range characters are visible placeholders, never silently dropped.
    expect(text).toContain('Answer ? text')
  })

  it('omits the recommended-resources section when the report has none', () => {
    const doc = buildFullReportPdf({
      interview,
      report: reportWith([{ question: 'Q?', answer: 'A', level: 'TECHNICAL', evaluation: evaluation(80) }]),
      metrics: null,
      history,
    })

    expect(allText(doc)).not.toContain('Recommended resources')
  })

  it('shows recommendations when a report actually carries them', () => {
    const report = reportWith([
      { question: 'Q?', answer: 'A', level: 'TECHNICAL', evaluation: evaluation(80) },
    ])
    report.recommendations = [{ gap: 'Timing budgets', resource: 'Read the Flutter performance guide' }]

    const text = allText(
      buildFullReportPdf({ interview, report, metrics: null, history }),
    )

    expect(text).toContain('Recommended resources')
    expect(text).toContain('Timing budgets - Read the Flutter performance guide')
  })

  it('does not give every list item past a page break its own page', () => {
    // 80 one-line items need two pages of page-space. The regression turned that
    // into roughly one page per item, because the cursor was restored to the
    // coordinate it held on the page *before* the break.
    const items = Array.from({ length: 80 }, (_, i) => `Gap ${i + 1} to address`)
    const doc = buildFullReportPdf({
      interview,
      report: reportWith(
        [
          {
            question: 'Q?',
            answer: 'A',
            level: 'TECHNICAL',
            evaluation: evaluation(80, { weaknesses: items }),
          },
        ],
        [],
      ),
      metrics: null,
      history,
    })

    const bulletCounts = pages(doc).map(
      (page) => pageText(page).filter((run) => run.text === '!').length,
    )
    const bulletPages = bulletCounts.filter((count) => count > 0)

    // The list really did cross a page boundary, otherwise this proves nothing.
    expect(bulletPages.length).toBeGreaterThan(1)

    // Two pages are needed, so allow one page of slack for how the split lands.
    expect(bulletPages.length).toBeLessThanOrEqual(3)

    // And no page in the middle of the list may hold a single stray item.
    for (const count of bulletPages.slice(1, -1)) {
      expect(count).toBeGreaterThanOrEqual(2)
    }

    // Every item still printed exactly once.
    expect(bulletCounts.reduce((sum, count) => sum + count, 0)).toBe(items.length)
  })

  it('keeps the bullet rows in reading order within a page', () => {
    const doc = buildFullReportPdf({
      interview,
      report: reportWith([
        {
          question: 'Q?',
          answer: 'A',
          level: 'TECHNICAL',
          evaluation: evaluation(80, {
            weaknesses: ['First gap', 'Second gap', 'Third gap', 'Fourth gap'],
          }),
        },
      ]),
      metrics: null,
      history,
    })

    pages(doc).forEach((page) => {
      const bullets = pageText(page).filter((run) => run.text === '!')
      for (let i = 1; i < bullets.length; i += 1) {
        // PDF coordinates grow upwards, so a later item sits lower on the page.
        expect(bullets[i]!.y).toBeLessThan(bullets[i - 1]!.y)
      }
    })
  })
})
