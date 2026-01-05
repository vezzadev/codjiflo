import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, Theme } from '@/features/theme';

// Mock component that mirrors Titlebar but without Next.js Image dependency
interface TitlebarProps {
  title?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'black', label: 'Black', icon: Monitor },
];

function TitlebarStory({ title = 'CodjiFlo', leftContent, rightContent }: TitlebarProps) {
  const { theme, setTheme } = useThemeStore();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as Theme);
  };

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <div className="logo">
          {/* Use regular img instead of Next.js Image for Storybook */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
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

const meta = {
  title: 'Layout/Titlebar',
  component: TitlebarStory,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TitlebarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'CodjiFlo',
  },
};

export const WithCustomTitle: Story = {
  args: {
    title: 'Pull Request #123 - Add new feature',
  },
};

export const WithLeftContent: Story = {
  args: {
    title: 'CodjiFlo',
    leftContent: (
      <nav style={{ display: 'flex', gap: '16px', marginLeft: '16px' }}>
        <a href="#" style={{ color: 'var(--text-color)' }}>Dashboard</a>
        <a href="#" style={{ color: 'var(--text-color)' }}>PRs</a>
        <a href="#" style={{ color: 'var(--text-color)' }}>Settings</a>
      </nav>
    ),
  },
};

export const WithRightContent: Story = {
  args: {
    title: 'CodjiFlo',
    rightContent: (
      <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
        <button className="btn btn-secondary" style={{ padding: '4px 8px' }}>
          Sign Out
        </button>
      </div>
    ),
  },
};

export const FullyCustomized: Story = {
  args: {
    title: 'pedropaulovc/codjiflo - PR #42',
    leftContent: (
      <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
        <button className="btn btn-secondary" style={{ padding: '4px 8px' }}>
          ← Back
        </button>
      </div>
    ),
    rightContent: (
      <div style={{ display: 'flex', gap: '8px', marginRight: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Logged in as: user
        </span>
        <button className="btn btn-primary" style={{ padding: '4px 8px' }}>
          Submit Review
        </button>
      </div>
    ),
  },
};
