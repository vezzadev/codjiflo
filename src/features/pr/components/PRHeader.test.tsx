import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/helpers';
import { PRHeader } from './PRHeader';
import { usePRStore } from '../stores';
import { ReviewState } from '@/api/types';

vi.mock('../stores', () => ({
  usePRStore: vi.fn(),
}));

describe('PRHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error state', () => {
    vi.mocked(usePRStore).mockReturnValue({
      currentPR: null,
      isLoading: false,
      error: { message: 'Failed to load PR', kind: 'generic' as const },
    });

    render(<PRHeader />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load PR')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(usePRStore).mockReturnValue({
      currentPR: null,
      isLoading: true,
      error: null,
    });

    render(<PRHeader />);

    // Check for skeleton elements
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('shows loading state when PR is null', () => {
    vi.mocked(usePRStore).mockReturnValue({
      currentPR: null,
      isLoading: false,
      error: null,
    });

    render(<PRHeader />);

    // Should show loading skeleton when no PR
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('renders PR metadata and description when loaded', () => {
    vi.mocked(usePRStore).mockReturnValue({
      currentPR: {
        id: 1,
        number: 123,
        title: 'Test PR Title',
        description: '## Description\n\nThis is a test PR.',
        state: ReviewState.Open,
        author: {
          id: '1',
          displayName: 'testuser',
          avatarUrl: 'https://example.com/avatar.png',
        },
        sourceBranch: 'feature-branch',
        targetBranch: 'main',
        htmlUrl: 'https://github.com/owner/repo/pull/123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isLoading: false,
      error: null,
    });

    render(<PRHeader />);

    expect(screen.getByRole('heading', { name: /Test PR Title/i })).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });
});
