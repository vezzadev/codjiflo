import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { PRDescription } from './PRDescription';

describe('PRDescription', () => {
  it('renders markdown headings', () => {
    render(<PRDescription description="## Summary" />);

    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
  });

  it('renders markdown paragraphs', () => {
    render(<PRDescription description="This is a paragraph." />);

    expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
  });

  it('renders empty state when no description', () => {
    render(<PRDescription description="" />);

    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('renders empty state when description is whitespace', () => {
    render(<PRDescription description="   " />);

    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('renders links in markdown with target blank', () => {
    render(<PRDescription description="Check out [this link](https://example.com)." />);

    const link = screen.getByRole('link', { name: 'this link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders code blocks in markdown', () => {
    render(<PRDescription description="```\nconst foo = 'bar';\n```" />);

    expect(screen.getByText(/const foo/)).toBeInTheDocument();
  });

  it('renders inline code in markdown', () => {
    render(<PRDescription description="Use `const` for constants." />);

    expect(screen.getByText('const')).toBeInTheDocument();
  });
});
