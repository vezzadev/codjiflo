/**
 * Go to Line Modal Component
 *
 * Compact modal for navigating to a specific line number.
 * Positioned at top-right of diff area, not centered.
 */

import { useRef, useEffect, useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';

export interface GoToLineModalProps {
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when user wants to navigate to a line */
  onGoToLine: (line: number) => void;
  /** Maximum valid line number (total lines in document) */
  maxLine: number;
}

type ValidationState = 'idle' | 'invalid';

/**
 * Compact modal for "Go to Line" navigation.
 * Auto-focuses input on mount, closes on Escape/blur/Enter.
 */
export function GoToLineModal({ onClose, onGoToLine, maxLine }: GoToLineModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [validation, setValidation] = useState<ValidationState>('idle');
  const blurTimeoutRef = useRef<number | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    // Cleanup timeout on unmount
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      // Cancel any pending blur close
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      const lineNumber = parseInt(value, 10);

      // Validate: must be a positive integer
      if (isNaN(lineNumber) || lineNumber < 1) {
        setValidation('invalid');
        // Re-focus input after validation error
        inputRef.current?.focus();
        return;
      }

      // Clamp to valid range and navigate
      const clampedLine = Math.min(lineNumber, maxLine);
      onGoToLine(clampedLine);
      onClose();
    },
    [value, maxLine, onGoToLine, onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setValidation('idle');
  }, []);

  const handleBlur = useCallback(() => {
    // Small delay to allow submit to process first
    blurTimeoutRef.current = window.setTimeout(() => {
      blurTimeoutRef.current = null;
      onClose();
    }, 100);
  }, [onClose]);

  return (
    <div className="go-to-line-modal" role="dialog" aria-label="Go to line">
      <form onSubmit={handleSubmit} className="go-to-line-form">
        <label htmlFor="go-to-line-input" className="go-to-line-label">
          Go to line:
        </label>
        <input
          ref={inputRef}
          id="go-to-line-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={`textbox go-to-line-input${validation === 'invalid' ? ' go-to-line-input-error' : ''}`}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={`1-${maxLine}`}
          aria-invalid={validation === 'invalid'}
          aria-describedby={validation === 'invalid' ? 'go-to-line-error' : undefined}
          autoComplete="off"
        />
        {validation === 'invalid' && (
          <span id="go-to-line-error" className="go-to-line-error" role="alert">
            Enter a valid line number
          </span>
        )}
      </form>
    </div>
  );
}
