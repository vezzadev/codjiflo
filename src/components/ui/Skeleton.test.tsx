import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { Skeleton, SkeletonText } from './Skeleton';

describe('Skeleton', () => {
  it('renders with default props', () => {
    render(<Skeleton />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-label', 'Loading');
    expect(skeleton).toHaveClass('skeleton');
  });

  it('applies custom className', () => {
    render(<Skeleton className="custom-class" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('skeleton');
    expect(skeleton).toHaveClass('custom-class');
  });

  it('applies width style', () => {
    render(<Skeleton width="100px" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ width: '100px' });
  });

  it('applies height style', () => {
    render(<Skeleton height="50px" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ height: '50px' });
  });

  it('applies both width and height styles', () => {
    render(<Skeleton width="200px" height="100px" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ width: '200px', height: '100px' });
  });
});

describe('SkeletonText', () => {
  it('renders single line by default', () => {
    render(<SkeletonText />);

    const wrapper = screen.getByRole('status');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading content');
    
    const skeletonLines = wrapper.querySelectorAll('.skeleton-text');
    expect(skeletonLines).toHaveLength(1);
  });

  it('renders multiple lines when specified', () => {
    render(<SkeletonText lines={3} />);

    const wrapper = screen.getByRole('status');
    const skeletonLines = wrapper.querySelectorAll('.skeleton-text');
    expect(skeletonLines).toHaveLength(3);
  });

  it('renders last line at 60% width', () => {
    render(<SkeletonText lines={2} />);

    const wrapper = screen.getByRole('status');
    const skeletonLines = wrapper.querySelectorAll('.skeleton-text');
    
    // First line should be 100%
    expect(skeletonLines[0]).toHaveStyle({ width: '100%' });
    // Last line should be 60%
    expect(skeletonLines[1]).toHaveStyle({ width: '60%' });
  });

  it('renders all non-last lines at 100% width', () => {
    render(<SkeletonText lines={4} />);

    const wrapper = screen.getByRole('status');
    const skeletonLines = wrapper.querySelectorAll('.skeleton-text');
    
    expect(skeletonLines[0]).toHaveStyle({ width: '100%' });
    expect(skeletonLines[1]).toHaveStyle({ width: '100%' });
    expect(skeletonLines[2]).toHaveStyle({ width: '100%' });
    // Last line at 60%
    expect(skeletonLines[3]).toHaveStyle({ width: '60%' });
  });

  it('applies custom className', () => {
    render(<SkeletonText className="custom-wrapper" />);

    const wrapper = screen.getByRole('status');
    expect(wrapper).toHaveClass('skeleton-text-wrapper');
    expect(wrapper).toHaveClass('custom-wrapper');
  });

  it('applies skeleton class to all lines', () => {
    render(<SkeletonText lines={2} />);

    const wrapper = screen.getByRole('status');
    const skeletonLines = wrapper.querySelectorAll('.skeleton-text');
    
    skeletonLines.forEach(line => {
      expect(line).toHaveClass('skeleton');
    });
  });
});
