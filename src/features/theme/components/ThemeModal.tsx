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
];

const DIFF_SCHEMES: { value: DiffColorScheme; label: string; description?: string }[] = [
  { value: 'github', label: 'GitHub Default' },
  { value: 'github-protanopia', label: 'GitHub Protanopia', description: 'Red-green colorblind' },
  { value: 'github-tritanopia', label: 'GitHub Tritanopia', description: 'Blue-yellow colorblind' },
  { value: 'codeflow-vs', label: 'CodeFlow VS' },
  { value: 'codeflow-classic', label: 'CodeFlow Classic' },
  { value: 'codeflow-redgreen', label: 'CodeFlow Red/Green' },
];

// Color definitions for preview rendering (from github-diff-colors-effective.csv)
const DIFF_COLORS: Record<string, { addLine: string; addWord: string; delLine: string; delWord: string }> = {
  // GitHub Default
  'github-light': { addLine: '#DAFBE1', addWord: '#ACEEBB', delLine: '#FFEBE9', delWord: '#FFCECB' },
  'github-dark': { addLine: 'rgba(63,185,80,0.1)', addWord: 'rgba(63,185,80,0.4)', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)' },
  'github-light-hc': { addLine: '#D2FEDB', addWord: '#055D20', delLine: '#FFF0EE', delWord: '#A0111F' },
  'github-dark-hc': { addLine: 'rgba(10,199,64,0.2)', addWord: '#006222', delLine: 'rgba(255,128,128,0.2)', delWord: '#AD0116' },
  // GitHub Protanopia
  'github-protanopia-light': { addLine: '#DDF4FF', addWord: 'rgba(84,174,255,0.4)', delLine: '#FFF0EE', delWord: '#FFCECB' },
  'github-protanopia-dark': { addLine: 'rgba(88,166,255,0.15)', addWord: 'rgba(88,166,255,0.4)', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)' },
  'github-protanopia-light-hc': { addLine: '#DFF7FF', addWord: '#0349B4', delLine: '#FFF0EE', delWord: '#873800' },
  'github-protanopia-dark-hc': { addLine: 'rgba(92,172,255,0.2)', addWord: '#194FB1', delLine: 'rgba(255,128,128,0.2)', delWord: 'rgba(244,139,37,0.4)' },
  // GitHub Tritanopia
  'github-tritanopia-light': { addLine: '#DAFBE1', addWord: '#ACEEBB', delLine: '#FFF0EE', delWord: '#FFCECB' },
  'github-tritanopia-dark': { addLine: 'rgba(56,139,253,0.15)', addWord: 'rgba(56,139,253,0.4)', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)' },
  'github-tritanopia-light-hc': { addLine: '#D2FEDB', addWord: '#055D20', delLine: '#FFF0EE', delWord: '#873800' },
  'github-tritanopia-dark-hc': { addLine: 'rgba(92,172,255,0.2)', addWord: '#194FB1', delLine: 'rgba(255,128,128,0.2)', delWord: '#AD0116' },
  // CodeFlow VS
  'codeflow-vs-light': { addLine: '#EBF1DD', addWord: '#D7E3BC', delLine: '#FFCCCC', delWord: '#FF9999' },
  'codeflow-vs-dark': { addLine: '#15352C', addWord: '#265E4D', delLine: '#400000', delWord: '#4F0000' },
  'codeflow-vs-black': { addLine: '#15352C', addWord: '#265E4D', delLine: '#400000', delWord: '#4F0000' },
  // CodeFlow Classic
  'codeflow-classic-light': { addLine: '#FFFFBB', addWord: '#FFFF80', delLine: '#FFA8A8', delWord: '#FF7777' },
  'codeflow-classic-dark': { addLine: '#404019', addWord: '#5D5D16', delLine: '#561717', delWord: '#6D1414' },
  'codeflow-classic-black': { addLine: '#404019', addWord: '#5D5D16', delLine: '#561717', delWord: '#6D1414' },
  // CodeFlow RedGreen
  'codeflow-redgreen-light': { addLine: '#A8FFA8', addWord: '#94E694', delLine: '#FFBBBB', delWord: '#FFA8A8' },
  'codeflow-redgreen-dark': { addLine: '#003300', addWord: '#004000', delLine: '#4C0000', delWord: '#500000' },
  'codeflow-redgreen-black': { addLine: '#003300', addWord: '#004000', delLine: '#4C0000', delWord: '#500000' },
};

// Background colors for preview panels
const PREVIEW_BACKGROUNDS: Record<Theme, string> = {
  light: '#F0F0F0',
  dark: '#313131',
  black: '#0F0F0F',
};

const DEFAULT_COLORS = { addLine: 'rgba(63,185,80,0.1)', addWord: 'rgba(63,185,80,0.4)', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)' };

function getPreviewColors(scheme: DiffColorScheme, theme: Theme, highContrast: boolean): { addLine: string; addWord: string; delLine: string; delWord: string } {
  const isCodeFlow = scheme.startsWith('codeflow-');
  const brightness = theme === 'black' ? (isCodeFlow ? 'black' : 'dark') : theme;
  const hcSuffix = !isCodeFlow && highContrast ? '-hc' : '';
  const key = `${scheme}-${brightness}${hcSuffix}`;
  return DIFF_COLORS[key] ?? DEFAULT_COLORS;
}

interface DiffPreviewProps {
  colors: { addLine: string; addWord: string; delLine: string; delWord: string };
  background: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function DiffPreview({ colors, background, label, selected, onClick, disabled }: DiffPreviewProps) {
  return (
    <button
      type="button"
      className={`preview-panel ${selected ? 'preview-panel-selected' : ''} ${disabled ? 'preview-panel-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <div className="preview-panel-header">
        <span className="preview-panel-radio">{selected ? '●' : '○'}</span>
        <span className="preview-panel-label">{label}</span>
      </div>
      <div className="preview-window" style={{ backgroundColor: background }}>
        <div className="preview-diff">
          <div className="preview-diff-line" style={{ backgroundColor: 'transparent' }}>
            <span className="preview-gutter">&nbsp;</span>
            <span className="preview-code">{'function example() {'}</span>
          </div>
          <div className="preview-diff-line" style={{ backgroundColor: colors.delLine }}>
            <span className="preview-gutter">-</span>
            <span className="preview-code">  return <span style={{ backgroundColor: colors.delWord }}>oldValue</span>;</span>
          </div>
          <div className="preview-diff-line" style={{ backgroundColor: colors.addLine }}>
            <span className="preview-gutter">+</span>
            <span className="preview-code">  return <span style={{ backgroundColor: colors.addWord }}>newValue</span>;</span>
          </div>
          <div className="preview-diff-line" style={{ backgroundColor: 'transparent' }}>
            <span className="preview-gutter">&nbsp;</span>
            <span className="preview-code">{'}'}</span>
          </div>
        </div>
      </div>
      <div className="preview-swatches">
        <div className="preview-swatch" style={{ backgroundColor: colors.addWord }} title="Addition" />
        <div className="preview-swatch" style={{ backgroundColor: colors.delWord }} title="Deletion" />
      </div>
    </button>
  );
}

export function ThemeModal({ isOpen, onClose }: ThemeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { theme, diffColorScheme, useHighContrastDiff, setTheme, setDiffColorScheme, setUseHighContrastDiff } = useThemeStore();

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

  const isCodeFlow = diffColorScheme.startsWith('codeflow-');
  const regularColors = getPreviewColors(diffColorScheme, theme, false);
  const hcColors = getPreviewColors(diffColorScheme, theme, true);
  const previewBg = PREVIEW_BACKGROUNDS[theme];

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

        {/* Preview Section - Two panels */}
        <div className="theme-modal-previews">
          <DiffPreview
            colors={regularColors}
            background={previewBg}
            label="Regular"
            selected={!useHighContrastDiff}
            onClick={() => setUseHighContrastDiff(false)}
          />
          <DiffPreview
            colors={hcColors}
            background={previewBg}
            label="High Contrast"
            selected={useHighContrastDiff}
            onClick={() => setUseHighContrastDiff(true)}
            disabled={isCodeFlow}
          />
        </div>
        {isCodeFlow && (
          <p className="theme-modal-note">
            CodeFlow themes do not have high contrast variants.
          </p>
        )}

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
