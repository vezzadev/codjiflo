import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { PRMetadata } from './PRMetadata';
import { createMockReview } from '@/tests/factories';
import { ReviewState } from '@/api/types';

describe('PRMetadata', () => {
  it('displays PR title as h1', () => {
    const pr = createMockReview({ title: 'Feature: Add new button' });

    render(<PRMetadata pr={pr} />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Feature: Add new button');
  });

  it('displays author name and avatar', () => {
    const pr = createMockReview({
      author: {
        id: '1',
        displayName: 'johndoe',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    });

    render(<PRMetadata pr={pr} />);

    expect(screen.getByText('johndoe')).toBeInTheDocument();
    const avatar = screen.getByRole('img', { name: /johndoe's avatar/i });
    // Next.js Image transforms the src to an optimized URL
    expect(avatar.getAttribute('src')).toContain('avatar.jpg');
  });

  it('displays state badge with correct state', () => {
    const pr = createMockReview({ state: ReviewState.Open });

    render(<PRMetadata pr={pr} />);

    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('displays source and target branches', () => {
    const pr = createMockReview({
      sourceBranch: 'feature/new-component',
      targetBranch: 'develop',
    });

    render(<PRMetadata pr={pr} />);

    expect(screen.getByText('feature/new-component')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('into')).toBeInTheDocument();
  });

  it('displays link to GitHub next to title', () => {
    const pr = createMockReview({
      htmlUrl: 'https://github.com/test/repo/pull/42',
    });

    render(<PRMetadata pr={pr} />);

    const link = screen.getByRole('link', { name: /View on GitHub/i });
    expect(link).toHaveTextContent('(View on GitHub)');
    expect(link).toHaveAttribute('href', 'https://github.com/test/repo/pull/42');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
