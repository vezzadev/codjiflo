'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { usePRStore } from '@/features/pr';
import { useDiffStore, FileList, DiffView } from '@/features/diff';
import { useKeyboardShortcuts, ShortcutsModal } from '@/features/keyboard';
import { useCommentsStore } from '@/features/comments';
import { useRequireAuth } from '@/features/auth/hooks';
import {
  useIterationStore,
  IterationSelector,
  DegradedModeBanner,
} from '@/features/iterations';

interface PRPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    number: string;
  }>;
}

export default function PullRequestPage({ params }: PRPageProps) {
  const { owner, repo, number } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading } = useRequireAuth();

  const { loadPR, reset: resetPR } = usePRStore();
  const { loadFiles, reset: resetDiff } = useDiffStore();
  const { loadThreads, reset: resetComments } = useCommentsStore();
  const { loadIterations, reset: resetIterations } = useIterationStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts();

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

  const handleBackToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!owner || !repo || !number) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid URL</h1>
          <p className="text-gray-600 mb-4">Missing required parameters</p>
          <button
            onClick={handleBackToDashboard}
            className="text-blue-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-2 flex items-center gap-4 shrink-0">
        <button
          onClick={handleBackToDashboard}
          className="text-gray-600 hover:text-gray-900"
          aria-label="Back to dashboard"
        >
          ← Back
        </button>
        <span className="text-sm text-gray-500 truncate">
          {owner}/{repo}#{number}
        </span>
        <button
          onClick={() => setShowShortcuts(true)}
          className="ml-auto text-sm text-gray-500 hover:text-gray-900"
          aria-label="Show keyboard shortcuts"
        >
          ? Shortcuts
        </button>
      </header>

      <DegradedModeBanner />

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 shrink-0 flex flex-col bg-white border-r overflow-hidden">
          <IterationSelector className="shrink-0 border-b" />
          <div className="flex-1 overflow-y-auto">
            <FileList />
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <DiffView />
        </main>
      </div>

      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
