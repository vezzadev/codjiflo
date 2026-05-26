/**
 * GoToLinePanel Component
 *
 * Floating panel for jumping to a specific line number in the diff view.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { TextField, Label, Input, FieldError } from '@/components/ui';
import { Button } from '@/components/Button';
import './search-go-to-panel.css';

export interface GoToLinePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Get the active editor view */
  getActiveEditor: () => EditorView | null;
}

interface GoToLinePanelInnerProps {
  onClose: () => void;
  getActiveEditor: () => EditorView | null;
}

function GoToLinePanelInner({ onClose, getActiveEditor }: GoToLinePanelInnerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lineValue, setLineValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const goToLine = useCallback(() => {
    const view = getActiveEditor();
    if (!view) return;

    const trimmed = lineValue.trim();
    if (!trimmed) {
      setError('Enter a line number');
      return;
    }

    const lineNumber = Number(trimmed);
    if (!Number.isInteger(lineNumber) || lineNumber < 1) {
      setError('Enter a positive integer');
      return;
    }

    const maxLine = view.state.doc.lines;
    if (lineNumber > maxLine) {
      setError(`File only has ${maxLine} lines`);
      return;
    }

    const lineInfo = view.state.doc.line(lineNumber);

    view.dispatch({
      selection: { anchor: lineInfo.from },
      scrollIntoView: true,
    });

    view.focus();
    onClose();
  }, [getActiveEditor, lineValue, onClose]);

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

  const handleChange = useCallback((value: string) => {
    setLineValue(value);
    if (error) setError(null);
  }, [error]);

  return (
    <div className="diff-goto-panel" role="dialog" aria-label="Go to line">
      <TextField
        value={lineValue}
        onChange={handleChange}
        isInvalid={!!error}
        className="diff-goto-field"
      >
        <Label className="diff-goto-label">Go to Line:</Label>
        <Input
          ref={inputRef}
          className="textbox diff-goto-input"
          placeholder="Line number"
          onKeyDown={handleKeyDown}
          autoComplete="off"
          inputMode="numeric"
          pattern="[0-9]*"
        />
        {error && <FieldError>{error}</FieldError>}
      </TextField>
      <Button
        size="sm"
        variant="secondary"
        onPress={goToLine}
        aria-label="Go to line"
        title="Go to line (Enter)"
        className="diff-goto-go-btn"
      >
        Go
      </Button>
      <Button
        size="icon"
        variant="secondary"
        onPress={onClose}
        aria-label="Close"
        title="Close (Escape)"
        className="diff-panel-close-btn"
      >
        <X size={14} />
      </Button>
    </div>
  );
}

/**
 * Floating panel for go to line functionality.
 * The Inner is keyed so each open is a fresh mount — no setState-in-effect needed.
 */
export function GoToLinePanel({ isOpen, onClose, getActiveEditor }: GoToLinePanelProps) {
  if (!isOpen) return null;
  return <GoToLinePanelInner onClose={onClose} getActiveEditor={getActiveEditor} />;
}
