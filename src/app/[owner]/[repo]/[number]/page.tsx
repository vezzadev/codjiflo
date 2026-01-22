'use client';

import { useEffect, useState, useCallback, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Keyboard } from 'lucide-react';
import { usePRStore, useDocumentTitle } from '@/features/pr';
import { useDiffStore, FileList, DiffView, parsePatch } from '@/features/diff';
import { useKeyboardShortcuts, ShortcutsModal } from '@/features/keyboard';
import {
  useSearchKeyboardShortcuts,
  useSearchStore,
  FindInAllFilesModal,
  SearchResultsPanel,
  searchInDiffLines,
  matchesFileFilter,
} from '@/features/search';
import type { FileSearchResult, SearchMatch } from '@/features/search';
import { useCommentsStore } from '@/features/comments';
import { useRequireAuth } from '@/features/auth/hooks';
import {
  useIterationStore,
  DegradedModeBanner,
} from '@/features/iterations';
import {
  AppShell,
  Titlebar,
  LeftPane,
  MainContent,
  BottomPane,
  ResizeHandle,
} from '@/components/layout';
import { useLayoutStore } from '@/stores/useLayoutStore';

interface PRPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    number: string;
  }>;
}

function PullRequestContent({ params }: PRPageProps) {
  const { owner, repo, number } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading } = useRequireAuth();

  const { currentPR, loadPR, reset: resetPR } = usePRStore();
  const { loadFiles, reset: resetDiff } = useDiffStore();
  const { threads, loadThreads, reset: resetComments } = useCommentsStore();
  const { loadIterations, reset: resetIterations } = useIterationStore();
  const { leftPaneWidth, resizeLeftPane, bottomPaneHeight, resizeBottomPane } = useLayoutStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Search state
  const searchMode = useSearchStore((s) => s.mode);
  const showResultsPanel = useSearchStore((s) => s.showResultsPanel);
  const allFilesResults = useSearchStore((s) => s.allFilesResults);
  const closeSearch = useSearchStore((s) => s.close);
  const searchQuery = useSearchStore((s) => s.query);
  const searchOptions = useSearchStore((s) => s.options);
  const fileFilter = useSearchStore((s) => s.fileFilter);
  const fileFilterUseRegex = useSearchStore((s) => s.fileFilterUseRegex);
  const sideFilter = useSearchStore((s) => s.sideFilter);
  const setAllFilesResults = useSearchStore((s) => s.setAllFilesResults);
  const setIsSearching = useSearchStore((s) => s.setIsSearching);

  // Files for search
  const files = useDiffStore((s) => s.files);

  useKeyboardShortcuts();
  useSearchKeyboardShortcuts();

  // Handle search execution across all files
  const handleExecuteSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      closeSearch();
      return;
    }

    setIsSearching(true);

    // Search across all files
    const results: FileSearchResult[] = [];

    for (const file of files) {
      // Apply file filter
      if (!matchesFileFilter(file.filename, fileFilter, fileFilterUseRegex)) {
        continue;
      }

      // Parse the patch to get diff lines
      const diffLines = parsePatch(file.patch);

      // Convert ParsedDiffLine to format expected by searchInDiffLines
      const searchableDiffLines = diffLines.map((line) => ({
        content: line.content,
        type: line.type === 'addition' ? 'add' : line.type === 'deletion' ? 'delete' : line.type,
      }));

      // Search in diff lines
      const matches: SearchMatch[] = searchInDiffLines(
        searchQuery,
        searchableDiffLines,
        searchOptions,
        sideFilter
      );

      if (matches.length > 0) {
        results.push({
          path: file.filename,
          matches,
        });
      }
    }

    setAllFilesResults(results);
    setIsSearching(false);
    closeSearch();
  }, [searchQuery, files, fileFilter, fileFilterUseRegex, searchOptions, sideFilter, closeSearch, setAllFilesResults, setIsSearching]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement) &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          setShowShortcuts(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!owner || !repo || !number) return;

    const prNumber = parseInt(number, 10);
    if (isNaN(prNumber)) return;

    void loadPR(owner, repo, prNumber);
    void loadFiles(owner, repo, prNumber);
    void loadThreads(owner, repo, prNumber);
    void loadIterations(owner, repo, prNumber);

    return () => {
      resetPR();
      resetDiff();
      resetComments();
      resetIterations();
    };
  }, [owner, repo, number, loadPR, loadFiles, loadThreads, loadIterations, resetPR, resetDiff, resetComments, resetIterations]);

  useDocumentTitle({ currentPR, owner, repo, number });

  const handleBackToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="diff-placeholder">
          <p>Loading...</p>
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!owner || !repo || !number) {
    return (
      <AppShell>
        <div className="diff-placeholder">
          <p style={{ color: 'var(--error-fg)', fontWeight: 'bold' }}>Invalid URL</p>
          <p style={{ color: 'var(--control-disabled-fg)' }}>Missing required parameters</p>
          <button onClick={handleBackToDashboard} className="btn-link" style={{ marginTop: '16px' }}>
            Back to Dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  // Get PR title for titlebar
  const prTitle = currentPR?.title ?? `${owner}/${repo}#${number}`;

  // Bottom pane tabs configuration
  const bottomPaneTabs = [
    {
      id: 'comments',
      label: `Comments (${String(threads.length)})`,
      content: (
        <div className="comments-list">
          {threads.length === 0 ? (
            <p style={{ color: 'var(--control-disabled-fg)', padding: '16px' }}>
              No comments yet
            </p>
          ) : (
            threads.slice(0, 10).map((thread) => (
              <div key={thread.id} className={`comment-item ${thread.isResolved ? 'resolved' : ''}`}>
                <span className="comment-author">{thread.comments[0]?.author.login}</span>
                <span className="comment-time">
                  {thread.comments[0]?.createdAt.toLocaleDateString()}
                </span>
                <p className="comment-text">{thread.comments[0]?.body.slice(0, 100)}...</p>
                {thread.isResolved && <span className="badge badge-success">Resolved</span>}
              </div>
            ))
          )}
        </div>
      ),
    },
    {
      id: 'activity',
      label: 'Activity',
      content: (
        <div style={{ padding: '16px', color: 'var(--control-disabled-fg)' }}>
          Activity feed coming soon
        </div>
      ),
    },
    // Search results tab - only shown when there are search results
    ...(showResultsPanel ? [{
      id: 'search-results',
      label: `Search Results (${allFilesResults.reduce((sum, r) => sum + r.matches.length, 0)} in ${allFilesResults.length} files)`,
      content: <SearchResultsPanel />,
    }] : []),
  ];

  return (
    <AppShell>
      <Titlebar
        title={prTitle}
        githubUrl={currentPR?.htmlUrl}
        leftContent={
          <button
            onClick={handleBackToDashboard}
            className="btn-nav"
            aria-label="Back to dashboard"
            style={{ marginLeft: '8px' }}
          >
            <ArrowLeft size={16} />
          </button>
        }
        rightContent={
          <button
            onClick={() => setShowShortcuts(true)}
            className="btn-nav"
            aria-label="Show keyboard shortcuts"
            style={{ marginRight: '8px' }}
          >
            <Keyboard size={16} />
          </button>
        }
      />

      <DegradedModeBanner />

      <div className="main-layout" style={{ gridTemplateColumns: `${String(leftPaneWidth)}px 1fr` }}>
        <LeftPane>
          <FileList />
          <ResizeHandle direction="horizontal" onResize={resizeLeftPane} />
        </LeftPane>

        <MainContent>
          <DiffView />
        </MainContent>
      </div>

      <>
        <ResizeHandle direction="vertical" onResize={resizeBottomPane} />
        <BottomPane tabs={bottomPaneTabs} defaultTab="comments" height={bottomPaneHeight} />
      </>

      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      <FindInAllFilesModal
        isOpen={searchMode === 'all-files'}
        onClose={closeSearch}
        onSearch={handleExecuteSearch}
      />
    </AppShell>
  );
}

function LoadingFallback() {
  return (
    <AppShell>
      <div className="diff-placeholder">
        <p>Loading...</p>
      </div>
    </AppShell>
  );
}

export default function PullRequestPage({ params }: PRPageProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PullRequestContent params={params} />
    </Suspense>
  );
}
