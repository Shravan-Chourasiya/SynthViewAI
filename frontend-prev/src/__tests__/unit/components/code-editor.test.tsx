/**
 * code-editor.test.tsx — the rich editor's own contract
 *
 * CodeMirror needs Range geometry, which jsdom does not implement; the panel's
 * capability check therefore keeps the textarea in the other tests. Here the missing
 * API is stubbed so the lazy editor itself is exercised: it mounts, follows external
 * value changes and forwards the submit shortcut.
 */

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import CodeEditor from '@/components/interview-room/code-editor';

const originalGetClientRects = Range.prototype.getClientRects;

beforeEach(() => {
  // @ts-expect-error — jsdom omits this API; CodeMirror only needs it to measure.
  Range.prototype.getClientRects = () => [];
});

afterAll(() => {
  Range.prototype.getClientRects = originalGetClientRects;
});

function renderEditor(overrides: Partial<React.ComponentProps<typeof CodeEditor>> = {}) {
  const onChange = vi.fn();
  const onSubmitShortcut = vi.fn();
  const utils = render(
    <CodeEditor
      value="const x = 1"
      language="javascript"
      onChange={onChange}
      onSubmitShortcut={onSubmitShortcut}
      {...overrides}
    />,
  );
  const content = utils.container.querySelector('.cm-content') as HTMLElement;
  return { onChange, onSubmitShortcut, content, ...utils };
}

describe('CodeEditor', () => {
  it('mounts CodeMirror with the initial value', () => {
    const { container, content } = renderEditor();

    expect(container.querySelector('.cm-editor')).toBeTruthy();
    expect(content.textContent).toContain('const x = 1');
  });

  it('applies an external value change without remounting', () => {
    const { content, rerender } = renderEditor();

    rerender(
      <CodeEditor
        value="print(1)"
        language="python"
        onChange={vi.fn()}
        onSubmitShortcut={vi.fn()}
      />,
    );

    expect(content.textContent).toContain('print(1)');
    expect(content.textContent).not.toContain('const x = 1');
  });

  it('calls the submit shortcut for Ctrl+Enter', () => {
    const { content, onSubmitShortcut } = renderEditor();

    fireEvent.keyDown(content, { key: 'Enter', ctrlKey: true });

    // The stock keymap also binds Mod-Enter, so this asserts our binding wins.
    expect(onSubmitShortcut).toHaveBeenCalledTimes(1);
  });

  it('leaves ordinary keys to the editor', () => {
    const { content, onSubmitShortcut } = renderEditor();

    fireEvent.keyDown(content, { key: 'a' });
    fireEvent.keyDown(content, { key: 'Enter' });

    expect(onSubmitShortcut).not.toHaveBeenCalled();
  });
});
