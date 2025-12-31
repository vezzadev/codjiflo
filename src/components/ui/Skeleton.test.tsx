import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { Skeleton, SkeletonText } from './Skeleton';

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton');
    
    expect(skeleton).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<Skeleton />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-label', 'Loading');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-skeleton" />);
    const skeleton = container.querySelector('.skeleton');
    
    expect(skeleton).toHaveClass('skeleton');
    expect(skeleton).toHaveClass('custom-skeleton');
  });

  it('applies custom width', () => {
    const { container } = render(<Skeleton width="200px" />);
    const skeleton = container.querySelector('.skeleton');
    
    expect(skeleton).toHaveStyle({ width: '200px' });
  });

  it('applies custom height', () => {
    const { container } = render(<Skeleton height="50px" />);
    const skeleton = container.querySelector('.skeleton');
    
    expect(skeleton).toHaveStyle({ height: '50px' });
  });

  it('applies both width and height', () => {
    const { container } = render(<Skeleton width="100px" height="30px" />);
    const skeleton = container.querySelector('.skeleton');
    
    expect(skeleton).toHaveStyle({ width: '100px', height: '30px' });
  });

  it('filters out undefined className', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton');
    
    expect(skeleton?.className.trim()).toBe('skeleton');
  });
});

describe('SkeletonText', () => {
  it('renders single line by default', () => {
    const { container } = render(<SkeletonText />);
    const skeletons = container.querySelectorAll('.skeleton-text');
    
    expect(skeletons).toHaveLength(1);
  });

  it('has correct accessibility attributes', () => {
    render(<SkeletonText />);
    
    const wrapper = screen.getByRole('status');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading content');
  });

  it('renders multiple lines when specified', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const skeletons = container.querySelectorAll('.skeleton-text');
    
    expect(skeletons).toHaveLength(3);
  });

  it('applies full width to non-last lines', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const skeletons = container.querySelectorAll('.skeleton-text');
    
    expect(skeletons[0]).toHaveStyle({ width: '100%' });
    expect(skeletons[1]).toHaveStyle({ width: '100%' });
  });

  it('applies 60% width to last line', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const skeletons = container.querySelectorAll('.skeleton-text');
    
    expect(skeletons[2]).toHaveStyle({ width: '60%' });
  });

  it('applies 60% width to single line', () => {
    const { container } = render(<SkeletonText lines={1} />);
    const skeleton = container.querySelector('.skeleton-text');
    
    expect(skeleton).toHaveStyle({ width: '60%' });
  });

  it('applies custom className to wrapper', () => {
    const { container } = render(<SkeletonText className="custom-text" />);
    const wrapper = container.querySelector('.skeleton-text-wrapper');
    
    expect(wrapper).toHaveClass('skeleton-text-wrapper');
    expect(wrapper).toHaveClass('custom-text');
  });

  it('applies skeleton class to each line', () => {
    const { container } = render(<SkeletonText lines={2} />);
    const skeletons = container.querySelectorAll('.skeleton-text');
    
    skeletons.forEach(skeleton => {
      expect(skeleton).toHaveClass('skeleton');
      expect(skeleton).toHaveClass('skeleton-text');
    });
  });

  it('renders with zero lines', () => {
    const { container } = render(<SkeletonText lines={0} />);
    const skeletons = container.querySelectorAll('.skeleton-text');
    
    expect(skeletons).toHaveLength(0);
  });

  it('filters out undefined className from wrapper', () => {
    const { container } = render(<SkeletonText />);
    const wrapper = container.querySelector('.skeleton-text-wrapper');
    
    expect(wrapper?.className.trim()).toBe('skeleton-text-wrapper');
  });
});
