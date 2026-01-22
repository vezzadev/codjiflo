/**
 * Tests for SearchOptionsBar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers/render';
import { SearchOptionsBar } from './SearchOptionsBar';
import type { SearchOptions } from '../types';

describe('SearchOptionsBar', () => {
  const defaultOptions: SearchOptions = {
    matchCase: false,
    matchWholeWord: false,
    useRegex: false,
    highlightAll: false,
  };

  let onToggleOption: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggleOption = vi.fn();
  });

  it('renders all standard option buttons', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
      />
    );

    expect(screen.getByTitle('Match Case')).toBeInTheDocument();
    expect(screen.getByTitle('Match Whole Word')).toBeInTheDocument();
    expect(screen.getByTitle('Use Regular Expression')).toBeInTheDocument();
  });

  it('does not render Highlight All by default', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
      />
    );

    expect(screen.queryByTitle('Highlight All Matches')).not.toBeInTheDocument();
  });

  it('renders Highlight All when showHighlightAll is true', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
        showHighlightAll
      />
    );

    expect(screen.getByTitle('Highlight All Matches')).toBeInTheDocument();
  });

  it('calls onToggleOption when matchCase button is clicked', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
      />
    );

    fireEvent.click(screen.getByTitle('Match Case'));
    expect(onToggleOption).toHaveBeenCalledWith('matchCase');
  });

  it('calls onToggleOption when matchWholeWord button is clicked', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
      />
    );

    fireEvent.click(screen.getByTitle('Match Whole Word'));
    expect(onToggleOption).toHaveBeenCalledWith('matchWholeWord');
  });

  it('calls onToggleOption when useRegex button is clicked', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
      />
    );

    fireEvent.click(screen.getByTitle('Use Regular Expression'));
    expect(onToggleOption).toHaveBeenCalledWith('useRegex');
  });

  it('calls onToggleOption when highlightAll button is clicked', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
        showHighlightAll
      />
    );

    fireEvent.click(screen.getByTitle('Highlight All Matches'));
    expect(onToggleOption).toHaveBeenCalledWith('highlightAll');
  });

  it('reflects pressed state for active options', () => {
    const activeOptions: SearchOptions = {
      matchCase: true,
      matchWholeWord: false,
      useRegex: true,
      highlightAll: false,
    };

    render(
      <SearchOptionsBar
        options={activeOptions}
        onToggleOption={onToggleOption}
      />
    );

    expect(screen.getByTitle('Match Case')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('Match Whole Word')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('Use Regular Expression')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has accessible group role', () => {
    render(
      <SearchOptionsBar
        options={defaultOptions}
        onToggleOption={onToggleOption}
      />
    );

    expect(screen.getByRole('group', { name: 'Search options' })).toBeInTheDocument();
  });
});
