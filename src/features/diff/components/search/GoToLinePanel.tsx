/**
 * GoToLinePanel Component
 *
 * Floating panel for jumping to a specific line number in the diff view.
 */

import { useCallback, useEffect, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { X } from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import './search-go-to-panel.css';

export interface GoToLinePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Get the active editor view */
  getActiveEditor: () => EditorView | null;
}

/**
 * Floating panel for go to line functionality.
 */
export function GoToLinePanel({ isOpen, onClose, getActiveEditor }: GoToLinePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lineInputRef = useRef<string>('');

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const goToLine = useCallback(() => {
    const lineNumber = parseInt(lineInputRef.current, 10);
    if (isNaN(lineNumber) || lineNumber < 1) return;

    const view = getActiveEditor();
    if (!view) return;

    // Clamp to valid range
    const maxLine = view.state.doc.lines;
    const targetLine = Math.min(Math.max(1, lineNumber), maxLine);

    // Get the line's position
    const lineInfo = view.state.doc.line(targetLine);

    // Scroll to line and place cursor
    view.dispatch({
      selection: { anchor: lineInfo.from },
      scrollIntoView: true,
    });

    view.focus();
    onClose();
  }, [getActiveEditor, onClose]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        goToLine();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    },
    [goToLine, onClose]
  );

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    lineInputRef.current = event.target.value;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="diff-goto-panel" role="dialog" aria-label="Go to line">
      <label className="diff-goto-label" htmlFor="goto-line-input">
        Go to Line:
      </label>
      <input
        ref={inputRef}
        id="goto-line-input"
        type="text"
        className="textbox diff-goto-input"
        placeholder="Line number"
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        inputMode="numeric"
        pattern="[0-9]*"
      />
      <button
        type="button"
        className="btn diff-goto-go-btn"
        onClick={goToLine}
        aria-label="Go to line"
      >
        Go
      </button>
      <button
        type="button"
        className="btn diff-panel-close-btn"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
}
