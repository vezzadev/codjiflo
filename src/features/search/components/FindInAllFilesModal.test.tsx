/**
 * Tests for FindInAllFilesModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers/render';
import { FindInAllFilesModal } from './FindInAllFilesModal';
import { useSearchStore } from '../stores';
import { DEFAULT_SEARCH_OPTIONS } from '../types';

describe('FindInAllFilesModal', () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onSearch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onSearch = vi.fn();
    // Reset store state
    useSearchStore.setState({
      mode: 'all-files',
      query: '',
      fileFilter: '',
      fileFilterUseRegex: false,
      options: DEFAULT_SEARCH_OPTIONS,
      iterationScope: 'current-only',
      sideFilter: 'both',
      currentFileMatches: [],
      currentMatchIndex: -1,
      allFilesResults: [],
      isSearching: false,
      showResultsPanel: false,
    });
  });

  it('renders nothing when not open', () => {
    render(
      <FindInAllFilesModal
        isOpen={false}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Find in All Files/i })).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('textbox', { name: /Search/i })).toBeInTheDocument();
  });

  it('renders file filter input', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('textbox', { name: /File filter/i })).toBeInTheDocument();
  });

  it('renders iteration range options', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('radio', { name: /Current iteration only/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Current and previous/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Current and later/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Entire review/i })).toBeInTheDocument();
  });

  it('renders side filter dropdown', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('combobox', { name: /Side/i })).toBeInTheDocument();
  });

  it('renders Cancel and Search buttons', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument();
  });

  it('disables Search button when query is empty', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('button', { name: /Search/i })).toBeDisabled();
  });

  it('enables Search button when query has content', () => {
    useSearchStore.setState({ query: 'test' });

    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    expect(screen.getByRole('button', { name: /Search/i })).toBeEnabled();
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    // Click on backdrop (the element with aria-hidden="true")
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSearch when Search button is clicked', () => {
    useSearchStore.setState({ query: 'test' });

    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    expect(onSearch).toHaveBeenCalled();
  });

  it('calls onSearch when Ctrl+Enter is pressed', () => {
    useSearchStore.setState({ query: 'test' });

    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter', ctrlKey: true });
    expect(onSearch).toHaveBeenCalled();
  });

  it('updates query in store when typing', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    const input = screen.getByRole('textbox', { name: /Search/i });
    fireEvent.change(input, { target: { value: 'hello' } });

    expect(useSearchStore.getState().query).toBe('hello');
  });

  it('updates file filter in store when typing', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    const input = screen.getByRole('textbox', { name: /File filter/i });
    fireEvent.change(input, { target: { value: '*.tsx' } });

    expect(useSearchStore.getState().fileFilter).toBe('*.tsx');
  });

  it('updates side filter in store when changed', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    const select = screen.getByRole('combobox', { name: /Side/i });
    fireEvent.change(select, { target: { value: 'left' } });

    expect(useSearchStore.getState().sideFilter).toBe('left');
  });

  it('toggles file filter regex mode when button is clicked', () => {
    render(
      <FindInAllFilesModal
        isOpen={true}
        onClose={onClose}
        onSearch={onSearch}
      />
    );

    const regexButton = screen.getByTitle('Use Regular Expression for file filter');
    fireEvent.click(regexButton);

    expect(useSearchStore.getState().fileFilterUseRegex).toBe(true);
  });
});
