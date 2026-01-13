/**
 * Tests for DiffToolbar component (S-3.3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { DiffToolbar } from './DiffToolbar';
import { useDiffStore } from '../stores';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eyeoff" />,
  File: () => <span data-testid="icon-file" />,
  ChevronUp: () => <span data-testid="icon-chevronup" />,
  ChevronDown: () => <span data-testid="icon-chevrondown" />,
}));

describe('DiffToolbar', () => {
  beforeEach(() => {
    // Reset store to defaults
    useDiffStore.setState({
      viewConfig: {
        mode: 'inline',
        filter: 'both',
        showFullFile: false,
        showWhitespace: false,
      },
      currentChangeIndex: -1,
      totalChangeCount: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders toolbar with correct role', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Diff view controls');
    });

    it('renders view mode toggle button showing Inline by default', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('button', { name: /switch to side-by-side view/i })).toBeInTheDocument();
      expect(screen.getByText('Inline')).toBeInTheDocument();
    });

    it('renders content filter radiogroup', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('radiogroup', { name: 'Content filter' })).toBeInTheDocument();
    });

    it('renders full file toggle button', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('button', { name: /show full file/i })).toBeInTheDocument();
    });

    it('renders whitespace toggle button', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('button', { name: /show whitespace characters/i })).toBeInTheDocument();
    });
  });

  describe('view mode toggle', () => {
    it('toggles to split mode when clicking button in inline mode', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const toggleButton = screen.getByRole('button', { name: /switch to side-by-side view/i });
      await user.click(toggleButton);

      expect(useDiffStore.getState().viewConfig.mode).toBe('split');
    });

    it('toggles to inline mode when clicking button in split mode', async () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });

      const user = userEvent.setup();
      render(<DiffToolbar />);

      const toggleButton = screen.getByRole('button', { name: /switch to inline view/i });
      await user.click(toggleButton);

      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
    });

    it('shows SxS label when in split mode', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);

      expect(screen.getByText('SxS')).toBeInTheDocument();
    });
  });

  describe('content filter radiogroup', () => {
    it('shows content filter in inline mode', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('radiogroup', { name: 'Content filter' })).toBeInTheDocument();
    });

    it('shows content filter in split mode', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);
      expect(screen.getByRole('radiogroup', { name: 'Content filter' })).toBeInTheDocument();
    });

    it('has radio with correct label for current filter', () => {
      render(<DiffToolbar />);
      const radio = screen.getByRole('radio', { name: 'Show Both' });
      expect(radio).toHaveAttribute('aria-checked', 'true');
    });

    it('changes filter with L keyboard shortcut', () => {
      render(<DiffToolbar />);
      fireEvent.keyDown(window, { key: 'l' });
      expect(useDiffStore.getState().viewConfig.filter).toBe('left');
    });

    it('changes filter with R keyboard shortcut', () => {
      render(<DiffToolbar />);
      fireEvent.keyDown(window, { key: 'r' });
      expect(useDiffStore.getState().viewConfig.filter).toBe('right');
    });

    it('supports arrow key navigation when focused', () => {
      render(<DiffToolbar />);
      const radiogroup = screen.getByRole('radiogroup', { name: 'Content filter' });
      radiogroup.focus();

      // Arrow right from 'both' should go to 'right'
      fireEvent.keyDown(radiogroup, { key: 'ArrowRight' });
      expect(useDiffStore.getState().viewConfig.filter).toBe('right');
    });
  });

  describe('full file toggle', () => {
    it('calls toggleFullFile when clicked', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: /show full file/i });
      await user.click(button);

      expect(useDiffStore.getState().viewConfig.showFullFile).toBe(true);
    });

    it('shows correct label when full file is enabled', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showFullFile: true },
      });
      render(<DiffToolbar />);

      expect(screen.getByRole('button', { name: /show changes only/i })).toBeInTheDocument();
      expect(screen.getByText('Full')).toBeInTheDocument();
    });

    it('shows Changes label when showing changes only', () => {
      render(<DiffToolbar />);
      expect(screen.getByText('Changes')).toBeInTheDocument();
    });
  });

  describe('whitespace toggle', () => {
    it('calls toggleWhitespace when clicked', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: /show whitespace characters/i });
      await user.click(button);

      expect(useDiffStore.getState().viewConfig.showWhitespace).toBe(true);
    });

    it('shows correct aria-label when whitespace is shown', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showWhitespace: true },
      });
      render(<DiffToolbar />);

      expect(screen.getByRole('button', { name: /hide whitespace characters/i })).toBeInTheDocument();
    });

    it('shows a · b label', () => {
      render(<DiffToolbar />);
      expect(screen.getByText('a · b')).toBeInTheDocument();
    });

    it('shows Eye icon when whitespace is shown', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showWhitespace: true },
      });
      render(<DiffToolbar />);

      expect(screen.getByTestId('icon-eye')).toBeInTheDocument();
    });

    it('shows EyeOff icon when whitespace is hidden', () => {
      render(<DiffToolbar />);
      expect(screen.getByTestId('icon-eyeoff')).toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts', () => {
    it('pressing I switches to inline mode', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);

      fireEvent.keyDown(window, { key: 'i' });

      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
    });

    it('pressing X switches to split mode', () => {
      render(<DiffToolbar />);

      fireEvent.keyDown(window, { key: 'x' });

      expect(useDiffStore.getState().viewConfig.mode).toBe('split');
    });

    it('ignores keyboard shortcuts when typing in input', () => {
      render(
        <>
          <input data-testid="test-input" />
          <DiffToolbar />
        </>
      );

      const input = screen.getByTestId('test-input');
      input.focus();
      fireEvent.keyDown(input, { key: 'x' });

      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
    });

    it('ignores keyboard shortcuts when typing in textarea', () => {
      render(
        <>
          <textarea data-testid="test-textarea" />
          <DiffToolbar />
        </>
      );

      const textarea = screen.getByTestId('test-textarea');
      textarea.focus();
      fireEvent.keyDown(textarea, { key: 'x' });

      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
    });

    it('ignores keyboard shortcuts with modifier keys', () => {
      render(<DiffToolbar />);

      fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');

      fireEvent.keyDown(window, { key: 'x', metaKey: true });
      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');

      fireEvent.keyDown(window, { key: 'x', altKey: true });
      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
    });
  });

  describe('accessibility', () => {
    it('view mode toggle button has aria-pressed attribute', () => {
      render(<DiffToolbar />);

      const toggleButton = screen.getByRole('button', { name: /switch to side-by-side view/i });
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('view mode toggle stays unpressed when in split mode', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);

      const toggleButton = screen.getByRole('button', { name: /switch to inline view/i });
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('toggle button has title with keyboard shortcut', () => {
      render(<DiffToolbar />);

      const toggleButton = screen.getByRole('button', { name: /switch to side-by-side view/i });
      expect(toggleButton).toHaveAttribute('title', expect.stringContaining('X'));
    });
  });
});
