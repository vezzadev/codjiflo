'use client';

import { RadioGroup, Radio } from 'react-aria-components';
import { useThemeStore, Theme, DiffColorScheme } from '../stores/useThemeStore';
import { Modal } from '@/components/ui';
import { Button } from '@/components/Button';

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
  value: 'regular' | 'high-contrast';
  selected: boolean;
}

function DiffPreview({ diffClassName, label, value, selected }: DiffPreviewProps) {
  return (
    <Radio
      value={value}
      className={`preview-panel ${diffClassName} ${selected ? 'preview-panel-selected' : ''}`}
    >
      <div className="preview-panel-header">
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
    </Radio>
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
              <RadioGroup
                className="theme-modal-options"
                aria-label="UI Theme"
                value={theme}
                onChange={(v) => { setTheme(v as Theme); }}
              >
                {UI_THEMES.map((option) => (
                  <Radio key={option.value} value={option.value} className="theme-option">
                    <span className="theme-option-label">{option.label}</span>
                  </Radio>
                ))}
              </RadioGroup>
            </div>

            <div className="theme-modal-section">
              <h3 className="theme-modal-section-title">Diff Colors</h3>
              <RadioGroup
                className="theme-modal-options"
                aria-label="Diff Colors"
                value={diffColorScheme}
                onChange={(v) => { setDiffColorScheme(v as DiffColorScheme); }}
              >
                {DIFF_SCHEMES.map((option) => (
                  <Radio key={option.value} value={option.value} className="theme-option">
                    <span className="theme-option-label">
                      {option.label}
                      {option.description && (
                        <span className="theme-option-description">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </Radio>
                ))}
              </RadioGroup>
            </div>
          </div>

          <h3 className="theme-modal-section-title theme-modal-preview-title">Contrast</h3>
          <RadioGroup
            className="theme-modal-previews"
            aria-label="Contrast"
            value={useHighContrastDiff ? 'high-contrast' : 'regular'}
            onChange={(v) => { setUseHighContrastDiff(v === 'high-contrast'); }}
          >
            <DiffPreview
              diffClassName={regularClassName}
              label="Regular"
              value="regular"
              selected={!useHighContrastDiff}
            />
            <DiffPreview
              diffClassName={hcClassName}
              label="High Contrast"
              value="high-contrast"
              selected={useHighContrastDiff}
            />
          </RadioGroup>

          <Button onPress={close} className="modal-close-btn">
            Close
          </Button>
        </>
      )}
    </Modal>
  );
}
