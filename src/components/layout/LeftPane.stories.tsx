import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
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

// Generate many file items for scroll testing
const generateFileItems = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <div key={i} className="tree-item file" style={{ padding: '8px' }} data-testid={`file-item-${String(i)}`}>
      📄 file-{String(i + 1).padStart(2, '0')}.tsx
    </div>
  ));

export const WithScrollableContent: Story = {
  decorators: [
    (Story) => (
      <div style={{ height: '300px', width: '300px' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    header: (
      <div className="file-explorer-header">
        <span>Files</span>
      </div>
    ),
    children: (
      <nav aria-label="Changed files">
        <div className="file-tree" role="list" data-testid="file-tree">
          {generateFileItems(30)}
        </div>
      </nav>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the file tree container
    const fileTree = canvas.getByTestId('file-tree');

    // Verify all items are rendered in the DOM
    await expect(canvas.getByTestId('file-item-0')).toBeInTheDocument();
    await expect(canvas.getByTestId('file-item-29')).toBeInTheDocument();

    // Verify the file tree container exists and has the correct CSS class
    await expect(fileTree).toHaveClass('file-tree');

    // If content overflows, verify scrolling works
    if (fileTree.scrollHeight > fileTree.clientHeight) {
      fileTree.scrollTop = fileTree.scrollHeight;
      await expect(fileTree.scrollTop).toBeGreaterThan(0);
    }
  },
};
