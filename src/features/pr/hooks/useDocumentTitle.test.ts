import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle';
import { createMockReview, createMockAuthor } from '@/tests/factories';
import { Review } from '@/api/types';

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = '';
  });

  it('sets title with PR info when currentPR is loaded', () => {
    const mockPR = createMockReview({
      number: 42,
      title: 'Fix authentication bug',
      author: createMockAuthor({ displayName: 'johndoe' }),
    });

    renderHook(() =>
      useDocumentTitle({
        currentPR: mockPR,
        owner: 'facebook',
        repo: 'react',
        number: '42',
      })
    );

    expect(document.title).toBe(
      'Fix authentication bug by johndoe · PR #42 · facebook/react'
    );
  });

  it('sets fallback title when currentPR is null', () => {
    renderHook(() =>
      useDocumentTitle({
        currentPR: null,
        owner: 'facebook',
        repo: 'react',
        number: '123',
      })
    );

    expect(document.title).toBe('PR #123 · facebook/react');
  });

  it('updates title when currentPR changes', () => {
    const { rerender } = renderHook(
      ({ currentPR }: { currentPR: Review | null }) =>
        useDocumentTitle({
          currentPR,
          owner: 'owner',
          repo: 'repo',
          number: '1',
        }),
      { initialProps: { currentPR: null as Review | null } }
    );

    expect(document.title).toBe('PR #1 · owner/repo');

    const mockPR = createMockReview({
      number: 1,
      title: 'New feature',
      author: createMockAuthor({ displayName: 'alice' }),
    });

    rerender({ currentPR: mockPR });

    expect(document.title).toBe('New feature by alice · PR #1 · owner/repo');
  });
});
