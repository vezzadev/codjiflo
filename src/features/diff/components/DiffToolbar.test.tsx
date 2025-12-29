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
  Columns2: () => <span data-testid="icon-columns2" />,
  FileText: () => <span data-testid="icon-filetext" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eyeoff" />,
}));

describe('DiffToolbar', () => {
  beforeEach(() => {
    // Reset store to defaults
    useDiffStore.setState({
      viewConfig: {
        mode: 'unified',
        filter: 'both',
        showFullFile: false,
        showWhitespace: false,
      },
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

    it('renders view mode toggle group', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('group', { name: 'View mode' })).toBeInTheDocument();
    });

    it('renders unified button as active by default', () => {
      render(<DiffToolbar />);
      // Get the Unified button by its role within the View mode group
      const viewModeGroup = screen.getByRole('group', { name: 'View mode' });
      const unifiedButton = viewModeGroup.querySelector('button[aria-pressed="true"]');
      expect(unifiedButton).toBeInTheDocument();
      expect(unifiedButton).toHaveTextContent('Unified');
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
    it('calls setViewMode when clicking split button', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const splitButton = screen.getByText('Split');
      await user.click(splitButton);

      expect(useDiffStore.getState().viewConfig.mode).toBe('split');
    });

    it('calls setViewMode when clicking unified button', async () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });

      const user = userEvent.setup();
      render(<DiffToolbar />);

      const unifiedButton = screen.getByText('Unified');
      await user.click(unifiedButton);

      expect(useDiffStore.getState().viewConfig.mode).toBe('unified');
    });
  });

  describe('content filter toggle', () => {
    it('shows content filter in unified mode (AC-3.3.11-13)', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('group', { name: 'Content filter' })).toBeInTheDocument();
    });

    it('shows content filter in split mode (AC-3.3.8-10)', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);
      expect(screen.getByRole('group', { name: 'Content filter' })).toBeInTheDocument();
    });

    it('calls setContentFilter when clicking Left button', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const leftButton = screen.getByText('Left');
      await user.click(leftButton);

      expect(useDiffStore.getState().viewConfig.filter).toBe('left');
    });

    it('calls setContentFilter when clicking Right button', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const rightButton = screen.getByText('Right');
      await user.click(rightButton);

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

    it('shows correct label when whitespace is shown', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showWhitespace: true },
      });
      render(<DiffToolbar />);

      expect(screen.getByRole('button', { name: /hide whitespace characters/i })).toBeInTheDocument();
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
    it('pressing U switches to unified mode', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);

      fireEvent.keyDown(window, { key: 'u' });

      expect(useDiffStore.getState().viewConfig.mode).toBe('unified');
    });

    it('pressing S switches to split mode', () => {
      render(<DiffToolbar />);

      fireEvent.keyDown(window, { key: 's' });

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
      fireEvent.keyDown(input, { key: 's' });

      expect(useDiffStore.getState().viewConfig.mode).toBe('unified');
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
      fireEvent.keyDown(textarea, { key: 's' });

      expect(useDiffStore.getState().viewConfig.mode).toBe('unified');
    });

    it('ignores keyboard shortcuts with modifier keys', () => {
      render(<DiffToolbar />);

      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      expect(useDiffStore.getState().viewConfig.mode).toBe('unified');

      fireEvent.keyDown(window, { key: 's', metaKey: true });
      expect(useDiffStore.getState().viewConfig.mode).toBe('unified');

      fireEvent.keyDown(window, { key: 's', altKey: true });
      expect(useDiffStore.getState().viewConfig.mode).toBe('unified');
    });
  });

  describe('accessibility', () => {
    it('toggle buttons have aria-pressed attribute', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);

      const splitButton = screen.getByText('Split').closest('button');
      const unifiedButton = screen.getByText('Unified').closest('button');

      expect(splitButton).toHaveAttribute('aria-pressed', 'true');
      expect(unifiedButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('buttons have title with keyboard shortcut', () => {
      render(<DiffToolbar />);

      const unifiedButton = screen.getByText('Unified').closest('button');
      expect(unifiedButton).toHaveAttribute('title', expect.stringContaining('U'));

      const splitButton = screen.getByText('Split').closest('button');
      expect(splitButton).toHaveAttribute('title', expect.stringContaining('S'));
    });
  });
});
