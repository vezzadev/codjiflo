/**
 * Tests for IterationRangeSelect component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers/render';
import { IterationRangeSelect } from './IterationRangeSelect';
import type { IterationSearchScope } from '../types';

describe('IterationRangeSelect', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it('renders all iteration scope options', () => {
    render(
      <IterationRangeSelect
        value="current-only"
        onChange={onChange}
      />
    );

    expect(screen.getByRole('radio', { name: /Current iteration only/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Current and previous/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Current and later/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Entire review/i })).toBeInTheDocument();
  });

  it('checks the correct option based on value', () => {
    render(
      <IterationRangeSelect
        value="current-and-previous"
        onChange={onChange}
      />
    );

    expect(screen.getByRole('radio', { name: /Current iteration only/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Current and previous/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Current and later/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Entire review/i })).not.toBeChecked();
  });

  it('calls onChange when an option is selected', () => {
    render(
      <IterationRangeSelect
        value="current-only"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: /Entire review/i }));

    expect(onChange).toHaveBeenCalledWith('entire-review');
  });

  it('calls onChange with correct value for each option', () => {
    render(
      <IterationRangeSelect
        value="current-only"
        onChange={onChange}
      />
    );

    // Click each option and verify the correct value is passed
    // Note: clicking an already-selected radio doesn't fire onChange
    fireEvent.click(screen.getByRole('radio', { name: /Current and previous/i }));
    expect(onChange).toHaveBeenLastCalledWith('current-and-previous');

    fireEvent.click(screen.getByRole('radio', { name: /Current and later/i }));
    expect(onChange).toHaveBeenLastCalledWith('current-and-later');

    fireEvent.click(screen.getByRole('radio', { name: /Entire review/i }));
    expect(onChange).toHaveBeenLastCalledWith('entire-review');

    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('disables all options when disabled prop is true', () => {
    render(
      <IterationRangeSelect
        value="current-only"
        onChange={onChange}
        disabled
      />
    );

    expect(screen.getByRole('radio', { name: /Current iteration only/i })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Current and previous/i })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Current and later/i })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Entire review/i })).toBeDisabled();
  });

  it('maintains disabled state and prevents interaction', () => {
    render(
      <IterationRangeSelect
        value="current-only"
        onChange={onChange}
        disabled
      />
    );

    // All radio buttons should be disabled
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).toBeDisabled();
    });
  });

  it('has accessible radiogroup role', () => {
    render(
      <IterationRangeSelect
        value="current-only"
        onChange={onChange}
      />
    );

    expect(screen.getByRole('radiogroup', { name: /Iteration range/i })).toBeInTheDocument();
  });
});
