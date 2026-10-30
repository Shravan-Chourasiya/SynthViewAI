import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Link2,
  Printer,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge, SignalBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AnswerDisplay } from '@/components/interview-ui'
import { Skeleton } from '@/components/ui/skeleton'
import { ScoreChip, bandOf } from '@/components/stat-card'
import { ScoreOrb } from '@/components/score-orb'
import { SpotlightPanel } from '@/components/motion/tilt-card'
import { CategoryBarChart, DifficultyLineChart, SkillRadarChart } from '@/components/charts'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatDate } from '@/lib/format'
import type { Interview, InterviewReport } from '@/lib/types'
import { cn } from '@/lib/utils'

function ExportMenu({ shareToken }: { shareToken: string }) {
  const [busy, setBusy] = useState(false)

  async function downloadPdf() {
    setBusy(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const node = document.getElementById('report-root')
      if (!node) throw new Error('Report root missing')
      // Capture against the active theme's export background token (hex, so
      // html2canvas can parse it) instead of a fixed white: a dark-theme report
      // used to be rasterised onto a white canvas.
      const token = getComputedStyle(document.documentElement).getPropertyValue('--print-background').trim()
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: token || undefined })
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const width = pdf.internal.pageSize.getWidth()
      const height = (canvas.height * width) / canvas.width
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height)
      pdf.save('synthview-report.pdf')
      toast.success('Report exported')
    } catch {
      toast.error('Could not export the PDF in this browser')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/interviews/shared/${shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied')
    } catch {
      toast.error('Clipboard is blocked — copy the URL from the address bar')
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" data-print-hide>
          <FileText className="size-4" />
          Export
          <ChevronDown className="size-3.5" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {[
            { label: busy ? 'Preparing PDF…' : 'Download PDF', icon: Download, onClick: downloadPdf, disabled: busy },
            { label: 'Print report', icon: Printer, onClick: () => window.print(), disabled: false },
            { label: 'Copy share link', icon: Link2, onClick: copyLink, disabled: false },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={item.onClick}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:opacity-50"
            >
              <item.icon className="size-4 text-muted-foreground" />
              {item.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Skeleton className="size-32 rounded-full" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

export function ReportView({
  report,
  interview,
  variant = 'app',
  footer,
}: {
  report: InterviewReport
  interview?: Interview | null
  variant?: 'app' | 'shared'
  footer?: React.ReactNode
}) {
  const [openId, setOpenId] = useState<string | null>((report.questions ?? [])[0]?.id ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{(report.questions ?? []).length} questions</Badge>
          <SignalBadge band={report.band} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            generated {formatDate(report.generatedAt)}
          </span>
        </div>
        {variant === 'app' ? <ExportMenu shareToken={report.shareToken} /> : null}
      </div>

      <div id="report-root" className="space-y-6">
        {/* header */}
        <Panel data-print-section className="space-y-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <ScoreOrb score={report.overallScore} band={report.band} size={168} />
            <div className="min-w-0 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Overall report
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{report.headline}</h1>
              {interview ? (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {interview.code} · {interview.roleTitle} · {TYPE_LABEL[interview.type]} ·{' '}
                  {DIFFICULTY_LABEL[interview.difficulty]}
                </p>
              ) : null}
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
                {report.summary}
              </p>
            </div>
          </div>
        </Panel>

        {/* strengths / weaknesses / next */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Strengths', items: report.strengths, icon: ThumbsUp, tone: 'signal-strong' },
            { title: 'Weaknesses', items: report.weaknesses, icon: ThumbsDown, tone: 'signal-vague' },
            { title: 'Practise next', items: report.recommendations, icon: TrendingUp, tone: 'primary' },
          ].map((column) => (
            <SpotlightPanel key={column.title} className="space-y-3 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6" data-print-section>
              <h2
                className={cn(
                  'inline-flex items-center gap-2 text-sm font-semibold tracking-tight',
                  column.tone === 'signal-strong' && 'text-signal-strong',
                  column.tone === 'signal-vague' && 'text-signal-vague',
                  column.tone === 'primary' && 'text-primary',
                )}
              >
                <column.icon className="size-4" />
                {column.title}
              </h2>
              <ul className="space-y-2.5">
                {column.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-50" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </SpotlightPanel>
          ))}
        </div>

        {/* per-question strip */}
        <Panel flush data-print-section>
          <PanelHeader
            title="Score by question"
            description="Click a chip to expand the answer and feedback"
            aside={
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                avg{' '}
                {(report.questions ?? []).length
                  ? Math.round(
                      (report.questions ?? []).reduce((sum, q) => sum + (q.score ?? 0), 0) / (report.questions ?? []).length,
                    )
                  : '—'}
              </span>
            }
          />

          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-4">
            {(report.questions ?? []).map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => setOpenId(openId === question.id ? null : question.id)}
                aria-pressed={openId === question.id}
                className={cn(
                  'rounded-lg outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
                  openId === question.id ? 'ring-2 ring-primary/40' : 'hover:-translate-y-0.5',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">Q{question.index}</span>
                  <ScoreChip score={question.score} size="sm" showMax={false} />
                </span>
              </button>
            ))}
          </div>

          <ul className="divide-y divide-border">
            {(report.questions ?? []).map((question) => (
              <li key={question.id}>
                <details
                  open={openId === question.id}
                  onToggle={(event) => {
                    const el = event.currentTarget
                    if (el.open) setOpenId(question.id)
                  }}
                  className="group"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="font-mono text-[11px] text-muted-foreground">Q{question.index}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{question.prompt}</span>
                    <Badge variant="neutral">{question.topic}</Badge>
                    <ScoreChip score={question.score} />
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="space-y-4 border-t border-border bg-secondary/20 px-5 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {question.headline ? (
                        <SignalBadge band={question.band ?? bandOf(question.score)}>
                          {question.headline}
                        </SignalBadge>
                      ) : null}
                      <Badge variant="outline">{DIFFICULTY_LABEL[question.difficulty]}</Badge>
                      {question.decision ? (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                          {question.decision}
                        </span>
                      ) : null}
                    </div>

                    {question.answer ? (
                      <AnswerDisplay
                        answer={question.answer}
                        answerFormat={question.answerFormat}
                        codeLanguage={question.codeLanguage}
                      />
                    ) : null}

                    {question.feedback ? (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Feedback
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.feedback}</p>
                      </div>
                    ) : null}

                    {question.strengths.length || question.improvements.length ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {question.strengths.length ? (
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-signal-strong">
                              What worked
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {question.strengths.map((item) => (
                                <li key={item} className="flex gap-2 text-sm">
                                  <Check className="mt-0.5 size-3.5 shrink-0 text-signal-strong" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {question.improvements.length ? (
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-signal-vague">
                              What to change
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {question.improvements.map((item) => (
                                <li key={item} className="flex gap-2 text-sm">
                                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-signal-vague" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Panel>

        {/* charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel flush data-print-section>
            <PanelHeader title="Skill radar" />
            <div className="p-5">
              <SkillRadarChart data={report.skills} height={260} />
            </div>
          </Panel>

          <Panel flush data-print-section>
            <PanelHeader title="Difficulty progression" />
            <div className="p-5">
              <DifficultyLineChart
                data={report.progression.map((point) => ({ label: point.label, score: point.score }))}
                height={260}
              />
            </div>
          </Panel>

          <Panel flush data-print-section>
            <PanelHeader title="Score by topic" />
            <div className="p-5">
              <CategoryBarChart
                data={report.topics.map((topic) => ({ category: topic.topic, score: topic.score }))}
                height={260}
              />
            </div>
          </Panel>
        </div>

        {/* share footer */}
        <Panel data-print-section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Copy className="size-4 text-primary" />
            Shareable summary
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A read-only link to this report. Revocable at any time from settings.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-[11px]">
              /interviews/shared/{report.shareToken}
            </code>
            <Badge variant="neutral">read-only</Badge>
          </div>
        </Panel>

        {footer}
      </div>
    </div>
  )
}
