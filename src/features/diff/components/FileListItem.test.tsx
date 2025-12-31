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

    const item = screen.getByRole('listitem');
    expect(item).toHaveAttribute('aria-current', 'location');
    expect(item).toHaveClass('selected');
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const file = createMockFileChange();

    render(<FileListItem file={file} isSelected={false} onClick={onClick} />);

    await user.click(screen.getByRole('listitem'));

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
      screen.getByRole('listitem', { name: /test.ts, modified, 5 additions, 3 deletions/i })
    ).toBeInTheDocument();
  });
});
