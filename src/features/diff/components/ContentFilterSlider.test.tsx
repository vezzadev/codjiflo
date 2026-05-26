import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/tests/helpers';
import userEvent from '@testing-library/user-event';
import { ContentFilterSlider } from './ContentFilterSlider';

describe('ContentFilterSlider', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 90,
      bottom: 24,
      width: 90,
      height: 24,
      toJSON: () => ({}),
    } as DOMRect);
  });

  it('renders three radios with the canonical labels', () => {
    render(<ContentFilterSlider value="both" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Left Only' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Show Both' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Right Only' })).toBeInTheDocument();
  });

  it('marks the active value with data-selected on the label', () => {
    const { container } = render(<ContentFilterSlider value="left" onChange={vi.fn()} />);

    expect(container.querySelector('.content-filter-option-left')).toHaveAttribute(
      'data-selected',
      'true',
    );
    expect(container.querySelector('.content-filter-option-both')).not.toHaveAttribute(
      'data-selected',
    );
  });

  it('clicking a radio fires onChange with that value', async () => {
    const onChange = vi.fn();
    render(<ContentFilterSlider value="both" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Right Only' }));
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('mousedown on the left third of the track snaps to "left"', () => {
    const onChange = vi.fn();
    const { container } = render(<ContentFilterSlider value="both" onChange={onChange} />);
    const track = container.querySelector('.content-filter-track');
    if (!track) throw new Error('track not found');

    fireEvent.mouseDown(track, { clientX: 10 });
    expect(onChange).toHaveBeenCalledWith('left');
  });

  it('mousedown that originates on a Radio still triggers drag (regression: react-aria stopPropagation on press)', () => {
    const onChange = vi.fn();
    const { container } = render(<ContentFilterSlider value="left" onChange={onChange} />);
    const rightRadio = container.querySelector('.content-filter-option-right');
    if (!rightRadio) throw new Error('right radio not found');

    fireEvent.mouseDown(rightRadio, { clientX: 80, bubbles: true });
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('mousedown on the middle third of the track snaps to "both"', () => {
    const onChange = vi.fn();
    const { container } = render(<ContentFilterSlider value="left" onChange={onChange} />);
    const track = container.querySelector('.content-filter-track');
    if (!track) throw new Error('track not found');

    fireEvent.mouseDown(track, { clientX: 45 });
    expect(onChange).toHaveBeenCalledWith('both');
  });

  it('mousedown on the right third of the track snaps to "right"', () => {
    const onChange = vi.fn();
    const { container } = render(<ContentFilterSlider value="left" onChange={onChange} />);
    const track = container.querySelector('.content-filter-track');
    if (!track) throw new Error('track not found');

    fireEvent.mouseDown(track, { clientX: 80 });
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('clamps clientX below the track to "left"', () => {
    const onChange = vi.fn();
    const { container } = render(<ContentFilterSlider value="both" onChange={onChange} />);
    const track = container.querySelector('.content-filter-track');
    if (!track) throw new Error('track not found');

    fireEvent.mouseDown(track, { clientX: -50 });
    expect(onChange).toHaveBeenLastCalledWith('left');
  });

  it('clamps clientX past the track end to "right"', () => {
    const onChange = vi.fn();
    const { container } = render(<ContentFilterSlider value="both" onChange={onChange} />);
    const track = container.querySelector('.content-filter-track');
    if (!track) throw new Error('track not found');

    fireEvent.mouseDown(track, { clientX: 500 });
    expect(onChange).toHaveBeenLastCalledWith('right');
  });

  it('dragging from left to right emits all three positions and stops on mouseup', () => {
    const onChange = vi.fn();
    const { container } = render(<ContentFilterSlider value="both" onChange={onChange} />);
    const track = container.querySelector('.content-filter-track');
    if (!track) throw new Error('track not found');

    fireEvent.mouseDown(track, { clientX: 10 });
    expect(onChange).toHaveBeenLastCalledWith('left');

    fireEvent.mouseMove(document, { clientX: 45 });
    expect(onChange).toHaveBeenLastCalledWith('both');

    fireEvent.mouseMove(document, { clientX: 80 });
    expect(onChange).toHaveBeenLastCalledWith('right');

    fireEvent.mouseUp(document);

    onChange.mockClear();
    fireEvent.mouseMove(document, { clientX: 10 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
