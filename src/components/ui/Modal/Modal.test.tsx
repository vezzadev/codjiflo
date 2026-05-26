import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Modal } from './Modal';

function ControlledModal({ initialOpen = true, onOpenChangeSpy }: { initialOpen?: boolean; onOpenChangeSpy?: (open: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open</button>
      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          onOpenChangeSpy?.(open);
          setIsOpen(open);
        }}
        title="Test Modal"
      >
        {({ close }) => (
          <>
            <button type="button">First focusable</button>
            <button type="button">Second focusable</button>
            <button type="button" onClick={close}>Close</button>
          </>
        )}
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} onOpenChange={vi.fn()} title="X">content</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open with accessible name from title', () => {
    render(<Modal isOpen={true} onOpenChange={vi.fn()} title="Hello">body</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Hello');
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
  });

  it('applies modal-overlay and modal-content classes', () => {
    render(<Modal isOpen={true} onOpenChange={vi.fn()} title="X">body</Modal>);
    expect(document.querySelector('.modal-overlay')).toBeInTheDocument();
    expect(document.querySelector('.modal-content')).toBeInTheDocument();
  });

  it('extends modal-content className via prop', () => {
    render(<Modal isOpen={true} onOpenChange={vi.fn()} title="X" className="my-extra">body</Modal>);
    const content = document.querySelector('.modal-content');
    expect(content).toHaveClass('my-extra');
  });

  it('Escape dismisses', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ControlledModal onOpenChangeSpy={onOpenChange} />);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('close render-prop callback closes the modal', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ControlledModal onOpenChangeSpy={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('focus returns to trigger after close', async () => {
    const user = userEvent.setup();
    render(<ControlledModal initialOpen={false} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    await user.click(trigger);
    // Modal opens — focus moves into modal
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Close via Escape — react-aria FocusScope restores focus asynchronously
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
