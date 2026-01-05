'use client';

import { ReactNode, useState } from 'react';
import Image from 'next/image';
import { ThemeModal } from '@/features/theme/components/ThemeModal';
import { Paintbrush } from 'lucide-react';

interface TitlebarProps {
  title?: string;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
}

/**
 * Header bar with logo, title, and navigation
 */
export function Titlebar({ title = 'CodjiFlo', leftContent, rightContent }: TitlebarProps) {
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

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
        {/* Theme Settings Button */}
        <button
          className="btn-nav"
          onClick={() => setIsThemeModalOpen(true)}
          title="Appearance Settings"
          aria-label="Appearance Settings"
        >
          <Paintbrush size={16} />
        </button>
      </div>

      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </header>
  );
}
