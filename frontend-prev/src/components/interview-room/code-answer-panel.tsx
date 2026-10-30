import { Suspense, lazy, useMemo, useState } from 'react'
import { ArrowRight, Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuestionMeta } from './question-panel'
import { useAnswerDraft } from '@/hooks/use-answer-draft'
import type { Question } from '@/lib/types'

/**
 * CodeMirror is a lazy chunk, fetched only when a code question renders in a browser
 * that can host it. Interviews without code questions never download it.
 */
const CodeEditor = lazy(() => import('./code-editor'))

/** Must match the backend's answer ceiling (answer-submission.ts). */
export const MAX_CODE_ANSWER_CHARS = 20_000

/** Two-space indentation for both the rich editor and the fallback. */
const INDENT = '  '

const LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c++',
  'c#',
  'go',
  'rust',
  'sql',
  'other',
] as const

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  py: 'python',
  cpp: 'c++',
  'c-sharp': 'c#',
  csharp: 'c#',
  golang: 'go',
}

/** Map the backend's suggested language onto a selector value. */
export function normaliseLanguage(raw?: string): string {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return 'javascript'
  return LANGUAGE_ALIASES[value] ?? value
}

/**
 * CodeMirror needs Range geometry to measure text; without it (jsdom, some embedded
 * or text-mode browsers) it breaks on mount. Those environments keep the plain
 * textarea, which is a complete editor in its own right.
 */
function canHostRichEditor(): boolean {
  if (typeof window === 'undefined' || typeof Range === 'undefined') return false
  return typeof Range.prototype.getClientRects === 'function'
}

export function CodeAnswerPanel({
  question,
  index,
  total,
  busy,
  paused = false,
  onSubmit,
}: {
  question: Question
  index: number
  /** `null` when the total number of questions isn't known yet. */
  total: number | null
  busy: boolean
  /** The room is paused on the end-of-duration prompt: readable, but accepts nothing. */
  paused?: boolean
  onSubmit: (code: string, language: string) => void
}) {
  const suggested = useMemo(() => normaliseLanguage(question.codeLanguage), [question.codeLanguage])
  const { value: code, change: setCode, clear: clearDraft } = useAnswerDraft(question.id)
  const [language, setLanguage] = useState(suggested)
  const [suggestionFor, setSuggestionFor] = useState(question.id)

  // A new question carries its own language suggestion. Adjusting state during
  // render (React's documented derived-state pattern) is one render instead of the
  // extra pass an effect would cost, and keeps the selector in sync immediately.
  if (suggestionFor !== question.id) {
    setSuggestionFor(question.id)
    setLanguage(suggested)
  }

  const overLimit = code.length >= MAX_CODE_ANSWER_CHARS
  const lines = code ? code.split('\n').length : 0

  /** Clamp in the client too: the server rejects > MAX with a 422. */
  const update = (next: string) => setCode(next.slice(0, MAX_CODE_ANSWER_CHARS))

  const submit = () => {
    if (!code.trim() || busy || paused) return
    onSubmit(code, language)
    // The answer is with the server now; a stale draft would reappear on the next
    // visit to this question id.
    clearDraft()
  }

  /** Ctrl/Cmd+Enter submits from either editor. */
  const shortcut = (event: KeyboardEvent): boolean => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
      return true
    }
    return false
  }

  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shortcut(event.nativeEvent)) return
    if (event.key !== 'Tab') return
    event.preventDefault()
    const el = event.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = `${code.slice(0, start)}${INDENT}${code.slice(end)}`.slice(0, MAX_CODE_ANSWER_CHARS)
    setCode(next)
    // Restore the caret after React re-renders the value.
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = Math.min(start + INDENT.length, next.length)
    })
  }

  const languages: string[] = (LANGUAGES as readonly string[]).includes(language)
    ? [...LANGUAGES]
    : [language, ...LANGUAGES]

  const editorProps = {
    value: code,
    language,
    placeholder: question.starter ?? 'Write your solution here…',
    ariaLabel: 'Code answer',
    onChange: update,
    onSubmitShortcut: submit,
  }

  const plainEditor = (
    <textarea
      id="code-answer"
      aria-label="Code answer"
      aria-describedby="code-answer-count"
      value={code}
      onChange={(event) => update(event.target.value)}
      onKeyDown={onTextareaKeyDown}
      placeholder={question.starter ?? 'Write your solution here…'}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      wrap="off"
      data-testid="code-answer-input"
      className="h-full min-h-44 w-full flex-1 resize-none overflow-auto rounded-xl border border-border bg-background/60 p-4 font-mono text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  )

  return (
    <div
      className="flex h-full flex-col rounded-xl bg-card/30 p-1"
      data-testid="code-answer-panel"
      data-question-kind="code"
    >
      <QuestionMeta question={question} index={index} total={total} />

      <div className="mt-5 flex items-start gap-2 max-w-3xl text-pretty">
        <h2 className="animate-reveal mt-5 max-w-3xl text-pretty text-xl font-medium leading-relaxed sm:text-2xl">
          {question.text}
        </h2>
      </div>

      <div className="animate-fade-in mt-5 flex flex-1 flex-col" style={{ animationDelay: '0.1s' }}>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="code-answer"
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            Your solution
          </label>
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Language
            <select
              aria-label="Answer language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              disabled={busy || paused}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] normal-case tracking-normal text-foreground disabled:opacity-50"
            >
              {languages.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex min-h-44 flex-1 flex-col overflow-hidden rounded-xl">
          {canHostRichEditor() ? (
            <Suspense fallback={plainEditor}>
              <CodeEditor {...editorProps} />
            </Suspense>
          ) : (
            plainEditor
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span
            id="code-answer-count"
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            aria-live="polite"
          >
            {paused
              ? 'Paused — decide how to continue'
              : `${code.length.toLocaleString('en-US')} / ${MAX_CODE_ANSWER_CHARS.toLocaleString('en-US')} characters · ${lines} line${lines === 1 ? '' : 's'}${
                  overLimit ? ' · limit reached' : ''
                }`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDraft}
              disabled={!code || busy || paused}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
            <Button size="sm" onClick={submit} disabled={!code.trim() || busy || paused}>
              {paused ? 'Paused' : busy ? 'Sending…' : 'Submit answer'}
              {!busy && !paused ? <ArrowRight className="size-3.5" /> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
