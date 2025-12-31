import { describe, it, expect } from 'vitest';
import { render } from '@/tests/helpers/render';
import { LeftPane } from './LeftPane';

// Generate many file items for scroll testing
const generateFileItems = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <div key={i} className="tree-item file" style={{ padding: '8px' }} data-testid={`file-item-${String(i)}`}>
      file-{String(i + 1).padStart(2, '0')}.tsx
    </div>
  ));

describe('LeftPane Stories', () => {
  it('should render with children', () => {
    const { container } = render(
      <LeftPane>
        <div data-testid="child">Child content</div>
      </LeftPane>
    );
    expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
  });

  it('should render with header', () => {
    const { getByText } = render(
      <LeftPane header={<div>Files</div>}>
        <div>Content</div>
      </LeftPane>
    );
    expect(getByText('Files')).toBeInTheDocument();
  });

  it('should have file-tree class for scrollable content', () => {
    const { container } = render(
      <div style={{ height: '200px', width: '300px' }}>
        <LeftPane
          header={<div className="file-explorer-header">Files</div>}
        >
          <nav aria-label="Changed files">
            <div className="file-tree" role="list" data-testid="file-tree">
              {generateFileItems(30)}
            </div>
          </nav>
        </LeftPane>
      </div>
    );

    // Verify file-tree element exists with correct class (CSS provides overflow-y: auto)
    const fileTree = container.querySelector('.file-tree');
    expect(fileTree).toBeInTheDocument();
    expect(fileTree).toHaveClass('file-tree');

    // Verify it's inside the file-explorer structure
    const fileExplorer = container.querySelector('.file-explorer');
    expect(fileExplorer).toBeInTheDocument();
    expect(fileExplorer).toContainElement(fileTree as HTMLElement);
  });

  it('should render all file items in scrollable container', () => {
    const { getByTestId } = render(
      <div style={{ height: '200px', width: '300px' }}>
        <LeftPane>
          <nav aria-label="Changed files">
            <div className="file-tree" role="list" data-testid="file-tree">
              {generateFileItems(30)}
            </div>
          </nav>
        </LeftPane>
      </div>
    );

    // Verify first and last items exist in DOM (even if not visible)
    expect(getByTestId('file-item-0')).toBeInTheDocument();
    expect(getByTestId('file-item-29')).toBeInTheDocument();
  });
});
