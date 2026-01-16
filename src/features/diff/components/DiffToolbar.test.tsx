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

    it('renders view mode select showing Inline by default', () => {
      render(<DiffToolbar />);
      const select = screen.getByRole('combobox', { name: 'View mode' });
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('inline');
    });

    it('renders content filter radiogroup', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('radiogroup', { name: 'Content filter' })).toBeInTheDocument();
    });

    it('renders file content select', () => {
      render(<DiffToolbar />);
      const select = screen.getByRole('combobox', { name: 'File content' });
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('changes');
    });

    it('renders whitespace visibility select', () => {
      render(<DiffToolbar />);
      const select = screen.getByRole('combobox', { name: 'Whitespace visibility' });
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('hidden');
    });
  });

  describe('view mode select', () => {
    it('changes to split mode when selecting split option', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'View mode' });
      await user.selectOptions(select, 'split');

      expect(useDiffStore.getState().viewConfig.mode).toBe('split');
    });

    it('changes to inline mode when selecting inline option', async () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });

      const user = userEvent.setup();
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'View mode' });
      await user.selectOptions(select, 'inline');

      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
    });

    it('shows split value when in split mode', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'View mode' });
      expect(select).toHaveValue('split');
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

  describe('file content select', () => {
    it('enables full file when selecting full option', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'File content' });
      await user.selectOptions(select, 'full');

      expect(useDiffStore.getState().viewConfig.showFullFile).toBe(true);
    });

    it('shows full value when full file is enabled', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showFullFile: true },
      });
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'File content' });
      expect(select).toHaveValue('full');
    });

    it('shows changes value when showing changes only', () => {
      render(<DiffToolbar />);
      const select = screen.getByRole('combobox', { name: 'File content' });
      expect(select).toHaveValue('changes');
    });
  });

  describe('whitespace visibility select', () => {
    it('enables whitespace when selecting visible option', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'Whitespace visibility' });
      await user.selectOptions(select, 'visible');

      expect(useDiffStore.getState().viewConfig.showWhitespace).toBe(true);
    });

    it('shows visible value when whitespace is shown', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showWhitespace: true },
      });
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'Whitespace visibility' });
      expect(select).toHaveValue('visible');
    });

    it('shows hidden value when whitespace is hidden', () => {
      render(<DiffToolbar />);
      const select = screen.getByRole('combobox', { name: 'Whitespace visibility' });
      expect(select).toHaveValue('hidden');
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
    it('view mode select has aria-label', () => {
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'View mode' });
      expect(select).toHaveAttribute('aria-label', 'View mode');
    });

    it('file content select has aria-label', () => {
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'File content' });
      expect(select).toHaveAttribute('aria-label', 'File content');
    });

    it('whitespace visibility select has aria-label', () => {
      render(<DiffToolbar />);

      const select = screen.getByRole('combobox', { name: 'Whitespace visibility' });
      expect(select).toHaveAttribute('aria-label', 'Whitespace visibility');
    });
  });
});
