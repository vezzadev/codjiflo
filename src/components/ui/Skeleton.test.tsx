import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { Skeleton, SkeletonText } from './Skeleton';

describe('Skeleton', () => {
  it('renders with default props', () => {
    render(<Skeleton />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('skeleton');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading');
  });

  it('applies custom className', () => {
    render(<Skeleton className="custom-skeleton" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('skeleton');
    expect(skeleton).toHaveClass('custom-skeleton');
  });

  it('applies custom width and height', () => {
    render(<Skeleton width="100px" height="50px" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
  });
});

describe('SkeletonText', () => {
  it('renders single line by default', () => {
    render(<SkeletonText />);

    const wrapper = screen.getByRole('status');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading content');
    expect(wrapper).toHaveClass('skeleton-text-wrapper');

    const lines = wrapper.querySelectorAll('.skeleton-text');
    expect(lines).toHaveLength(1);
  });

  it('renders multiple lines', () => {
    render(<SkeletonText lines={3} />);

    const wrapper = screen.getByRole('status');
    const lines = wrapper.querySelectorAll('.skeleton-text');
    expect(lines).toHaveLength(3);
  });

  it('applies 60% width to last line', () => {
    render(<SkeletonText lines={3} />);

    const wrapper = screen.getByRole('status');
    const lines = wrapper.querySelectorAll('.skeleton-text');

    // First two lines should be 100% width
    expect(lines[0]).toHaveStyle({ width: '100%' });
    expect(lines[1]).toHaveStyle({ width: '100%' });
    // Last line should be 60% width
    expect(lines[2]).toHaveStyle({ width: '60%' });
  });

  it('applies custom className', () => {
    render(<SkeletonText className="custom-text" />);

    const wrapper = screen.getByRole('status');
    expect(wrapper).toHaveClass('skeleton-text-wrapper');
    expect(wrapper).toHaveClass('custom-text');
  });
});
