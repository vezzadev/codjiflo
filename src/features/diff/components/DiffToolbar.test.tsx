/**
 * Tests for DiffToolbar component (S-3.3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { DiffToolbar } from './DiffToolbar';
import { useDiffStore } from '../stores';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eyeoff" />,
  FileDiff: () => <span data-testid="icon-filediff" />,
  FileText: () => <span data-testid="icon-filetext" />,
  ChevronUp: () => <span data-testid="icon-chevronup" />,
  ChevronDown: () => <span data-testid="icon-chevrondown" />,
  MessageSquare: () => <span data-testid="icon-messagesquare" />,
  MessageSquareOff: () => <span data-testid="icon-messagesquareoff" />,
  AlignJustify: () => <span data-testid="icon-alignjustify" />,
  WrapText: () => <span data-testid="icon-wraptext" />,
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
        showComments: true,
        textWrap: 'nowrap',
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

    it('renders view mode dropdown showing Inline by default', () => {
      render(<DiffToolbar />);
      const button = screen.getByRole('button', { name: 'View mode' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Inline');
    });

    it('renders content filter radiogroup', () => {
      render(<DiffToolbar />);
      expect(screen.getByRole('radiogroup', { name: 'Content filter' })).toBeInTheDocument();
    });

    it('renders file content dropdown', () => {
      render(<DiffToolbar />);
      const button = screen.getByRole('button', { name: 'File content' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Changes');
    });

    it('renders whitespace visibility dropdown', () => {
      render(<DiffToolbar />);
      const button = screen.getByRole('button', { name: 'Whitespace visibility' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('WS: Hidden');
    });
  });

  describe('view mode dropdown', () => {
    it('changes to split mode when selecting split option', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'View mode' });
      await user.click(button);

      const listbox = screen.getByRole('listbox', { name: 'View mode' });
      const splitOption = within(listbox).getByRole('option', { name: /Side-by-Side/i });
      await user.click(splitOption);

      expect(useDiffStore.getState().viewConfig.mode).toBe('split');
    });

    it('changes to inline mode when selecting inline option', async () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });

      const user = userEvent.setup();
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'View mode' });
      await user.click(button);

      const listbox = screen.getByRole('listbox', { name: 'View mode' });
      const inlineOption = within(listbox).getByRole('option', { name: /Inline/i });
      await user.click(inlineOption);

      expect(useDiffStore.getState().viewConfig.mode).toBe('inline');
    });

    it('shows split label when in split mode', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, mode: 'split' },
      });
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'View mode' });
      expect(button).toHaveTextContent('Side-by-Side');
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

  describe('file content dropdown', () => {
    it('enables full file when selecting full option', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'File content' });
      await user.click(button);

      const listbox = screen.getByRole('listbox', { name: 'File content' });
      const fullOption = within(listbox).getByRole('option', { name: /Full File/i });
      await user.click(fullOption);

      expect(useDiffStore.getState().viewConfig.showFullFile).toBe(true);
    });

    it('shows full label when full file is enabled', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showFullFile: true },
      });
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'File content' });
      expect(button).toHaveTextContent('Full File');
    });

    it('shows changes label when showing changes only', () => {
      render(<DiffToolbar />);
      const button = screen.getByRole('button', { name: 'File content' });
      expect(button).toHaveTextContent('Changes');
    });
  });

  describe('whitespace visibility dropdown', () => {
    it('enables whitespace when selecting visible option', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'Whitespace visibility' });
      await user.click(button);

      const listbox = screen.getByRole('listbox', { name: 'Whitespace visibility' });
      const visibleOption = within(listbox).getByRole('option', { name: /WS: Visible/i });
      await user.click(visibleOption);

      expect(useDiffStore.getState().viewConfig.showWhitespace).toBe(true);
    });

    it('shows visible label when whitespace is shown', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, showWhitespace: true },
      });
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'Whitespace visibility' });
      expect(button).toHaveTextContent('WS: Visible');
    });

    it('shows hidden label when whitespace is hidden', () => {
      render(<DiffToolbar />);
      const button = screen.getByRole('button', { name: 'Whitespace visibility' });
      expect(button).toHaveTextContent('WS: Hidden');
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

    it('pressing P toggles text wrap from nowrap to wrap', () => {
      render(<DiffToolbar />);

      expect(useDiffStore.getState().viewConfig.textWrap).toBe('nowrap');
      fireEvent.keyDown(window, { key: 'p' });

      expect(useDiffStore.getState().viewConfig.textWrap).toBe('wrap');
    });

    it('pressing P toggles text wrap from wrap to nowrap', () => {
      useDiffStore.setState({
        viewConfig: { ...useDiffStore.getState().viewConfig, textWrap: 'wrap' },
      });
      render(<DiffToolbar />);

      fireEvent.keyDown(window, { key: 'p' });

      expect(useDiffStore.getState().viewConfig.textWrap).toBe('nowrap');
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
    it('view mode dropdown has aria-label', () => {
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'View mode' });
      expect(button).toHaveAttribute('aria-label', 'View mode');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('file content dropdown has aria-label', () => {
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'File content' });
      expect(button).toHaveAttribute('aria-label', 'File content');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('whitespace visibility dropdown has aria-label', () => {
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'Whitespace visibility' });
      expect(button).toHaveAttribute('aria-label', 'Whitespace visibility');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('dropdown button has aria-expanded false when closed', () => {
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'View mode' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('dropdown button has aria-expanded true when open', async () => {
      const user = userEvent.setup();
      render(<DiffToolbar />);

      const button = screen.getByRole('button', { name: 'View mode' });
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('dropdown closes when focus leaves via Tab', async () => {
      const user = userEvent.setup();
      render(
        <>
          <DiffToolbar />
          <button data-testid="outside-button">Outside</button>
        </>
      );

      const viewModeButton = screen.getByRole('button', { name: 'View mode' });

      // Open dropdown
      await user.click(viewModeButton);
      expect(viewModeButton).toHaveAttribute('aria-expanded', 'true');

      // Tab away from the dropdown
      await user.tab();

      // Dropdown should close
      expect(viewModeButton).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
