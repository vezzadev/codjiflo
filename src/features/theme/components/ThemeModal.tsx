'use client';

import { useThemeStore, Theme, DiffColorScheme } from '../stores/useThemeStore';
import { Modal } from '@/components/ui';

interface ThemeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const UI_THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'black', label: 'Black' },
  { value: 'high-contrast', label: 'High Contrast' },
];

const DIFF_SCHEMES: { value: DiffColorScheme; label: string; description?: string }[] = [
  { value: 'github', label: 'GitHub Default' },
  { value: 'github-protanopia', label: 'GitHub Protanopia & Deuteranopia', description: 'Red-green colorblind' },
  { value: 'github-tritanopia', label: 'GitHub Tritanopia', description: 'Blue-yellow colorblind' },
  { value: 'visual-studio', label: 'Visual Studio' },
  { value: 'codeflow-classic', label: 'CodeFlow Classic' },
  { value: 'codeflow-redgreen', label: 'CodeFlow Red/Green' },
];

function getDiffClassName(theme: Theme, scheme: DiffColorScheme, useHighContrast: boolean): string {
  const themeSuffix = theme === 'high-contrast' ? 'dark' : theme;
  const hcSuffix = useHighContrast ? '-hc' : '';
  return `diff-${scheme}-${themeSuffix}${hcSuffix}`;
}

interface DiffPreviewProps {
  diffClassName: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

function DiffPreview({ diffClassName, label, selected, onSelect }: DiffPreviewProps) {
  return (
    <label
      className={`preview-panel ${diffClassName} ${selected ? 'preview-panel-selected' : ''}`}
    >
      <div className="preview-panel-header">
        <input
          type="radio"
          name="contrast-mode"
          checked={selected}
          onChange={onSelect}
        />
        <span className="preview-panel-label">{label}</span>
      </div>
      <div className="preview-window">
        <div className="preview-diff">
          <div className="preview-diff-line preview-context">
            <span className="preview-gutter">&nbsp;</span>
            <span className="preview-code">{'function example() {'}</span>
          </div>
          <div className="preview-diff-line preview-deletion">
            <span className="preview-gutter">-</span>
            <span className="preview-code">  return <span className="preview-word-removed">oldValue</span>;</span>
          </div>
          <div className="preview-diff-line preview-addition">
            <span className="preview-gutter">+</span>
            <span className="preview-code">  return <span className="preview-word-added">newValue</span>;</span>
          </div>
          <div className="preview-diff-line preview-context">
            <span className="preview-gutter">&nbsp;</span>
            <span className="preview-code">{'}'}</span>
          </div>
        </div>
      </div>
      <div className="preview-swatches">
        <div className="preview-swatch preview-swatch-add" title="Addition" />
        <div className="preview-swatch preview-swatch-del" title="Deletion" />
      </div>
    </label>
  );
}

export function ThemeModal({ isOpen, onOpenChange }: ThemeModalProps) {
  const { theme, diffColorScheme, useHighContrastDiff, setTheme, setDiffColorScheme, setUseHighContrastDiff } = useThemeStore();

  const regularClassName = getDiffClassName(theme, diffColorScheme, false);
  const hcClassName = getDiffClassName(theme, diffColorScheme, true);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Appearance Settings"
      className="theme-modal-content"
    >
      {({ close }) => (
        <>
          <div className="theme-modal-columns">
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

          <h3 className="theme-modal-section-title theme-modal-preview-title">Contrast</h3>
          <div className="theme-modal-previews">
            <DiffPreview
              diffClassName={regularClassName}
              label="Regular"
              selected={!useHighContrastDiff}
              onSelect={() => setUseHighContrastDiff(false)}
            />
            <DiffPreview
              diffClassName={hcClassName}
              label="High Contrast"
              selected={useHighContrastDiff}
              onSelect={() => setUseHighContrastDiff(true)}
            />
          </div>

          <button
            type="button"
            onClick={close}
            className="btn-colorful modal-close-btn"
          >
            Close
          </button>
        </>
      )}
    </Modal>
  );
}
