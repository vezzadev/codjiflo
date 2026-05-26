import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ShortcutsModal } from './ShortcutsModal';

function ControlledShortcuts({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <ShortcutsModal isOpen={open} onOpenChange={setOpen} />
    </>
  );
}

describe('ShortcutsModal', () => {
  it('renders nothing when closed', () => {
    render(<ShortcutsModal isOpen={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal when open with accessible name from title', () => {
    render(<ShortcutsModal isOpen={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Keyboard Shortcuts');
  });

  it('displays all shortcuts', () => {
    render(<ShortcutsModal isOpen={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('j')).toBeInTheDocument();
    expect(screen.getByText('Next file')).toBeInTheDocument();
    expect(screen.getByText('k')).toBeInTheDocument();
    expect(screen.getByText('Previous file')).toBeInTheDocument();
    expect(screen.getByText('Space')).toBeInTheDocument();
    expect(screen.getByText('Scroll down in diff view')).toBeInTheDocument();
    expect(screen.getByText('i')).toBeInTheDocument();
    expect(screen.getByText('Inline view')).toBeInTheDocument();
    expect(screen.getByText('s')).toBeInTheDocument();
    expect(screen.getByText('Side-by-side view')).toBeInTheDocument();
    expect(screen.getByText('l')).toBeInTheDocument();
    expect(screen.getByText('Left only (deletions)')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('Show both sides')).toBeInTheDocument();
    expect(screen.getByText('r')).toBeInTheDocument();
    expect(screen.getByText('Right only (additions)')).toBeInTheDocument();
    expect(screen.getByText('f')).toBeInTheDocument();
    expect(screen.getByText('Show full file')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.getByText('Show changes only')).toBeInTheDocument();
    expect(screen.getByText('w')).toBeInTheDocument();
    expect(screen.getByText('Toggle whitespace visibility')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ShortcutsModal isOpen={true} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: /Close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ShortcutsModal isOpen={true} onOpenChange={onOpenChange} />);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('focus returns to trigger after close', async () => {
    const user = userEvent.setup();
    render(<ControlledShortcuts initialOpen={false} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('Tab cycles inside the dialog (focus trap)', async () => {
    const user = userEvent.setup();
    render(<ShortcutsModal isOpen={true} onOpenChange={vi.fn()} />);
    const closeBtn = screen.getByRole('button', { name: /Close/i });
    closeBtn.focus();
    expect(closeBtn).toHaveFocus();
    // Tab should cycle back to the Close button (only focusable inside)
    await user.tab();
    expect(closeBtn).toHaveFocus();
  });
});
