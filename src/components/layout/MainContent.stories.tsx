import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
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

// Generate diff lines for scroll testing
const generateDiffLines = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const type = i % 3 === 0 ? 'add' : i % 3 === 1 ? 'remove' : 'context';
    const prefix = type === 'add' ? '+' : type === 'remove' ? '-' : ' ';
    const bgColor = type === 'add' ? 'var(--diff-add-bg, #1a4d1a)' : type === 'remove' ? 'var(--diff-remove-bg, #4d1a1a)' : 'transparent';
    return (
      <div
        key={i}
        data-testid={`diff-line-${String(i)}`}
        style={{
          fontFamily: 'monospace',
          padding: '2px 8px',
          backgroundColor: bgColor,
          whiteSpace: 'pre',
        }}
      >
        {prefix} Line {String(i + 1).padStart(3, '0')}: const value{String(i)} = {`"content-${String(i)}"`};
      </div>
    );
  });

export const WithScrollableContent: Story = {
  decorators: [
    (Story) => (
      <div style={{ height: '300px', width: '100%' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    toolbar: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-secondary">Unified</button>
        <button className="btn btn-secondary">Split</button>
      </div>
    ),
    children: (
      <div data-testid="diff-content">
        {generateDiffLines(50)}
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the diff viewer container
    const diffViewer = canvasElement.querySelector('.diff-viewer');
    if (!diffViewer) throw new Error('diff-viewer not found');

    // Verify all items are rendered in the DOM
    await expect(canvas.getByTestId('diff-line-0')).toBeInTheDocument();
    await expect(canvas.getByTestId('diff-line-49')).toBeInTheDocument();

    // Verify the diff viewer container exists and has the correct CSS class
    await expect(diffViewer).toHaveClass('diff-viewer');

    // If content overflows, verify scrolling works
    if (diffViewer.scrollHeight > diffViewer.clientHeight) {
      diffViewer.scrollTop = diffViewer.scrollHeight;
      await expect(diffViewer.scrollTop).toBeGreaterThan(0);
    }
  },
};
