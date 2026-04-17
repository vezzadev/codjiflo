import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { Titlebar } from './Titlebar';

describe('Titlebar', () => {
  it('renders heading with default title', () => {
    render(<Titlebar />);
    // Find the logo text in the heading
    const heading = screen.getByRole('banner');
    expect(heading).toBeInTheDocument();
  });

  it('renders title in center section', () => {
    render(<Titlebar title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders left content when provided', () => {
    render(<Titlebar leftContent={<button>Back</button>} />);
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
  });

  it('renders right content when provided', () => {
    render(<Titlebar rightContent={<button data-testid="custom-button">Settings</button>} />);
    expect(screen.getByTestId('custom-button')).toBeInTheDocument();
  });

  it('renders theme settings button', () => {
    render(<Titlebar />);
    const themeButton = screen.getByRole('button', { name: /Appearance Settings/i });
    expect(themeButton).toBeInTheDocument();
  });

  it('renders view on github link when provided in rightContent', () => {
    render(
      <Titlebar
        title="PR: Add new feature"
        rightContent={
          <a
            href="https://github.com/test/repo/pull/42"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-nav"
            title="View on GitHub"
            aria-label="View on GitHub"
          >
            <span>🔗</span>
          </a>
        }
      />
    );

    const githubLink = screen.getByRole('link', { name: /View on GitHub/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/test/repo/pull/42');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
