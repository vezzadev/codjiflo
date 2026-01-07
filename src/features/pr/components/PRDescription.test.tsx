import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { PRDescription } from './PRDescription';

describe('PRDescription', () => {
  describe('with pre-rendered HTML', () => {
    it('renders pre-rendered HTML content', () => {
      render(
        <PRDescription
          description="## Summary"
          renderedHtml="<h2>Summary</h2><p>This is pre-rendered.</p>"
        />
      );

      expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
      expect(screen.getByText('This is pre-rendered.')).toBeInTheDocument();
    });

    it('renders tables from pre-rendered HTML', () => {
      render(
        <PRDescription
          description="| A | B |"
          renderedHtml="<table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody><tr><td>Tables</td><td>✅</td></tr></tbody></table>"
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Feature' })).toBeInTheDocument();
    });

    it('renders task lists from pre-rendered HTML', () => {
      render(
        <PRDescription
          description="- [x] Done"
          renderedHtml='<ul><li><input type="checkbox" checked disabled /> Completed</li><li><input type="checkbox" disabled /> Pending</li></ul>'
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe('fallback to runtime markdown rendering', () => {
    it('renders markdown headings', () => {
      render(<PRDescription description="## Summary" />);

      expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    });

    it('renders markdown paragraphs', () => {
      render(<PRDescription description="This is a paragraph." />);

      expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
    });

    it('renders links with target blank', () => {
      render(<PRDescription description="Check out [this link](https://example.com)." />);

      const link = screen.getByRole('link', { name: 'this link' });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders GFM tables', () => {
      const tableMarkdown = `| Feature | Status |
| --- | --- |
| Tables | ✅ |`;

      render(<PRDescription description={tableMarkdown} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Feature' })).toBeInTheDocument();
    });

    it('renders GFM task lists', () => {
      const taskListMarkdown = `- [x] Completed task
- [ ] Pending task`;

      render(<PRDescription description={taskListMarkdown} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });

    it('renders GFM strikethrough', () => {
      render(<PRDescription description="This is ~~deleted~~ text." />);

      const deletedText = screen.getByText('deleted');
      expect(deletedText.tagName.toLowerCase()).toBe('del');
    });
  });

  describe('empty state', () => {
    it('renders empty state when no description', () => {
      render(<PRDescription description="" />);

      expect(screen.getByText('No description provided.')).toBeInTheDocument();
    });

    it('renders empty state when description is whitespace', () => {
      render(<PRDescription description="   " />);

      expect(screen.getByText('No description provided.')).toBeInTheDocument();
    });
  });
});
