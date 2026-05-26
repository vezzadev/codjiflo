import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Select, SelectValue, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { useThemeStore, Theme } from '@/features/theme';
import { Button } from '@/components/Button';

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
        <Select
          aria-label="Select Theme"
          value={theme}
          onChange={(key) => { setTheme(key as Theme); }}
          style={{ minWidth: '120px' }}
        >
          <Button variant="secondary" className="select">
            <SelectValue />
          </Button>
          <Popover>
            <ListBox>
              {THEME_OPTIONS.map((option) => (
                <ListBoxItem key={option.value} id={option.value}>
                  {option.label}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
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
        <Button variant="secondary" style={{ padding: '4px 8px' }}>
          Sign Out
        </Button>
      </div>
    ),
  },
};

export const FullyCustomized: Story = {
  args: {
    title: 'pedropaulovc/codjiflo - PR #42',
    leftContent: (
      <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
        <Button variant="secondary" style={{ padding: '4px 8px' }}>
          ← Back
        </Button>
      </div>
    ),
    rightContent: (
      <div style={{ display: 'flex', gap: '8px', marginRight: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Logged in as: user
        </span>
        <Button variant="primary" style={{ padding: '4px 8px' }}>
          Submit Review
        </Button>
      </div>
    ),
  },
};
