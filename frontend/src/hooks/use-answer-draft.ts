import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Draft persistence for an answer, keyed by question id.
 *
 * The live room can be paused (the duration ran out) or dropped by a reconnect, and
 * a half-written answer should survive that. Keying on the question id means the
 * draft follows the question, not the component instance — a re-render, a reconnect
 * or a remount restores exactly the draft belonging to the question on screen, and
 * the next question starts empty.
 *
 * Storage is best-effort: a browser in private mode, or one over quota, must not
 * break answering, so every access is guarded and failures degrade to in-memory state.
 */

const KEY_PREFIX = 'syntheview.answer-draft.'

function draftKey(questionId: string): string {
  return `${KEY_PREFIX}${questionId}`
}

function readDraft(questionId: string): string {
  try {
    return window.localStorage.getItem(draftKey(questionId)) ?? ''
  } catch {
    return ''
  }
}

function writeDraft(questionId: string, value: string): void {
  try {
    if (value) window.localStorage.setItem(draftKey(questionId), value)
    else window.localStorage.removeItem(draftKey(questionId))
  } catch {
    // Drafts are a convenience, never a requirement.
  }
}

export function useAnswerDraft(questionId: string | undefined) {
  const [value, setValue] = useState(() => (questionId ? readDraft(questionId) : ''))
  const currentIdRef = useRef(questionId)

  // A different question brings its own draft. The ref keeps this from re-reading
  // storage on every render of the same question.
  useEffect(() => {
    if (currentIdRef.current === questionId) return
    currentIdRef.current = questionId
    setValue(questionId ? readDraft(questionId) : '')
  }, [questionId])

  const change = useCallback(
    (next: string) => {
      setValue(next)
      if (questionId) writeDraft(questionId, next)
    },
    [questionId],
  )

  const clear = useCallback(() => {
    setValue('')
    if (questionId) writeDraft(questionId, '')
  }, [questionId])

  return { value, change, clear }
}
