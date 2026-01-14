import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { FileListItem } from './FileListItem';
import { createMockFileChange } from '@/tests/factories';
import { FileChangeStatus } from '@/api/types';

const noop = () => { /* empty handler */ };

describe('FileListItem', () => {
  it('displays filename', () => {
    const file = createMockFileChange({ filename: 'src/components/Button.tsx' });

    render(<FileListItem file={file} isSelected={false} onClick={noop} />);

    expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument();
  });

  it('displays change type indicator', () => {
    const file = createMockFileChange({ status: FileChangeStatus.Modified });

    render(<FileListItem file={file} isSelected={false} onClick={noop} />);

    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('displays correct icon for added files', () => {
    const file = createMockFileChange({ status: FileChangeStatus.Added });

    render(<FileListItem file={file} isSelected={false} onClick={noop} />);

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('displays correct icon for modified files', () => {
    const file = createMockFileChange({ status: FileChangeStatus.Modified });

    render(<FileListItem file={file} isSelected={false} onClick={noop} />);

    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('displays correct icon for deleted files', () => {
    const file = createMockFileChange({ status: FileChangeStatus.Deleted });

    render(<FileListItem file={file} isSelected={false} onClick={noop} />);

    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('applies selected styles when selected', () => {
    const file = createMockFileChange();

    render(<FileListItem file={file} isSelected={true} onClick={noop} />);

    const item = screen.getByRole('treeitem');
    expect(item).toHaveAttribute('aria-current', 'location');
    expect(item).toHaveClass('selected');
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const file = createMockFileChange();

    render(<FileListItem file={file} isSelected={false} onClick={onClick} />);

    await user.click(screen.getByRole('treeitem'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has accessible aria-label with file details', () => {
    const file = createMockFileChange({
      filename: 'test.ts',
      status: FileChangeStatus.Modified,
      additions: 5,
      deletions: 3,
    });

    render(<FileListItem file={file} isSelected={false} onClick={noop} />);

    expect(
      screen.getByRole('treeitem', { name: /test.ts, modified, 5 additions, 3 deletions/i })
    ).toBeInTheDocument();
  });

  describe('keyboard navigation', () => {
    it('calls onClick when Enter key is pressed', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const file = createMockFileChange();

      render(<FileListItem file={file} isSelected={false} onClick={onClick} />);

      const item = screen.getByRole('treeitem');
      item.focus();
      await user.keyboard('{Enter}');

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Space key is pressed', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const file = createMockFileChange();

      render(<FileListItem file={file} isSelected={false} onClick={onClick} />);

      const item = screen.getByRole('treeitem');
      item.focus();
      await user.keyboard(' ');

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick for other keys', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const file = createMockFileChange();

      render(<FileListItem file={file} isSelected={false} onClick={onClick} />);

      const item = screen.getByRole('treeitem');
      item.focus();
      await user.keyboard('a');

      expect(onClick).not.toHaveBeenCalled();
    });

    it('is focusable with tabIndex 0', () => {
      const file = createMockFileChange();

      render(<FileListItem file={file} isSelected={false} onClick={noop} />);

      const item = screen.getByRole('treeitem');
      expect(item).toHaveAttribute('tabindex', '0');
    });
  });

  describe('change type icons', () => {
    it('displays correct icon for renamed files', () => {
      const file = createMockFileChange({ status: FileChangeStatus.Renamed });

      render(<FileListItem file={file} isSelected={false} onClick={noop} />);

      expect(screen.getByText('R')).toBeInTheDocument();
    });
  });

  describe('displayName and indent props', () => {
    it('displays displayName instead of full path when provided', () => {
      const file = createMockFileChange({ filename: 'src/components/Button.tsx' });

      render(
        <FileListItem
          file={file}
          isSelected={false}
          onClick={noop}
          displayName="Button.tsx"
        />
      );

      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
      expect(screen.queryByText('src/components/Button.tsx')).not.toBeInTheDocument();
    });

    it('displays full path when displayName is not provided', () => {
      const file = createMockFileChange({ filename: 'src/components/Button.tsx' });

      render(<FileListItem file={file} isSelected={false} onClick={noop} />);

      expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument();
    });

    it('applies indent-1 class when indent is 1', () => {
      const file = createMockFileChange();

      render(
        <FileListItem file={file} isSelected={false} onClick={noop} indent={1} />
      );

      const item = screen.getByRole('treeitem');
      expect(item).toHaveClass('indent-1');
    });

    it('does not apply indent class when indent is not provided', () => {
      const file = createMockFileChange();

      render(<FileListItem file={file} isSelected={false} onClick={noop} />);

      const item = screen.getByRole('treeitem');
      expect(item).not.toHaveClass('indent-1');
    });

    it('preserves full path in aria-label when displayName is used', () => {
      const file = createMockFileChange({
        filename: 'src/components/Button.tsx',
        status: FileChangeStatus.Added,
        additions: 10,
        deletions: 0,
      });

      render(
        <FileListItem
          file={file}
          isSelected={false}
          onClick={noop}
          displayName="Button.tsx"
        />
      );

      // aria-label should contain full path for accessibility
      expect(
        screen.getByRole('treeitem', { name: /src\/components\/Button\.tsx/i })
      ).toBeInTheDocument();
    });
  });
});
