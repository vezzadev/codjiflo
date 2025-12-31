import type { Meta, StoryObj } from '@storybook/react-vite';
import { LeftPane } from './LeftPane';

const meta = {
  title: 'Layout/LeftPane',
  component: LeftPane,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '400px', width: '300px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeftPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div>
        <div style={{ padding: '8px', cursor: 'pointer' }}>📁 src/</div>
        <div style={{ padding: '8px', paddingLeft: '24px', cursor: 'pointer' }}>📄 App.tsx</div>
        <div style={{ padding: '8px', paddingLeft: '24px', cursor: 'pointer' }}>📄 index.ts</div>
        <div style={{ padding: '8px', cursor: 'pointer' }}>📁 tests/</div>
      </div>
    ),
  },
};

export const WithHeader: Story = {
  args: {
    header: (
      <div style={{ fontWeight: 'bold' }}>
        Explorer
      </div>
    ),
    children: (
      <div>
        <div style={{ padding: '8px', cursor: 'pointer' }}>📁 components/</div>
        <div style={{ padding: '8px', cursor: 'pointer' }}>📁 features/</div>
        <div style={{ padding: '8px', cursor: 'pointer' }}>📁 utils/</div>
      </div>
    ),
  },
};

export const WithHeaderAndFooter: Story = {
  args: {
    header: (
      <div style={{ fontWeight: 'bold' }}>
        Files Changed
      </div>
    ),
    children: (
      <div>
        <div style={{ padding: '8px' }}>📝 Button.tsx</div>
        <div style={{ padding: '8px' }}>📝 Input.tsx</div>
        <div style={{ padding: '8px' }}>📝 Modal.tsx</div>
      </div>
    ),
    footer: (
      <div className="properties-panel">
        <div style={{ padding: '8px', fontSize: '12px' }}>
          3 files changed, +45 -12
        </div>
      </div>
    ),
  },
};
