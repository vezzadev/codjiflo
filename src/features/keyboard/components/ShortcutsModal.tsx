import { useEffect, useRef, useCallback } from 'react';
import { getShortcutsList } from '../hooks';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying available keyboard shortcuts
 * S-1.5: AC-1.5.4, AC-1.5.5
 */
export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const shortcuts = getShortcutsList();

  // Close on Escape
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Focus trap and escape handling
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="modal-content"
      >
        <h2 id="shortcuts-title" className="modal-title">
          Keyboard Shortcuts
        </h2>

        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {shortcuts.map(({ key, description }) => (
              <tr key={key}>
                <td>
                  <kbd className="kbd">
                    {key}
                  </kbd>
                </td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={onClose}
          className="btn-colorful modal-close-btn"
        >
          Close
        </button>
      </div>
    </div>
  );
}
