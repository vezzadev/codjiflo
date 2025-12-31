import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ResizeHandle } from './ResizeHandle';

const meta = {
  title: 'Layout/ResizeHandle',
  component: ResizeHandle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof ResizeHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: {
    direction: 'horizontal',
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', alignItems: 'center', height: '200px' }}>
        <div style={{ width: '150px', background: 'var(--bg-sidebar)', padding: '16px' }}>
          Left Panel
        </div>
        <Story />
        <div style={{ width: '150px', background: 'var(--bg-main)', padding: '16px' }}>
          Right Panel
        </div>
      </div>
    ),
  ],
};

export const Vertical: Story = {
  args: {
    direction: 'vertical',
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', flexDirection: 'column', width: '300px' }}>
        <div style={{ height: '100px', background: 'var(--bg-main)', padding: '16px' }}>
          Top Panel
        </div>
        <Story />
        <div style={{ height: '100px', background: 'var(--bg-sidebar)', padding: '16px' }}>
          Bottom Panel
        </div>
      </div>
    ),
  ],
};

function InteractiveDemo() {
  const [leftWidth, setLeftWidth] = useState(200);

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: '300px', width: '500px' }}>
      <div
        style={{
          width: `${String(leftWidth)}px`,
          minWidth: '100px',
          maxWidth: '400px',
          background: 'var(--bg-sidebar)',
          padding: '16px',
        }}
      >
        Left Panel (drag to resize)
        <br />
        <small>Width: {String(leftWidth)}px</small>
      </div>
      <ResizeHandle
        direction="horizontal"
        onResize={(delta) => setLeftWidth((w) => Math.min(400, Math.max(100, w + delta)))}
      />
      <div style={{ flex: 1, background: 'var(--bg-main)', padding: '16px' }}>
        Right Panel (flexible)
      </div>
    </div>
  );
}

export const Interactive: Story = {
  args: {
    direction: 'horizontal',
  },
  render: () => <InteractiveDemo />,
};
