/**
 * GoToLinePanel Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoToLinePanel } from './GoToLinePanel';
import type { EditorView } from '@codemirror/view';

describe('GoToLinePanel', () => {
  const mockDispatch = vi.fn();
  const mockFocus = vi.fn();

  const createMockEditorView = (lineCount = 100): EditorView => ({
    state: {
      doc: {
        lines: lineCount,
        line: (n: number) => ({ from: (n - 1) * 10 }),
      },
    },
    dispatch: mockDispatch,
    focus: mockFocus,
  } as unknown as EditorView);

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    getActiveEditor: () => createMockEditorView(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders when isOpen=true', () => {
      render(<GoToLinePanel {...defaultProps} isOpen={true} />);

      expect(screen.getByRole('dialog', { name: 'Go to line' })).toBeInTheDocument();
    });

    it('does not render when isOpen=false', () => {
      render(<GoToLinePanel {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders input with correct attributes', () => {
      render(<GoToLinePanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('Line number');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('inputMode', 'numeric');
    });

    it('renders Go button', () => {
      render(<GoToLinePanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Go to line' })).toBeInTheDocument();
    });

    it('renders Close button', () => {
      render(<GoToLinePanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('focus behavior', () => {
    it('focuses input when panel opens', () => {
      render(<GoToLinePanel {...defaultProps} isOpen={true} />);

      const input = screen.getByPlaceholderText('Line number');
      expect(document.activeElement).toBe(input);
    });

    it('clears input value when panel reopens', () => {
      const { rerender } = render(<GoToLinePanel {...defaultProps} isOpen={true} />);

      const input = screen.getByPlaceholderText<HTMLInputElement>('Line number');
      fireEvent.change(input, { target: { value: '42' } });
      expect(input.value).toBe('42');

      // Close panel
      rerender(<GoToLinePanel {...defaultProps} isOpen={false} />);

      // Reopen panel
      rerender(<GoToLinePanel {...defaultProps} isOpen={true} />);

      const inputAfterReopen = screen.getByPlaceholderText<HTMLInputElement>('Line number');
      expect(inputAfterReopen.value).toBe('');
    });
  });

  describe('keyboard handling', () => {
    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<GoToLinePanel {...defaultProps} onClose={onClose} />);

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('navigates to line and closes when Enter is pressed with valid input', () => {
      const onClose = vi.fn();
      render(<GoToLinePanel {...defaultProps} onClose={onClose} />);

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.change(input, { target: { value: '50' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          selection: expect.objectContaining({ anchor: expect.any(Number) }),
          scrollIntoView: true,
        })
      );
      expect(mockFocus).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('does not navigate with invalid input', () => {
      const onClose = vi.fn();
      render(<GoToLinePanel {...defaultProps} onClose={onClose} />);

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('button actions', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<GoToLinePanel {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('navigates to line when Go button is clicked', () => {
      const onClose = vi.fn();
      render(<GoToLinePanel {...defaultProps} onClose={onClose} />);

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.change(input, { target: { value: '25' } });

      const goButton = screen.getByRole('button', { name: 'Go to line' });
      fireEvent.click(goButton);

      expect(mockDispatch).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('line number clamping', () => {
    it('clamps line number to max when exceeding document lines', () => {
      const editorView = createMockEditorView(50);
      render(<GoToLinePanel {...defaultProps} getActiveEditor={() => editorView} />);

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.change(input, { target: { value: '100' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should navigate to line 50 (max), not 100
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          selection: { anchor: 490 }, // line 50 position: (50-1) * 10
        })
      );
    });

    it('does not navigate when line number is zero or negative', () => {
      const onClose = vi.fn();
      render(<GoToLinePanel {...defaultProps} onClose={onClose} />);

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // 0 is invalid (< 1), so navigation should not happen
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles null editor gracefully', () => {
      const onClose = vi.fn();
      render(<GoToLinePanel {...defaultProps} onClose={onClose} getActiveEditor={() => null} />);

      const input = screen.getByPlaceholderText('Line number');
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not crash, and should not call onClose since navigation failed
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
