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
  { value: 'github-protanopia', label: 'GitHub Protanopia & Deuteranopia', description: 'Red-green colorblind' },
  { value: 'github-tritanopia', label: 'GitHub Tritanopia', description: 'Blue-yellow colorblind' },
  { value: 'visual-studio', label: 'Visual Studio' },
  { value: 'codeflow-classic', label: 'CodeFlow Classic' },
  { value: 'codeflow-redgreen', label: 'CodeFlow Red/Green' },
];

// Color definitions for preview rendering (from github-diff-colors-effective.csv)
interface DiffColors {
  addLine: string;
  addWord: string;
  addWordFg: string;
  delLine: string;
  delWord: string;
  delWordFg: string;
}

const DIFF_COLORS: Record<string, DiffColors> = {
  // GitHub Default
  'github-light': { addLine: '#DAFBE1', addWord: '#ACEEBB', addWordFg: '#1F2328', delLine: '#FFEBE9', delWord: '#FFCECB', delWordFg: '#1F2328' },
  'github-dark': { addLine: 'rgba(63,185,80,0.1)', addWord: 'rgba(63,185,80,0.4)', addWordFg: '#F0F6FC', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)', delWordFg: '#F0F6FC' },
  'github-light-hc': { addLine: '#D2FEDB', addWord: '#055D20', addWordFg: '#FFFFFF', delLine: '#FFF0EE', delWord: '#A0111F', delWordFg: '#FFFFFF' },
  'github-dark-hc': { addLine: 'rgba(10,199,64,0.2)', addWord: '#006222', addWordFg: '#FFFFFF', delLine: 'rgba(255,128,128,0.2)', delWord: '#AD0116', delWordFg: '#FFFFFF' },
  // GitHub Protanopia
  'github-protanopia-light': { addLine: '#DDF4FF', addWord: 'rgba(84,174,255,0.4)', addWordFg: '#1F2328', delLine: '#FFF0EE', delWord: '#FFCECB', delWordFg: '#1F2328' },
  'github-protanopia-dark': { addLine: 'rgba(88,166,255,0.15)', addWord: 'rgba(88,166,255,0.4)', addWordFg: '#F0F6FC', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)', delWordFg: '#F0F6FC' },
  'github-protanopia-light-hc': { addLine: '#DFF7FF', addWord: '#0349B4', addWordFg: '#FFFFFF', delLine: '#FFF0EE', delWord: '#873800', delWordFg: '#FFFFFF' },
  'github-protanopia-dark-hc': { addLine: 'rgba(92,172,255,0.2)', addWord: '#194FB1', addWordFg: '#FFFFFF', delLine: 'rgba(255,128,128,0.2)', delWord: 'rgba(244,139,37,0.4)', delWordFg: '#FFFFFF' },
  // GitHub Tritanopia
  'github-tritanopia-light': { addLine: '#DAFBE1', addWord: '#ACEEBB', addWordFg: '#1F2328', delLine: '#FFF0EE', delWord: '#FFCECB', delWordFg: '#1F2328' },
  'github-tritanopia-dark': { addLine: 'rgba(56,139,253,0.15)', addWord: 'rgba(56,139,253,0.4)', addWordFg: '#F0F6FC', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)', delWordFg: '#F0F6FC' },
  'github-tritanopia-light-hc': { addLine: '#D2FEDB', addWord: '#055D20', addWordFg: '#FFFFFF', delLine: '#FFF0EE', delWord: '#873800', delWordFg: '#FFFFFF' },
  'github-tritanopia-dark-hc': { addLine: 'rgba(92,172,255,0.2)', addWord: '#194FB1', addWordFg: '#FFFFFF', delLine: 'rgba(255,128,128,0.2)', delWord: '#AD0116', delWordFg: '#FFFFFF' },
  // Visual Studio
  'visual-studio-light': { addLine: '#EBF1DD', addWord: '#D7E3BC', addWordFg: '#1F2328', delLine: '#FFCCCC', delWord: '#FF9999', delWordFg: '#1F2328' },
  'visual-studio-dark': { addLine: '#15352C', addWord: '#265E4D', addWordFg: '#F0F6FC', delLine: '#400000', delWord: '#4F0000', delWordFg: '#F0F6FC' },
  'visual-studio-black': { addLine: '#15352C', addWord: '#265E4D', addWordFg: '#F0F6FC', delLine: '#400000', delWord: '#4F0000', delWordFg: '#F0F6FC' },
  'visual-studio-light-hc': { addLine: '#D6F0D6', addWord: '#0A5F1C', addWordFg: '#FFFFFF', delLine: '#FFDADA', delWord: '#8B0000', delWordFg: '#FFFFFF' },
  'visual-studio-dark-hc': { addLine: '#0D4030', addWord: '#006840', addWordFg: '#FFFFFF', delLine: '#4D0000', delWord: '#8B0000', delWordFg: '#FFFFFF' },
  'visual-studio-black-hc': { addLine: '#0D4030', addWord: '#006840', addWordFg: '#FFFFFF', delLine: '#4D0000', delWord: '#8B0000', delWordFg: '#FFFFFF' },
  // CodeFlow Classic
  'codeflow-classic-light': { addLine: '#FFFFBB', addWord: '#FFFF80', addWordFg: '#1F2328', delLine: '#FFA8A8', delWord: '#FF7777', delWordFg: '#1F2328' },
  'codeflow-classic-dark': { addLine: '#404019', addWord: '#5D5D16', addWordFg: '#D1D7E0', delLine: '#561717', delWord: '#6D1414', delWordFg: '#D1D7E0' },
  'codeflow-classic-black': { addLine: '#404019', addWord: '#5D5D16', addWordFg: '#F0F6FC', delLine: '#561717', delWord: '#6D1414', delWordFg: '#F0F6FC' },
  'codeflow-classic-light-hc': { addLine: '#FFFF99', addWord: '#665500', addWordFg: '#FFFFFF', delLine: '#FF9999', delWord: '#990000', delWordFg: '#FFFFFF' },
  'codeflow-classic-dark-hc': { addLine: '#4D4D00', addWord: '#7A7A00', addWordFg: '#FFFFFF', delLine: '#660000', delWord: '#990000', delWordFg: '#FFFFFF' },
  'codeflow-classic-black-hc': { addLine: '#4D4D00', addWord: '#7A7A00', addWordFg: '#FFFFFF', delLine: '#660000', delWord: '#990000', delWordFg: '#FFFFFF' },
  // CodeFlow RedGreen
  'codeflow-redgreen-light': { addLine: '#A8FFA8', addWord: '#94E694', addWordFg: '#1F2328', delLine: '#FFBBBB', delWord: '#FFA8A8', delWordFg: '#1F2328' },
  'codeflow-redgreen-dark': { addLine: '#003300', addWord: '#004000', addWordFg: '#F0F6FC', delLine: '#4C0000', delWord: '#500000', delWordFg: '#F0F6FC' },
  'codeflow-redgreen-black': { addLine: '#002800', addWord: '#003200', addWordFg: '#F0F6FC', delLine: '#400000', delWord: '#440000', delWordFg: '#F0F6FC' },
  'codeflow-redgreen-light-hc': { addLine: '#90EE90', addWord: '#055D20', addWordFg: '#FFFFFF', delLine: '#FF9999', delWord: '#A0111F', delWordFg: '#FFFFFF' },
  'codeflow-redgreen-dark-hc': { addLine: '#004400', addWord: '#006600', addWordFg: '#FFFFFF', delLine: '#5C0000', delWord: '#800000', delWordFg: '#FFFFFF' },
  'codeflow-redgreen-black-hc': { addLine: '#004400', addWord: '#006600', addWordFg: '#FFFFFF', delLine: '#5C0000', delWord: '#800000', delWordFg: '#FFFFFF' },
};

// Background colors for preview panels
const PREVIEW_BACKGROUNDS: Record<Theme, string> = {
  light: '#F0F0F0',
  dark: '#313131',
  black: '#0F0F0F',
};

const DEFAULT_COLORS: DiffColors = { addLine: 'rgba(63,185,80,0.1)', addWord: 'rgba(63,185,80,0.4)', addWordFg: '#F0F6FC', delLine: 'rgba(248,81,73,0.1)', delWord: 'rgba(248,81,73,0.4)', delWordFg: '#F0F6FC' };

function getPreviewColors(scheme: DiffColorScheme, theme: Theme, highContrast: boolean): DiffColors {
  const hasBlackVariant = scheme.startsWith('codeflow-') || scheme.startsWith('visual-studio');
  const brightness = theme === 'black' ? (hasBlackVariant ? 'black' : 'dark') : theme;
  const hcSuffix = highContrast ? '-hc' : '';
  const key = `${scheme}-${brightness}${hcSuffix}`;
  return DIFF_COLORS[key] ?? DEFAULT_COLORS;
}

interface DiffPreviewProps {
  colors: DiffColors;
  background: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function DiffPreview({ colors, background, label, selected, onClick, disabled }: DiffPreviewProps) {
  return (
    <label
      className={`preview-panel ${selected ? 'preview-panel-selected' : ''} ${disabled ? 'preview-panel-disabled' : ''}`}
    >
      <div className="preview-panel-header">
        <input
          type="radio"
          name="contrast-mode"
          checked={selected}
          onChange={onClick}
          disabled={disabled}
        />
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
            <span className="preview-code">  return <span style={{ backgroundColor: colors.delWord, color: colors.delWordFg }}>oldValue</span>;</span>
          </div>
          <div className="preview-diff-line" style={{ backgroundColor: colors.addLine }}>
            <span className="preview-gutter">+</span>
            <span className="preview-code">  return <span style={{ backgroundColor: colors.addWord, color: colors.addWordFg }}>newValue</span>;</span>
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
    </label>
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
        <h3 className="theme-modal-section-title theme-modal-preview-title">Contrast</h3>
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
          />
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
