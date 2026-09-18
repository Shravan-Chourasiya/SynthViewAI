import { useRef, useState } from 'react'
import { ArrowRight, Eraser } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Question } from '@/lib/types'

export function QuestionPanel({
  question,
  index,
  total,
  busy,
  onSubmit,
}: {
  question: Question
  index: number
  /** `null` when the total number of questions isn't known yet. */
  total: number | null
  busy: boolean
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!text.trim() || busy) return
    onSubmit(text)
  }

  // Keyboard shortcuts: Ctrl+Enter submits, Escape clears. (FR-15.3)
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setText('')
      textareaRef.current?.focus()
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-card/30 p-1">
      {/* meta */}
      <div className="flex flex-wrap items-center gap-2">
        {question.isFollowUp ? (
          <Badge variant="vague" dot>
            Adaptive follow-up
          </Badge>
        ) : (
          <Badge variant="default" dot>
            AI-generated
          </Badge>
        )}
        <Badge variant="outline">
          Q{index}{total !== null ? ` of ${total}` : ' of …'}
        </Badge>
        <Badge variant="outline">{question.topic}</Badge>
        <Badge
          variant={
            question.difficulty === 'Hard'
              ? 'weak'
              : question.difficulty === 'Easy'
                ? 'strong'
                : 'vague'
          }
        >
          {question.difficulty}
        </Badge>
      </div>

      {/* question */}
      <h2 className="animate-reveal mt-5 max-w-3xl text-pretty text-xl font-medium leading-relaxed sm:text-2xl">
        {question.text}
      </h2>

      {/* answer form (FR-15) */}
      <div className="mt-5 flex flex-1 flex-col">
        <label
          htmlFor="answer"
          className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          Your answer
        </label>
        <Textarea
          ref={textareaRef}
          id="answer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Be specific — the interviewer adapts to what you say…"
          className="min-h-44 flex-1 resize-none rounded-xl bg-background/60 p-4 text-sm leading-relaxed"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {text.trim()
              ? `${text.trim().split(/\s+/).length} words`
              : 'Structured, specific answers score higher'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setText('')}
              disabled={!text || busy}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
            <Button size="sm" onClick={submit} disabled={!text.trim() || busy}>
              {busy ? 'Sending…' : 'Submit answer'}
              {!busy ? <ArrowRight className="size-3.5" /> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
