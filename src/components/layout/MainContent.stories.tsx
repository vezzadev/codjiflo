import type { Meta, StoryObj } from '@storybook/react-vite';
import { MainContent } from './MainContent';

const meta = {
  title: 'Layout/MainContent',
  component: MainContent,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '500px', width: '100%' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MainContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div style={{ padding: '16px' }}>
        <p>Main content area - typically displays diff viewer content.</p>
      </div>
    ),
  },
};

export const WithToolbar: Story = {
  args: {
    toolbar: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-secondary">Unified</button>
        <button className="btn btn-secondary">Split</button>
        <button className="btn btn-secondary">Raw</button>
      </div>
    ),
    children: (
      <div style={{ padding: '16px', fontFamily: 'monospace' }}>
        <pre>{`- const oldValue = 1;
+ const newValue = 2;`}</pre>
      </div>
    ),
  },
};

export const WithNavBar: Story = {
  args: {
    navBar: (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span>← Previous</span>
        <span style={{ fontWeight: 'bold' }}>File 3 of 10</span>
        <span>Next →</span>
      </div>
    ),
    children: (
      <div style={{ padding: '16px' }}>
        <p>Content with navigation bar above.</p>
      </div>
    ),
  },
};

export const WithToolbarAndNavBar: Story = {
  args: {
    navBar: (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span>src/components/Button.tsx</span>
      </div>
    ),
    toolbar: (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary">Unified</button>
          <button className="btn btn-secondary">Split</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary">Comment</button>
        </div>
      </div>
    ),
    children: (
      <div style={{ padding: '16px', fontFamily: 'monospace' }}>
        <pre>{`function Button({ label, onClick }) {
  return (
    <button onClick={onClick}>
      {label}
    </button>
  );
}`}</pre>
      </div>
    ),
  },
};
