import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnswerDisplay } from '@/components/interview-ui';

/**
 * The report page and the public share view render answers through this one
 * component, so a code answer has to look like code in both — whitespace
 * intact, labelled with its language, and carrying the note that nothing was
 * executed. Prose must keep the plain paragraph it always had.
 */

const CODE = [
  'function reverse(list) {',
  '  let previous = null;',
  '  while (list) {',
  '    // swap the pointers',
  '    list = list.next;',
  '  }',
  '  return previous;',
  '}',
].join('\n');

describe('AnswerDisplay — prose', () => {
  it('renders a text answer as a plain paragraph', () => {
    render(<AnswerDisplay answer="I would profile first, then optimise." />);

    expect(
      screen.getByText('I would profile first, then optimise.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('answer-code')).toBeNull();
    expect(screen.queryByText(/not executed/i)).toBeNull();
  });

  it('treats a payload without answerFormat as prose', () => {
    // Answers written before the column existed must not lose their layout.
    render(<AnswerDisplay answer="Legacy answer" answerFormat={null} />);

    expect(screen.queryByTestId('answer-code')).toBeNull();
    expect(screen.getByText('Legacy answer')).toBeInTheDocument();
  });

  it('keeps the box heading the page asked for', () => {
    render(<AnswerDisplay answer="A" label="Answer" />);
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });
});

describe('AnswerDisplay — code', () => {
  it('renders the code in a pre block with its whitespace preserved', () => {
    render(<AnswerDisplay answer={CODE} answerFormat="CODE" codeLanguage="javascript" />);

    const pre = screen.getByTestId('answer-code');
    expect(pre.tagName).toBe('PRE');
    // Exact text — toHaveTextContent normalises whitespace, which is the very
    // thing this component must not do.
    expect(pre.textContent).toBe(CODE);
    expect(pre.textContent).toContain('\n    // swap the pointers');
  });

  it('labels the block with the recorded language', () => {
    render(<AnswerDisplay answer="x = 1" answerFormat="CODE" codeLanguage="python" />);

    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByText('Your answer')).toBeInTheDocument();
  });

  it('falls back to a generic label when no language was recorded', () => {
    render(<AnswerDisplay answer="x = 1" answerFormat="CODE" codeLanguage={null} />);

    expect(screen.getByText('code')).toBeInTheDocument();
  });

  it('states that the code was reviewed, not executed', () => {
    render(<AnswerDisplay answer="x = 1" answerFormat="CODE" />);

    expect(
      screen.getByText('Code was reviewed, not executed'),
    ).toBeInTheDocument();
  });
});
