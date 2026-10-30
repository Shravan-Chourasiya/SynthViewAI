import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CodeAnswerPanel,
  MAX_CODE_ANSWER_CHARS,
} from '@/components/interview-room/code-answer-panel';
import type { Question } from '@/lib/types';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-code-1',
    index: 0,
    kind: 'code',
    category: 'Technical',
    topic: 'linked-list',
    difficulty: 'Medium',
    prompt: 'Write a function that reverses a singly linked list.',
    starter: 'Return the new head.',
    ...overrides,
  };
}

function setup({
  question = {},
  props = {},
}: {
  question?: Partial<Question>;
  props?: Partial<React.ComponentProps<typeof CodeAnswerPanel>>;
} = {}) {
  const onSubmit = vi.fn();
  const utils = render(
    <CodeAnswerPanel
      question={makeQuestion(question)}
      index={1}
      total={5}
      busy={false}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, ...utils };
}

function input(): HTMLTextAreaElement {
  return screen.getByTestId('code-answer-input') as HTMLTextAreaElement;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('CodeAnswerPanel — rendering', () => {
  it('renders the question, a code editor and the language selector', () => {
    setup();

    expect(
      screen.getByText(/write a function that reverses a singly linked list\./i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('code-answer-panel')).toHaveAttribute('data-question-kind', 'code');
    expect(screen.getByLabelText(/your solution/i)).toBeInTheDocument();
    expect(input()).toBeInTheDocument();
    expect(screen.getByLabelText('Answer language')).toBeInTheDocument();
  });

  it('defaults the language to the backend suggestion', () => {
    setup({ question: { codeLanguage: 'python' } });
    expect(screen.getByLabelText('Answer language')).toHaveValue('python');
  });

  it('maps a suggested alias onto the selector value', () => {
    setup({ question: { codeLanguage: 'py' } });
    expect(screen.getByLabelText('Answer language')).toHaveValue('python');
  });

  it('falls back to javascript when no language was suggested', () => {
    setup();
    expect(screen.getByLabelText('Answer language')).toHaveValue('javascript');
  });

  it('offers a suggested language the selector does not know about', () => {
    setup({ question: { codeLanguage: 'haskell' } });
    const select = screen.getByLabelText('Answer language') as HTMLSelectElement;
    expect(select).toHaveValue('haskell');
    expect(Array.from(select.options).map((option) => option.value)).toContain('haskell');
  });
});

describe('CodeAnswerPanel — editing', () => {
  it('updates the character and line counters', () => {
    setup();
    fireEvent.change(input(), { target: { value: 'a\nb' } });

    // 'a\nb' is three characters across two lines.
    expect(
      screen.getByText(`3 / ${MAX_CODE_ANSWER_CHARS.toLocaleString('en-US')} characters · 2 lines`),
    ).toBeInTheDocument();
  });

  it('clamps input at the shared 20,000 character ceiling', () => {
    setup();
    fireEvent.change(input(), { target: { value: 'x'.repeat(MAX_CODE_ANSWER_CHARS + 25) } });

    expect(input().value).toHaveLength(MAX_CODE_ANSWER_CHARS);
    expect(screen.getByText(/limit reached/i)).toBeInTheDocument();
  });

  it('Tab inserts two spaces instead of moving focus', () => {
    setup();
    const editor = input();
    fireEvent.change(editor, { target: { value: 'ab' } });
    editor.setSelectionRange(1, 1);

    fireEvent.keyDown(editor, { key: 'Tab' });

    expect(editor.value).toBe('a  b');
  });
});

describe('CodeAnswerPanel — submitting', () => {
  it('submits on Ctrl+Enter with the code and the chosen language', () => {
    const { onSubmit } = setup({ question: { codeLanguage: 'python' } });
    fireEvent.change(input(), { target: { value: 'def reverse(head): ...' } });

    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true });

    expect(onSubmit).toHaveBeenCalledWith('def reverse(head): ...', 'python');
  });

  it('submits with the language selected in the dropdown', () => {
    const { onSubmit } = setup({ question: { codeLanguage: 'python' } });
    fireEvent.change(screen.getByLabelText('Answer language'), { target: { value: 'go' } });
    fireEvent.change(input(), { target: { value: 'func main() {}' } });

    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

    expect(onSubmit).toHaveBeenCalledWith('func main() {}', 'go');
  });

  it('does not submit blank code', () => {
    const { onSubmit } = setup();
    fireEvent.change(input(), { target: { value: '   \n  ' } });

    expect(screen.getByRole('button', { name: /submit answer/i })).toBeDisabled();
    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is inert while the assistant is busy', () => {
    const { onSubmit } = setup({ props: { busy: true } });

    const submit = screen.getByRole('button', { name: /sending…/i });
    expect(submit).toBeDisabled();
    expect(screen.getByLabelText('Answer language')).toBeDisabled();

    fireEvent.change(input(), { target: { value: 'const x = 1' } });
    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is inert while the room is paused on the end-of-duration prompt', () => {
    setup({ props: { paused: true } });

    expect(screen.getByRole('button', { name: /paused/i })).toBeDisabled();
    expect(screen.getByText(/paused — decide how to continue/i)).toBeInTheDocument();
  });
});

describe('CodeAnswerPanel — drafts', () => {
  it('restores a draft for the same question after a remount', () => {
    const first = setup({ question: { id: 'q-draft-1' } });
    fireEvent.change(input(), { target: { value: 'const answer = 42' } });
    first.unmount();

    setup({ question: { id: 'q-draft-1' } });
    expect(input()).toHaveValue('const answer = 42');
  });

  it('starts empty for a different question', () => {
    const first = setup({ question: { id: 'q-draft-1' } });
    fireEvent.change(input(), { target: { value: 'const answer = 42' } });
    first.unmount();

    setup({ question: { id: 'q-draft-2' } });
    expect(input()).toHaveValue('');
  });

  it('clears the draft when the answer is submitted', () => {
    const { onSubmit, unmount } = setup({ question: { id: 'q-draft-3' } });
    fireEvent.change(input(), { target: { value: 'print(1)' } });
    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalled();
    unmount();

    setup({ question: { id: 'q-draft-3' } });
    expect(input()).toHaveValue('');
  });

  it('the Clear button empties the editor and the stored draft', () => {
    setup({ question: { id: 'q-draft-4' } });
    fireEvent.change(input(), { target: { value: 'print(1)' } });

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    expect(input()).toHaveValue('');
    expect(window.localStorage.getItem('syntheview.answer-draft.q-draft-4')).toBeNull();
  });
});
