import { describe, it, expect } from 'vitest';
import { render } from '@/tests/helpers/render';
import { MainContent } from './MainContent';

// Generate diff lines for scroll testing
const generateDiffLines = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      data-testid={`diff-line-${String(i)}`}
      style={{ fontFamily: 'monospace', padding: '2px 8px' }}
    >
      Line {String(i + 1).padStart(3, '0')}: const value{String(i)} = "content";
    </div>
  ));

describe('MainContent Stories', () => {
  it('should render with children', () => {
    const { container } = render(
      <MainContent>
        <div data-testid="child">Main content</div>
      </MainContent>
    );
    expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
  });

  it('should render with toolbar', () => {
    const { getByText } = render(
      <MainContent toolbar={<button>Unified</button>}>
        <div>Content</div>
      </MainContent>
    );
    expect(getByText('Unified')).toBeInTheDocument();
  });

  it('should render with navBar', () => {
    const { getByText } = render(
      <MainContent navBar={<span>File navigation</span>}>
        <div>Content</div>
      </MainContent>
    );
    expect(getByText('File navigation')).toBeInTheDocument();
  });

  it('should have diff-viewer class for scrollable content', () => {
    const { container } = render(
      <div style={{ height: '200px', width: '100%' }}>
        <MainContent>
          <div data-testid="diff-content">
            {generateDiffLines(50)}
          </div>
        </MainContent>
      </div>
    );

    // Verify diff-viewer element exists with correct class (CSS provides overflow-y: auto)
    const diffViewer = container.querySelector('.diff-viewer');
    expect(diffViewer).toBeInTheDocument();
    expect(diffViewer).toHaveClass('diff-viewer');

    // Verify it's inside the main-content structure
    const mainContent = container.querySelector('.main-content');
    expect(mainContent).toBeInTheDocument();
    expect(mainContent).toContainElement(diffViewer as HTMLElement);
  });

  it('should render all diff lines in scrollable container', () => {
    const { getByTestId } = render(
      <div style={{ height: '200px', width: '100%' }}>
        <MainContent>
          <div data-testid="diff-content">
            {generateDiffLines(50)}
          </div>
        </MainContent>
      </div>
    );

    // Verify first and last items exist in DOM (even if not visible)
    expect(getByTestId('diff-line-0')).toBeInTheDocument();
    expect(getByTestId('diff-line-49')).toBeInTheDocument();
  });
});
