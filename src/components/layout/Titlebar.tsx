'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import { useThemeStore, Theme } from '@/features/theme';
import { Settings, Sun, Moon, Monitor } from 'lucide-react';

interface TitlebarProps {
  title?: string;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'black', label: 'Black', icon: Monitor },
  { value: 'highcontrast', label: 'High Contrast', icon: Settings },
];

/**
 * Header bar with logo, title, and navigation
 */
export function Titlebar({ title = 'CodjiFlo', leftContent, rightContent }: TitlebarProps) {
  const { theme, setTheme } = useThemeStore();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as Theme);
  };

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        {/* Logo */}
        <div className="logo">
          <Image
            src="/codjiflo.svg"
            alt="CodjiFlo"
            width={32}
            height={32}
          />
          <span className="logo-text">CodjiFlo</span>
        </div>
        {leftContent}
      </div>

      <div className="titlebar-center">
        <span className="window-title">{title}</span>
      </div>

      <div className="titlebar-right">
        {rightContent}
        {/* Theme Selector */}
        <select
          className="select"
          value={theme}
          onChange={handleThemeChange}
          title="Select Theme"
          style={{ minWidth: '120px' }}
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
