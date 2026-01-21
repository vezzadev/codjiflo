/**
 * Tests for GoToLineModal component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { GoToLineModal } from './GoToLineModal';

describe('GoToLineModal', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onGoToLine: vi.fn(),
    maxLine: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders with dialog role', () => {
      render(<GoToLineModal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Go to line');
    });

    it('renders input with correct placeholder', () => {
      render(<GoToLineModal {...defaultProps} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', '1-100');
    });

    it('renders label for the input', () => {
      render(<GoToLineModal {...defaultProps} />);
      expect(screen.getByLabelText('Go to line:')).toBeInTheDocument();
    });

    it('auto-focuses input on mount', () => {
      render(<GoToLineModal {...defaultProps} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
    });
  });

  describe('navigation', () => {
    it('calls onGoToLine with valid line number on Enter', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '42');
      await user.keyboard('{Enter}');

      expect(defaultProps.onGoToLine).toHaveBeenCalledWith(42);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('clamps line number to maxLine when input exceeds it', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '999');
      await user.keyboard('{Enter}');

      expect(defaultProps.onGoToLine).toHaveBeenCalledWith(100);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not navigate on empty input', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.keyboard('{Enter}');

      expect(defaultProps.onGoToLine).not.toHaveBeenCalled();
      // Should show validation error
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid line number');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not navigate on non-numeric input', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'abc');
      await user.keyboard('{Enter}');

      expect(defaultProps.onGoToLine).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid line number');
    });

    it('does not navigate on zero input', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '0');
      await user.keyboard('{Enter}');

      expect(defaultProps.onGoToLine).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid line number');
    });

    it('does not navigate on negative input', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '-5');
      await user.keyboard('{Enter}');

      expect(defaultProps.onGoToLine).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid line number');
    });
  });

  describe('closing behavior', () => {
    it('calls onClose when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(defaultProps.onGoToLine).not.toHaveBeenCalled();
    });

    it('calls onClose on blur after short delay', () => {
      vi.useFakeTimers();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      fireEvent.blur(input);

      expect(defaultProps.onClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(defaultProps.onClose).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('validation state', () => {
    it('clears validation error when typing after error', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');

      // First, trigger an error
      await user.keyboard('{Enter}');
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Then type a character
      await user.type(input, '1');

      // Error should be cleared
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('accessibility', () => {
    it('has aria-describedby pointing to error when invalid', async () => {
      const user = userEvent.setup();
      render(<GoToLineModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.keyboard('{Enter}');

      expect(input).toHaveAttribute('aria-describedby', 'go-to-line-error');
    });

    it('has numeric input mode', () => {
      render(<GoToLineModal {...defaultProps} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('inputMode', 'numeric');
    });
  });
});
