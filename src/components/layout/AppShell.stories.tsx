import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from './AppShell';

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div style={{ padding: '20px', color: 'var(--text-color)' }}>
        <h1>Main Window Content</h1>
        <p>This is the content inside the AppShell window container.</p>
      </div>
    ),
  },
};

export const WithMultipleSections: Story = {
  args: {
    children: (
      <div style={{ display: 'flex', height: '100%' }}>
        <aside style={{ width: '200px', background: 'var(--bg-sidebar)', padding: '16px' }}>
          Sidebar
        </aside>
        <main style={{ flex: 1, padding: '16px' }}>
          Main Content Area
        </main>
      </div>
    ),
  },
};
