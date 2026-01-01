import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { ShortcutsModal } from './ShortcutsModal';

describe('ShortcutsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ShortcutsModal isOpen={false} onClose={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal when open', () => {
    render(<ShortcutsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('displays all shortcuts', () => {
    render(<ShortcutsModal isOpen={true} onClose={vi.fn()} />);

    // Navigation shortcuts
    expect(screen.getByText('j')).toBeInTheDocument();
    expect(screen.getByText('Next file')).toBeInTheDocument();
    expect(screen.getByText('k')).toBeInTheDocument();
    expect(screen.getByText('Previous file')).toBeInTheDocument();
    expect(screen.getByText('Space')).toBeInTheDocument();
    expect(screen.getByText('Scroll down in diff view')).toBeInTheDocument();

    // View mode shortcuts
    expect(screen.getByText('u')).toBeInTheDocument();
    expect(screen.getByText('Unified (inline) view')).toBeInTheDocument();
    expect(screen.getByText('s')).toBeInTheDocument();
    expect(screen.getByText('Side-by-side view')).toBeInTheDocument();

    // Content filter shortcuts
    expect(screen.getByText('l')).toBeInTheDocument();
    expect(screen.getByText('Left only (deletions)')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('Show both sides')).toBeInTheDocument();
    expect(screen.getByText('r')).toBeInTheDocument();
    expect(screen.getByText('Right only (additions)')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ShortcutsModal isOpen={true} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /Close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ShortcutsModal isOpen={true} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has aria-modal attribute', () => {
    render(<ShortcutsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('has proper heading association', () => {
    render(<ShortcutsModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'shortcuts-title');
    expect(screen.getByText('Keyboard Shortcuts')).toHaveAttribute('id', 'shortcuts-title');
  });
});
