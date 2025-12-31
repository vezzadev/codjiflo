import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomPane } from './BottomPane';

const meta = {
  title: 'Layout/BottomPane',
  component: BottomPane,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BottomPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tabs: [
      {
        id: 'comments',
        label: 'Comments',
        content: <div style={{ padding: '16px' }}>Comments content goes here</div>,
      },
      {
        id: 'activity',
        label: 'Activity',
        content: <div style={{ padding: '16px' }}>Activity feed content</div>,
      },
      {
        id: 'search',
        label: 'Search Results',
        content: <div style={{ padding: '16px' }}>Search results appear here</div>,
      },
    ],
    defaultTab: 'comments',
  },
};

export const TwoTabs: Story = {
  args: {
    tabs: [
      {
        id: 'output',
        label: 'Output',
        content: <div style={{ padding: '16px', fontFamily: 'monospace' }}>Build succeeded...</div>,
      },
      {
        id: 'problems',
        label: 'Problems',
        content: <div style={{ padding: '16px', color: 'var(--syntax-error)' }}>No problems found</div>,
      },
    ],
  },
};

export const SingleTab: Story = {
  args: {
    tabs: [
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
          <div style={{ padding: '16px', fontFamily: 'monospace', background: 'var(--bg-terminal)' }}>
            $ npm run dev
          </div>
        ),
      },
    ],
  },
};

export const EmptyTabs: Story = {
  args: {
    tabs: [],
  },
};
