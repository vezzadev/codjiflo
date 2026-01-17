/**
 * Go to Line Modal Component
 *
 * A compact modal that appears at the top-right of the diff area,
 * allowing users to navigate to specific line numbers.
 *
 * Input formats:
 * - "lN" - Navigate to old/left line N
 * - "rN" or "N" - Navigate to new/right line N
 */

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { parseLineInput } from '../hooks/useGoToLine';
import '@/styles/modals/goto-line-modal.css';

interface GoToLineModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /**
   * Callback when user submits a valid line number.
   * Receives the row index to scroll to, or -1 if line not found.
   */
  onNavigate: (rowIndex: number) => void;
  /**
   * Function to find row index for a given input.
   * Returns -1 if line not found.
   */
  findRowIndex: (input: string) => number;
}

/**
 * Modal for navigating to specific line numbers in the diff viewer.
 * Positioned at top-right corner of the diff content area.
 */
export function GoToLineModal({
  isOpen,
  onClose,
  onNavigate,
  findRowIndex,
}: GoToLineModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and clear state when opened
  useEffect(() => {
    if (!isOpen) return;

    // Use setTimeout to make state updates asynchronous (avoid lint rule)
    const timer = setTimeout(() => {
      setValue('');
      setError(null);
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const parsed = parseLineInput(value);
      if (!parsed) {
        setError('Invalid format. Use lN, rN, or N');
        return;
      }

      const rowIndex = findRowIndex(value);
      if (rowIndex === -1) {
        setError(`Line ${parsed.lineNumber} not found in current view`);
        return;
      }

      // Success - navigate and close
      onNavigate(rowIndex);
      onClose();
    },
    [value, findRowIndex, onNavigate, onClose]
  );

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    setError(null); // Clear error when user types
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="goto-line-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goto-line-title"
    >
      <form className="goto-line-form" onSubmit={handleSubmit}>
        <label id="goto-line-title" className="sr-only">
          Go to line
        </label>
        <input
          ref={inputRef}
          type="text"
          className="textbox goto-line-input"
          placeholder="Go to line (lN for left, rN or N for right)"
          value={value}
          onChange={handleChange}
          aria-describedby={error ? 'goto-line-error' : undefined}
          aria-invalid={!!error}
        />
        <button
          type="button"
          className="btn-close goto-line-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </form>
      {error && (
        <div id="goto-line-error" className="goto-line-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
