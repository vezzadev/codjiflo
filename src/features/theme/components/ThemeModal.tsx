'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useThemeStore, Theme, DiffColorScheme } from '../stores/useThemeStore';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UI_THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'black', label: 'Black' },
  { value: 'highcontrast', label: 'High Contrast' },
];

const DIFF_SCHEMES: { value: DiffColorScheme; label: string; description?: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'protanopia', label: 'Protanopia', description: 'Red-green colorblind' },
  { value: 'deuteranopia', label: 'Deuteranopia', description: 'Red-green colorblind' },
  { value: 'tritanopia', label: 'Tritanopia', description: 'Blue-yellow colorblind' },
];

export function ThemeModal({ isOpen, onClose }: ThemeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { theme, diffColorScheme, setTheme, setDiffColorScheme } = useThemeStore();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

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
      aria-labelledby="theme-modal-title"
    >
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="modal-content theme-modal-content"
      >
        <h2 id="theme-modal-title" className="modal-title">
          Appearance Settings
        </h2>

        <div className="theme-modal-columns">
          {/* UI Theme Column */}
          <div className="theme-modal-section">
            <h3 className="theme-modal-section-title">UI Theme</h3>
            <div className="theme-modal-options">
              {UI_THEMES.map((option) => (
                <label key={option.value} className="theme-option">
                  <input
                    type="radio"
                    name="ui-theme"
                    value={option.value}
                    checked={theme === option.value}
                    onChange={() => setTheme(option.value)}
                  />
                  <span className="theme-option-label">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Diff Colors Column */}
          <div className="theme-modal-section">
            <h3 className="theme-modal-section-title">Diff Colors</h3>
            <div className="theme-modal-options">
              {DIFF_SCHEMES.map((option) => (
                <label key={option.value} className="theme-option">
                  <input
                    type="radio"
                    name="diff-scheme"
                    value={option.value}
                    checked={diffColorScheme === option.value}
                    onChange={() => setDiffColorScheme(option.value)}
                  />
                  <span className="theme-option-label">
                    {option.label}
                    {option.description && (
                      <span className="theme-option-description">
                        {option.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="theme-modal-preview">
          <div className="preview-window">
            <div className="preview-titlebar">
              <div className="preview-tabs">
                <span className="preview-tab preview-tab-active">file.ts</span>
                <span className="preview-tab">other.ts</span>
              </div>
            </div>
            <div className="preview-diff">
              <div className="preview-diff-line preview-diff-context">
                <span className="preview-gutter">&nbsp;</span>
                <span className="preview-code">function example() {'{'}</span>
              </div>
              <div className="preview-diff-line preview-diff-deletion">
                <span className="preview-gutter">-</span>
                <span className="preview-code">  return <span className="preview-word-del">oldValue</span>;</span>
              </div>
              <div className="preview-diff-line preview-diff-addition">
                <span className="preview-gutter">+</span>
                <span className="preview-code">  return <span className="preview-word-add">newValue</span>;</span>
              </div>
              <div className="preview-diff-line preview-diff-context">
                <span className="preview-gutter">&nbsp;</span>
                <span className="preview-code">{'}'}</span>
              </div>
            </div>
          </div>
          <div className="preview-swatches">
            <div className="preview-swatch preview-swatch-add" title="Addition color" />
            <div className="preview-swatch preview-swatch-delete" title="Deletion color" />
          </div>
        </div>

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
