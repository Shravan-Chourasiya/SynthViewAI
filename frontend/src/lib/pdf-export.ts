import { jsPDF } from 'jspdf'
import type { Interview, InterviewReport, TimelineEvent } from './types'

/**
 * Report export.
 *
 * ## Option B — client-side, data-driven generation
 *
 * This module builds the PDF from the report *data* (the same objects the React
 * pages already hold) using jsPDF's native text/vector drawing API. It never
 * reads or rasterizes the rendered DOM.
 *
 * Two concrete bars this clears, neither of which a screenshot-to-PDF can:
 *
 *  1. **Selectable/searchable text** — every string is a real PDF text object.
 *  2. **Controlled page breaks** — sections are measured *before* they are
 *     drawn (`placeBlock`). A card is only ever started when its full height
 *     fits on the remaining space, so a card is never sliced by a page
 *     boundary. Text is wrapped and paginated line-by-line, so a page break can
 *     never land in the middle of a glyph or a line.
 *
 * The one unavoidable case is a single card taller than a whole page: it has to
 * split somewhere. Those render as borderless sections (see `cardBlock`) so
 * there is no rectangle to cut across, and the text still paginates cleanly.
 *
 * Finer-grained jsPDF capabilities (e.g. tagged/accessible PDF) are out of scope.
 */

// ── Palette ─────────────────────────────────────────────────────────────────
// The app's theme colours are oklch() CSS variables, which jsPDF cannot parse,
// so the print palette below mirrors them as RGB.

type Rgb = [number, number, number]

const COLORS: Record<'ink' | 'muted' | 'line' | 'soft' | 'primary' | 'strong' | 'vague' | 'weak', Rgb> = {
  ink: [17, 24, 39],
  muted: [107, 114, 128],
  line: [226, 232, 240],
  soft: [247, 248, 250],
  primary: [47, 107, 224],
  strong: [31, 157, 99],
  vague: [201, 138, 26],
  weak: [209, 72, 60],
}

const PAGE = { width: 210, height: 297, margin: 14 }
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2
const FOOTER_Y = PAGE.height - 10
const BOTTOM = FOOTER_Y - 6
const CONTENT_HEIGHT = BOTTOM - PAGE.margin

// ── Public shapes ───────────────────────────────────────────────────────────

export interface ReportMetrics {
  interviewId?: string
  overall: number
  questionScores: { label: string; value: number }[]
  topics: { label: string; value: number }[]
  timePerQuestion: number[]
  activeSeconds: number
}

export type ExportTab = 'overview' | 'report' | 'metrics' | 'timeline'

export interface ExportPayload {
  interview: Interview
  tab: ExportTab
  /** Present when the current page already holds the data for its own tab. */
  report?: InterviewReport | null
  metrics?: ReportMetrics | null
  history?: TimelineEvent[] | null
}

/** Sanitises a title into a safe download filename. Shared by every export path. */
export function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'interview-report'
}

// ── Text encoding ───────────────────────────────────────────────────────────

/**
 * The built-in Helvetica that jsPDF draws with is a **single-byte** font: only
 * code points U+0000–U+00FF survive `text()`. Anything above that is either
 * silently dropped or re-encoded as UTF-16 — which is how an em dash in an AI
 * sentence used to turn the rest of that line into NUL-interleaved garbage in
 * the exported report.
 *
 * The evaluator emits typographic punctuation (curly quotes, en/em dashes,
 * bullets, arrows) as a matter of course and candidates paste emoji, so rather
 * than trusting every caller to avoid it, all drawn text is normalised here.
 */
const GLYPH_FALLBACKS: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/[\u2012\u2013\u2014\u2015\u2212]/g, '-'],
  [/[\u2022\u2023\u25CF\u25E6\u25AA\u2043]/g, '-'],
  [/[\u2026]/g, '...'],
  [/[\u2192\u21D2]/g, '->'],
  [/[\u2190\u21D0]/g, '<-'],
  [/[\u2265]/g, '>='],
  [/[\u2264]/g, '<='],
  [/[\u2713\u2714]/g, '+'],
  [/[\u2717\u2718\u2716\u274C]/g, 'x'],
  [/[\u00A0\u2007\u2009\u202F]/g, ' '],
  [/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, ''],
]

/** Normalises text to the character range jsPDF's core fonts can actually render. */
export function pdfSafe(value: string): string {
  let out = String(value ?? '')
  for (const [pattern, replacement] of GLYPH_FALLBACKS) out = out.replace(pattern, replacement)
  // Whatever is still out of range (emoji, non-Latin scripts) would be dropped or
  // corrupted, so it becomes one visible placeholder per code point instead.
  return out.replace(/[^\u0000-\u00FF]/gu, '?')
}

// ── Measure-then-draw primitives ────────────────────────────────────────────
// Every block advertises its exact height before it is drawn, which is what lets
// `placeBlock` decide whether it still fits on the current page.

interface Block {
  height: number
  draw: () => void
}

/** One line of text at `size` (pt) occupies about this many millimetres. */
const mmPerLine = (size: number) => size * 1.28 * 0.3528

/** Light tint of a colour, used for chip and card fills (jsPDF has no alpha here). */
const tint = ([r, g, b]: Rgb, strength = 0.88): Rgb => [
  Math.round(r + (255 - r) * strength),
  Math.round(g + (255 - g) * strength),
  Math.round(b + (255 - b) * strength),
]

function createBuilder(documentTitle: string) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  let y = PAGE.margin
  let pageNumber = 1

  function textColor([r, g, b]: Rgb) {
    pdf.setTextColor(r, g, b)
  }

  function drawFooter() {
    pdf.setDrawColor(...COLORS.line)
    pdf.setLineWidth(0.2)
    pdf.line(PAGE.margin, FOOTER_Y - 2, PAGE.width - PAGE.margin, FOOTER_Y - 2)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    textColor(COLORS.muted)
    pdf.text(pdfSafe(documentTitle), PAGE.margin, FOOTER_Y)
    pdf.text(`Page ${pageNumber}`, PAGE.width - PAGE.margin, FOOTER_Y, { align: 'right' })
  }

  function addPage() {
    drawFooter()
    pdf.addPage()
    pageNumber += 1
    y = PAGE.margin
  }

  function ensureSpace(height: number) {
    if (y + height > BOTTOM) addPage()
  }

  /** Wrapped text. Breaks line-by-line, so a break never splits a line. */
  function textBlock(
    text: string,
    options: { size?: number; bold?: boolean; color?: Rgb; indent?: number; gapAfter?: number } = {},
  ): Block {
    const size = options.size ?? 9.5
    const indent = options.indent ?? 0
    const gapAfter = options.gapAfter ?? 2
    const lineHeight = mmPerLine(size)
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const lines = pdf.splitTextToSize(pdfSafe(text), CONTENT_WIDTH - indent) as string[]
    return {
      height: lines.length * lineHeight + gapAfter,
      draw: () => {
        pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
        pdf.setFontSize(size)
        textColor(options.color ?? COLORS.ink)
        for (const line of lines) {
          if (y + lineHeight > BOTTOM) addPage()
          pdf.text(line, PAGE.margin + indent, y + lineHeight * 0.72)
          y += lineHeight
        }
        y += gapAfter
      },
    }
  }

  function headingBlock(text: string, size = 12): Block {
    return textBlock(text, { size, bold: true, gapAfter: 2.5 })
  }

  /** A label/value list, used for key facts in the Overview and hero sections. */
  function keyValueBlock(rows: Array<[string, string]>): Block {
    const rowHeight = 5.6
    return {
      height: rows.length * rowHeight,
      draw: () => {
        for (const [label, value] of rows) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8.5)
          textColor(COLORS.muted)
          pdf.text(pdfSafe(label), PAGE.margin, y + 3.6)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9.5)
          textColor(COLORS.ink)
          const lines = pdf.splitTextToSize(pdfSafe(value), CONTENT_WIDTH - 52) as string[]
          pdf.text(lines, PAGE.margin + 52, y + 3.6)
          y += rowHeight * Math.max(1, lines.length)
        }
      },
    }
  }

  /** Horizontal bar chart with a label, a filled track and the value. */
  function barChartBlock(data: { label: string; value: number }[], maxOverride?: number): Block {
    const barHeight = 4
    const rowHeight = barHeight + 4.2
    const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1)
    return {
      height: data.length * rowHeight,
      draw: () => {
        for (const item of data) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8.5)
          textColor(COLORS.muted)
          pdf.text(pdfSafe(item.label), PAGE.margin, y + 3.4)
          pdf.setFont('helvetica', 'bold')
          textColor(COLORS.ink)
          pdf.text(String(item.value), PAGE.width - PAGE.margin, y + 3.4, { align: 'right' })

          const trackX = PAGE.margin + 40
          const trackWidth = CONTENT_WIDTH - 40 - 12
          pdf.setFillColor(...COLORS.soft)
          pdf.roundedRect(trackX, y + 0.6, trackWidth, barHeight, 1.2, 1.2, 'F')
          const filled = Math.max(0, Math.min(1, item.value / max)) * trackWidth
          pdf.setFillColor(...COLORS.primary)
          pdf.roundedRect(trackX, y + 0.6, filled, barHeight, 1.2, 1.2, 'F')
          y += rowHeight
        }
      },
    }
  }

  /** Numbered/bulleted list; each item is kept whole on one line set. */
  function listBlock(items: string[], options: { bullet?: string; size?: number; color?: Rgb } = {}): Block {
    const size = options.size ?? 9.5
    const lineHeight = mmPerLine(size)
    const bullet = pdfSafe(options.bullet ?? '-')
    const prepared = items.map((item) => pdf.splitTextToSize(pdfSafe(item), CONTENT_WIDTH - 6) as string[])
    return {
      height: prepared.reduce((sum, lines) => sum + lines.length * lineHeight + 1.6, 0),
      draw: () => {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(size)
        textColor(options.color ?? COLORS.ink)
        for (const lines of prepared) {
          for (let i = 0; i < lines.length; i += 1) {
            if (y + lineHeight > BOTTOM) addPage()
            if (i === 0) pdf.text(bullet, PAGE.margin, y + lineHeight * 0.72)
            pdf.text(lines[i]!, PAGE.margin + 5, y + lineHeight * 0.72)
            y += lineHeight
          }
          // The gap goes *after* the item that was just drawn. Restoring to the
          // item's start row (as an earlier version did) assumed the item never
          // crossed a page boundary; when it did, the cursor was pulled back up to
          // the previous page's coordinates and every later item was pushed onto a
          // page of its own.
          y += 1.6
        }
      },
    }
  }

  /** Small wrapped chips (score bands, difficulty steps, topics). */
  function chipBlock(rawLabels: string[], colorFor: (label: string) => Rgb): Block {
    const labels = rawLabels.map(pdfSafe)
    const size = 8
    const chipHeight = 6
    const gap = 2
    const lineHeight = chipHeight + gap
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(size)
    const widths = labels.map((label) => pdf.getTextWidth(label) + 6)
    // Greedy row packing of chips.
    const rows: { label: string; width: number }[][] = []
    let current: { label: string; width: number }[] = []
    let used = 0
    labels.forEach((label, i) => {
      const width = widths[i]!
      if (used + width > CONTENT_WIDTH && current.length) {
        rows.push(current)
        current = []
        used = 0
      }
      current.push({ label, width })
      used += width + gap
    })
    if (current.length) rows.push(current)

    return {
      height: rows.length * lineHeight + 1.5,
      draw: () => {
        for (const row of rows) {
          if (y + lineHeight > BOTTOM) addPage()
          let x = PAGE.margin
          for (const chip of row) {
            const [r, g, b] = colorFor(chip.label)
            pdf.setFillColor(...tint([r, g, b]))
            pdf.setDrawColor(r, g, b)
            pdf.setLineWidth(0.2)
            pdf.roundedRect(x, y + 0.8, chip.width, chipHeight, 1.5, 1.5, 'FD')
            textColor([r, g, b])
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(size)
            pdf.text(chip.label, x + 3, y + 4.9)
            x += chip.width + gap
          }
          y += lineHeight
        }
        y += 1.5
      },
    }
  }

  function spacerBlock(height: number): Block {
    return { height, draw: () => { y += height } }
  }

  /**
   * Groups blocks into a bordered card. The border is only drawn when the whole
   * card fits on a single page — a card taller than a page renders borderless so
   * a page break can never slice a rectangle in half.
   */
  function cardBlock(blocks: Block[], options: { title?: string; padding?: number } = {}): Block {
    const padding = options.padding ?? 5
    const gap = 3
    const titleBlock = options.title ? headingBlock(options.title, 11) : null
    const inner = titleBlock ? [titleBlock, ...blocks] : blocks
    const innerHeight =
      inner.reduce((sum, block) => sum + block.height, 0) + Math.max(0, inner.length - 1) * gap
    const height = innerHeight + padding * 2

    const drawInner = () => {
      y += padding
      inner.forEach((block, index) => {
        block.draw()
        if (index < inner.length - 1) y += gap
      })
      y += padding
    }

    return {
      height,
      draw: () => {
        if (height <= CONTENT_HEIGHT) {
          const [r, g, b] = COLORS.line
          pdf.setFillColor(...COLORS.soft)
          pdf.setDrawColor(r, g, b)
          pdf.setLineWidth(0.3)
          pdf.roundedRect(PAGE.margin, y, CONTENT_WIDTH, height, 2.5, 2.5, 'FD')
          drawInner()
        } else {
          // Too tall for any page: render as a bordered-top section instead.
          pdf.setDrawColor(...COLORS.line)
          pdf.setLineWidth(0.3)
          pdf.line(PAGE.margin, y, PAGE.width - PAGE.margin, y)
          y += 3
          drawInner()
        }
      },
    }
  }

  function scoreChipColor(score: number): Rgb {
    if (score >= 80) return COLORS.strong
    if (score >= 60) return COLORS.primary
    if (score >= 40) return COLORS.vague
    return COLORS.weak
  }

  /**
   * Places a block, keeping it whole: a block is only started if its full height
   * still fits, otherwise it begins on a fresh page. Blocks taller than a page
   * are allowed to flow (their own internals paginate safely).
   */
  function placeBlock(block: Block) {
    if (block.height <= CONTENT_HEIGHT) {
      ensureSpace(block.height)
    } else if (y + block.height > BOTTOM) {
      addPage()
    }
    block.draw()
  }

  /**
   * Closes the document and hands back the jsPDF instance. Callers save it; tests
   * read its bytes, which is the only way to verify what the encoding produced.
   */
  function document() {
    drawFooter()
    return pdf
  }

  return {
    placeBlock,
    textBlock,
    headingBlock,
    keyValueBlock,
    barChartBlock,
    listBlock,
    chipBlock,
    cardBlock,
    spacerBlock,
    scoreChipColor,
    document,
  }
}

// ── Section composition ─────────────────────────────────────────────────────

type Builder = ReturnType<typeof createBuilder>

const title = (interview: Interview) =>
  interview.company ? `${interview.roleTitle} at ${interview.company}` : `${interview.roleTitle} interview`

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const fmtDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`
}

function renderOverview(builder: Builder, interview: Interview, metrics?: ReportMetrics | null) {
  builder.placeBlock(builder.headingBlock('Overview', 14))

  const facts: Array<[string, string]> = [
    ['Target role', interview.roleTitle],
    ['Domain', interview.domain],
    ['Company', interview.company ?? 'No target company'],
    ['Interview type', interview.type],
    ['Difficulty', interview.difficulty],
    ['Experience', interview.experienceLevel],
    ['Interview style', interview.interviewStyle === 'REGULAR' ? 'Other / regular' : interview.interviewStyle],
    ['Duration', `${interview.durationMin} min`],
    [
      'Ends by',
      interview.endingCriteria === 'QUESTION_COUNT'
        ? `${interview.questionCount ?? 0} questions`
        : 'Duration limit',
    ],
    ['Created', fmtDate(interview.createdAt)],
  ]
  builder.placeBlock(builder.keyValueBlock(facts))

  if (metrics) {
    builder.placeBlock(builder.spacerBlock(4))
    builder.placeBlock(builder.headingBlock('Session summary', 12))
    builder.placeBlock(
      builder.keyValueBlock([
        ['Overall score', `${metrics.overall}/100`],
        ['Session time', fmtDuration(metrics.activeSeconds)],
        ['Questions answered', String(metrics.questionScores.length)],
      ]),
    )
  }
}

function renderMetrics(builder: Builder, metrics: ReportMetrics) {
  builder.placeBlock(builder.headingBlock('Metrics', 14))
  builder.placeBlock(
    builder.keyValueBlock([
      ['Overall score', `${metrics.overall}/100`],
      ['Session time', fmtDuration(metrics.activeSeconds)],
      ['Questions', String(metrics.questionScores.length)],
    ]),
  )

  if (metrics.questionScores.length) {
    builder.placeBlock(builder.spacerBlock(2))
    builder.placeBlock(builder.headingBlock('Question-level scores', 12))
    builder.placeBlock(builder.barChartBlock(metrics.questionScores, 100))
  }

  if (metrics.topics.length) {
    builder.placeBlock(builder.spacerBlock(2))
    builder.placeBlock(builder.headingBlock('Interview mix', 12))
    builder.placeBlock(builder.barChartBlock(metrics.topics, 100))
  }

  if (metrics.timePerQuestion.length) {
    builder.placeBlock(builder.spacerBlock(2))
    builder.placeBlock(builder.headingBlock('Time per question (seconds)', 12))
    builder.placeBlock(
      builder.barChartBlock(metrics.timePerQuestion.map((value, i) => ({ label: `Q${i + 1}`, value }))),
    )
  }
}

function renderReport(builder: Builder, report: InterviewReport) {
  const categories = report.categoryScores ?? []
  const journey = report.difficultyProgression ?? []
  const strengths = report.strengths ?? []
  const weaknesses = report.weaknesses ?? []
  const recommendations = report.recommendations ?? []
  const questions = report.questions ?? []

  builder.placeBlock(builder.headingBlock('Interview report', 14))
  builder.placeBlock(
    builder.keyValueBlock([
      ['Overall score', `${report.overallScore}/100`],
      ['Questions analysed', String(questions.length)],
    ]),
  )

  if (report.summary) {
    builder.placeBlock(builder.spacerBlock(1.5))
    builder.placeBlock(builder.textBlock(report.summary))
  }

  if (categories.length) {
    builder.placeBlock(builder.spacerBlock(3))
    builder.placeBlock(builder.headingBlock('Category performance', 12))
    builder.placeBlock(builder.barChartBlock(categories, 100))
  }

  if (journey.length) {
    builder.placeBlock(builder.spacerBlock(3))
    builder.placeBlock(builder.headingBlock('Adaptive journey', 12))
    builder.placeBlock(
      builder.chipBlock(journey, (step) => {
        const value = step.toLowerCase()
        if (value.includes('follow-up')) return COLORS.vague
        if (value.includes('hard') || value.includes('raised')) return COLORS.weak
        if (value.includes('easy')) return COLORS.strong
        return COLORS.primary
      }),
    )
  }

  // Empty strengths/weaknesses/recommendations are common on short interviews —
  // render an explicit placeholder rather than a bare heading.
  builder.placeBlock(builder.spacerBlock(3))
  builder.placeBlock(
    builder.cardBlock(
      strengths.length
        ? [builder.listBlock(strengths, { bullet: '+', color: COLORS.strong })]
        : [builder.textBlock('No strengths were recorded for this interview.', { color: COLORS.muted })],
      { title: 'Strengths' },
    ),
  )
  builder.placeBlock(builder.spacerBlock(3))
  builder.placeBlock(
    builder.cardBlock(
      weaknesses.length
        ? [builder.listBlock(weaknesses, { bullet: '!', color: COLORS.vague })]
        : [builder.textBlock('No improvement areas were recorded for this interview.', { color: COLORS.muted })],
      { title: 'Areas to improve' },
    ),
  )
  // Only rendered when the API actually supplied resources. The section used to
  // print one line per weakness with identical boilerplate, which read as nine
  // copies of the same sentence; an empty "nothing recorded" card is dead weight
  // in a report, so the whole block is skipped instead.
  if (recommendations.length) {
    builder.placeBlock(builder.spacerBlock(3))
    builder.placeBlock(
      builder.cardBlock(
        recommendations.map((rec) => builder.textBlock(`${rec.gap} - ${rec.resource}`)),
        { title: 'Recommended resources' },
      ),
    )
  }

  builder.placeBlock(builder.spacerBlock(4))
  builder.placeBlock(builder.headingBlock(`Question-level analysis (${questions.length})`, 12))
  questions.forEach((question, index) => {
    builder.placeBlock(builder.spacerBlock(3))
    const parts: Block[] = [
      builder.textBlock(
        `Q${index + 1} · ${question.level} · ${question.evaluation.signal} · ${question.evaluation.score}/100`,
        { size: 8.5, bold: true, color: builder.scoreChipColor(question.evaluation.score) },
      ),
      builder.textBlock(question.question, { bold: true }),
      builder.textBlock(`Your answer: ${question.answer}`, { color: COLORS.muted }),
      builder.textBlock(`AI evaluation: ${question.evaluation.feedback}`),
    ]
    if (question.evaluation.strengths.length) {
      parts.push(
        builder.textBlock('Strengths', { size: 8.5, bold: true, color: COLORS.strong }),
        builder.listBlock(question.evaluation.strengths, { bullet: '+', size: 9 }),
      )
    }
    if (question.evaluation.weaknesses.length) {
      parts.push(
        builder.textBlock('Needs work', { size: 8.5, bold: true, color: COLORS.vague }),
        builder.listBlock(question.evaluation.weaknesses, { bullet: '!', size: 9 }),
      )
    }
    if (question.evaluation.improvedAnswer) {
      parts.push(
        builder.textBlock('Improved answer', { size: 8.5, bold: true, color: COLORS.strong }),
        builder.textBlock(question.evaluation.improvedAnswer),
      )
    }
    builder.placeBlock(builder.cardBlock(parts))
  })
}

function renderTimeline(builder: Builder, events: TimelineEvent[]) {
  builder.placeBlock(builder.headingBlock('History', 14))
  if (!events.length) {
    builder.placeBlock(builder.textBlock('No timeline events were recorded.', { color: COLORS.muted }))
    return
  }
  builder.placeBlock(
    builder.cardBlock(
      events.map((event) =>
        builder.textBlock(`${event.label} — ${event.detail} (${new Date(event.at).toLocaleString()})`, {
          size: 9,
        }),
      ),
    ),
  )
}

// ── Entry points ────────────────────────────────────────────────────────────

/** Export for the tab the user currently has open. */
export function downloadTabPdf(payload: ExportPayload): void {
  buildTabPdf(payload).save(`${safeFilename(title(payload.interview))}-${payload.tab}.pdf`)
}

/** Builds the current tab's document without saving it. */
export function buildTabPdf(payload: ExportPayload) {
  const { interview, tab, report, metrics, history } = payload
  const builder = createBuilder(`${title(interview)} — ${tab}`)

  if (tab === 'overview') {
    renderOverview(builder, interview, metrics)
  } else if (tab === 'report') {
    if (report) {
      renderReport(builder, report)
    } else {
      builder.placeBlock(
        builder.textBlock('The report data could not be loaded for this interview.', {
          color: COLORS.muted,
        }),
      )
    }
  } else if (tab === 'metrics') {
    if (metrics) renderMetrics(builder, metrics)
    else builder.placeBlock(builder.textBlock('Metrics are not available.', { color: COLORS.muted }))
  } else if (tab === 'timeline') {
    renderTimeline(builder, history ?? [])
  }

  return builder.document()
}

export interface FullReportInput {
  interview: Interview
  report: InterviewReport
  metrics: ReportMetrics | null
  history: TimelineEvent[]
}

/** Export the full report: Overview + Metrics + Report + History. */
export function downloadFullReportPdf(input: FullReportInput): void {
  buildFullReportPdf(input).save(
    `${safeFilename(title(input.interview))}-full-report.pdf`,
  )
}

/** Builds the full report document without saving it. */
export function buildFullReportPdf({ interview, report, metrics, history }: FullReportInput) {
  const builder = createBuilder(`${title(interview)} — full report`)

  // The overview tab's export carries its own session summary; in the full report
  // the Metrics section has the same three numbers plus the charts, so the summary
  // is suppressed here rather than printed twice on page 1.
  renderOverview(builder, interview, null)
  builder.placeBlock(builder.spacerBlock(6))

  if (metrics) {
    renderMetrics(builder, metrics)
    builder.placeBlock(builder.spacerBlock(6))
  }

  renderReport(builder, report)
  builder.placeBlock(builder.spacerBlock(6))

  renderTimeline(builder, history)

  return builder.document()
}
