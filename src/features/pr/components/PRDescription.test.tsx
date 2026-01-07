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

  describe('GitHub Flavored Markdown', () => {
    it('renders tables', () => {
      const tableMarkdown = `| Feature | Status |
| --- | --- |
| Tables | ✅ |
| Task lists | ✅ |`;

      render(<PRDescription description={tableMarkdown} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Feature' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'Tables' })).toBeInTheDocument();
    });

    it('renders task lists with checkboxes', () => {
      const taskListMarkdown = `- [x] Completed task
- [ ] Pending task`;

      render(<PRDescription description={taskListMarkdown} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });

    it('renders strikethrough text', () => {
      render(<PRDescription description="This is ~~deleted~~ text." />);

      const deletedText = screen.getByText('deleted');
      expect(deletedText.tagName.toLowerCase()).toBe('del');
    });

    it('renders autolinks for URLs', () => {
      render(<PRDescription description="Check out https://github.com for more." />);

      const link = screen.getByRole('link', { name: 'https://github.com' });
      expect(link).toHaveAttribute('href', 'https://github.com');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('hides HTML comments', () => {
      render(<PRDescription description="Visible text <!-- hidden comment --> more visible" />);

      expect(screen.getByText(/Visible text/)).toBeInTheDocument();
      expect(screen.getByText(/more visible/)).toBeInTheDocument();
      expect(screen.queryByText(/hidden comment/)).not.toBeInTheDocument();
    });
  });
});
