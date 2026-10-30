// ── CodeMirror 6 editor ───────────────────────────────────────────────────────
// The rich editor for code answers. This module is the lazy chunk: it is only
// fetched when a code question actually renders in a browser that can host an
// editor, so the main bundle never carries CodeMirror for text-only interviews.
//
// The panel keeps a plain monospace textarea as the baseline and only swaps this in
// when `canHostRichEditor()` is true (see code-answer-panel.tsx). That is why this
// component can assume a real layout engine exists.

import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'

export interface CodeEditorProps {
  value: string
  language: string
  placeholder?: string
  ariaLabel?: string
  onChange: (value: string) => void
  /** Called for Ctrl/Cmd+Enter — the panel decides whether it may submit. */
  onSubmitShortcut: () => void
}

/** Two-space indentation, matching the panel's textarea behaviour. */
const INDENT = '  '

function languageExtension(language: string) {
  switch (language) {
    case 'typescript':
      return javascript({ typescript: true })
    case 'javascript':
      return javascript()
    case 'python':
      return python()
    default:
      // No grammar for this language: still editable, just unhighlighted.
      return []
  }
}

/**
 * Theme built from the app's design tokens, so light/dark follows the document
 * automatically — no separate dark stylesheet and no theme state to keep in sync.
 */
const appTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.6',
    overflow: 'auto',
  },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground)',
    border: 'none',
    paddingLeft: '6px',
  },
  '.cm-activeLine': { backgroundColor: 'rgb(from var(--foreground) r g b / 0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgb(from var(--primary) r g b / 0.25)',
  },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
})

export default function CodeEditor({
  value,
  language,
  placeholder,
  ariaLabel,
  onChange,
  onSubmitShortcut,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageCompartment = useRef(new Compartment())
  // Latest callbacks without rebuilding the editor: the view is created once, and a
  // stale closure here would submit the previous render's code.
  const callbacks = useRef({ onChange, onSubmitShortcut })

  // Synced after every render, never during one: the view is created once, and the
  // handlers it holds must be this render's, not the first render's.
  useEffect(() => {
    callbacks.current = { onChange, onSubmitShortcut }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          EditorState.tabSize.of(INDENT.length),
          indentUnit.of(INDENT),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          // Mod-Enter is bound here, ahead of defaultKeymap: the stock map also
          // binds it (insert blank line) and would otherwise swallow the submit.
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                callbacks.current.onSubmitShortcut()
                return true
              },
            },
            // indentWithTab keeps Tab for indentation; Escape then Tab still moves focus.
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          languageCompartment.current.of(languageExtension(language)),
          placeholderExtension(placeholder ?? ''),
          EditorView.contentAttributes.of({
            // Same id the panel's <label> points at, so the editor is labelled and
            // the counter is announced exactly as it is for the textarea.
            id: 'code-answer',
            'aria-label': ariaLabel ?? 'Code answer',
            'aria-describedby': 'code-answer-count',
            role: 'textbox',
            'aria-multiline': 'true',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString())
          }),
          appTheme,
        ],
      }),
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Created once: value/language changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External changes (draft restore, clear button, a clamped paste) replace the doc
  // only when they differ — writing the same text back would reset the cursor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: languageCompartment.current.reconfigure(languageExtension(language)),
    })
  }, [language])

  return <div ref={hostRef} className="h-full min-h-0" data-testid="code-editor" />
}
