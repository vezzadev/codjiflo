import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { GoToLineModal } from './GoToLineModal';

describe('GoToLineModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    findRowIndex: vi.fn().mockReturnValue(5),
  };

  it('renders nothing when closed', () => {
    const { container } = render(
      <GoToLineModal {...defaultProps} isOpen={false} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal when open', () => {
    render(<GoToLineModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
  });

  it('has correct placeholder text', () => {
    render(<GoToLineModal {...defaultProps} />);

    expect(screen.getByPlaceholderText(/Go to line/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/lN for left/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/rN or N for right/i)).toBeInTheDocument();
  });

  it('focuses input when opened', async () => {
    render(<GoToLineModal {...defaultProps} />);

    // Wait for the focus timeout
    await vi.waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveFocus();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<GoToLineModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /Close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<GoToLineModal {...defaultProps} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('form submission', () => {
    it('calls onNavigate and onClose on valid input', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const onClose = vi.fn();
      const findRowIndex = vi.fn().mockReturnValue(10);

      render(
        <GoToLineModal
          {...defaultProps}
          onNavigate={onNavigate}
          onClose={onClose}
          findRowIndex={findRowIndex}
        />
      );

      await user.type(screen.getByRole('textbox'), '15');
      await user.keyboard('{Enter}');

      expect(findRowIndex).toHaveBeenCalledWith('15');
      expect(onNavigate).toHaveBeenCalledWith(10);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows error for invalid format', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const findRowIndex = vi.fn().mockReturnValue(-1);

      render(
        <GoToLineModal
          {...defaultProps}
          onNavigate={onNavigate}
          findRowIndex={findRowIndex}
        />
      );

      await user.type(screen.getByRole('textbox'), 'invalid');
      await user.keyboard('{Enter}');

      expect(screen.getByRole('alert')).toHaveTextContent('Invalid format');
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('shows error when line not found', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const findRowIndex = vi.fn().mockReturnValue(-1);

      render(
        <GoToLineModal
          {...defaultProps}
          onNavigate={onNavigate}
          findRowIndex={findRowIndex}
        />
      );

      await user.type(screen.getByRole('textbox'), '99');
      await user.keyboard('{Enter}');

      expect(screen.getByRole('alert')).toHaveTextContent('Line 99 not found');
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('clears error when user types', async () => {
      const user = userEvent.setup();
      const findRowIndex = vi.fn().mockReturnValue(-1);

      render(
        <GoToLineModal {...defaultProps} findRowIndex={findRowIndex} />
      );

      // Trigger error first
      await user.type(screen.getByRole('textbox'), 'bad');
      await user.keyboard('{Enter}');

      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Clear and type something else
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), '5');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('input formats', () => {
    it('accepts "lN" format for left side', async () => {
      const user = userEvent.setup();
      const findRowIndex = vi.fn().mockReturnValue(3);
      const onNavigate = vi.fn();

      render(
        <GoToLineModal
          {...defaultProps}
          findRowIndex={findRowIndex}
          onNavigate={onNavigate}
        />
      );

      await user.type(screen.getByRole('textbox'), 'l10');
      await user.keyboard('{Enter}');

      expect(findRowIndex).toHaveBeenCalledWith('l10');
      expect(onNavigate).toHaveBeenCalledWith(3);
    });

    it('accepts "rN" format for right side', async () => {
      const user = userEvent.setup();
      const findRowIndex = vi.fn().mockReturnValue(7);
      const onNavigate = vi.fn();

      render(
        <GoToLineModal
          {...defaultProps}
          findRowIndex={findRowIndex}
          onNavigate={onNavigate}
        />
      );

      await user.type(screen.getByRole('textbox'), 'r20');
      await user.keyboard('{Enter}');

      expect(findRowIndex).toHaveBeenCalledWith('r20');
      expect(onNavigate).toHaveBeenCalledWith(7);
    });

    it('accepts plain number for right side', async () => {
      const user = userEvent.setup();
      const findRowIndex = vi.fn().mockReturnValue(15);
      const onNavigate = vi.fn();

      render(
        <GoToLineModal
          {...defaultProps}
          findRowIndex={findRowIndex}
          onNavigate={onNavigate}
        />
      );

      await user.type(screen.getByRole('textbox'), '30');
      await user.keyboard('{Enter}');

      expect(findRowIndex).toHaveBeenCalledWith('30');
      expect(onNavigate).toHaveBeenCalledWith(15);
    });
  });

  describe('accessibility', () => {
    it('has aria-modal attribute', () => {
      render(<GoToLineModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has proper label association', () => {
      render(<GoToLineModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'goto-line-title');
    });

    it('marks input as invalid when error is shown', async () => {
      const user = userEvent.setup();
      const findRowIndex = vi.fn().mockReturnValue(-1);

      render(<GoToLineModal {...defaultProps} findRowIndex={findRowIndex} />);

      await user.type(screen.getByRole('textbox'), 'invalid');
      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('associates error message with input', async () => {
      const user = userEvent.setup();
      const findRowIndex = vi.fn().mockReturnValue(-1);

      render(<GoToLineModal {...defaultProps} findRowIndex={findRowIndex} />);

      await user.type(screen.getByRole('textbox'), 'bad');
      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-describedby',
        'goto-line-error'
      );
    });
  });

  describe('state reset', () => {
    it('clears input value when reopened', () => {
      const { rerender } = render(
        <GoToLineModal {...defaultProps} isOpen={true} />
      );

      // Close and reopen
      rerender(<GoToLineModal {...defaultProps} isOpen={false} />);
      rerender(<GoToLineModal {...defaultProps} isOpen={true} />);

      expect(screen.getByRole('textbox')).toHaveValue('');
    });
  });
});
