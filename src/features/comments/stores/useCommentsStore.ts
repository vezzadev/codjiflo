/**
 * Comments Store
 *
 * Manages comment state for pull request review threads.
 * Handles loading, adding, editing, deleting comments and thread resolution.
 */

import { create } from 'zustand';
import { githubClient, GitHubAPIError } from '@/api/github/github-client';
import type { GitHubReviewComment } from '@/api/github/types';
import type { Comment, CommentAuthor, CommentSide, ReviewThread } from '../types';

interface CommentsState {
  threads: ReviewThread[];
  isLoading: boolean;
  error: string | null;
  announcement: string;
  currentUser: CommentAuthor;
  loadThreads: (owner: string, repo: string, number: number) => Promise<void>;
  addComment: (payload: {
    path: string;
    line: number;
    side: CommentSide;
    body: string;
    position: number | null;
  }) => Promise<void>;
  addReply: (threadId: string, body: string) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleResolved: (threadId: string) => void;
  clearError: () => void;
  clearAnnouncement: () => void;
  reset: () => void;
}

const DEFAULT_CURRENT_USER: CommentAuthor = {
  id: 'local-user',
  login: 'you',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
};

let localIdCounter = 0;

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Fallback with improved entropy using multiple random values, high-precision time, and counter
  const timePart = Date.now().toString(16);
  const perfPart =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.floor(performance.now() * 1000).toString(16)
      : '';
  const randomPart = `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const counterPart = (localIdCounter++).toString(16);

  return `${timePart}-${perfPart}-${randomPart}-${counterPart}`;
};

const mapGitHubComment = (comment: GitHubReviewComment): Comment => ({
  id: comment.id.toString(),
  body: comment.body,
  author: {
    id: comment.user.id.toString(),
    login: comment.user.login,
    avatarUrl: comment.user.avatar_url,
  },
  createdAt: new Date(comment.created_at),
  updatedAt: new Date(comment.updated_at),
  path: comment.path,
  line: comment.line ?? 0,
  side: comment.side,
  position: comment.position,
  ...(comment.in_reply_to_id != null
    ? { inReplyTo: comment.in_reply_to_id.toString() }
    : {}),
});

const groupCommentsIntoThreads = (comments: GitHubReviewComment[]): ReviewThread[] => {
  const commentMap = new Map<number, GitHubReviewComment>();
  comments.forEach((comment) => commentMap.set(comment.id, comment));

  const rootCache = new Map<number, number>();
  const getRootId = (comment: GitHubReviewComment): number => {
    if (rootCache.has(comment.id)) {
      return rootCache.get(comment.id) ?? comment.id;
    }
    let current: GitHubReviewComment = comment;
    while (current.in_reply_to_id && commentMap.has(current.in_reply_to_id)) {
      current = commentMap.get(current.in_reply_to_id) ?? current;
    }
    rootCache.set(comment.id, current.id);
    return current.id;
  };

  const threadMap = new Map<number, ReviewThread>();
  comments.forEach((comment) => {
    const rootId = getRootId(comment);
    const thread = threadMap.get(rootId);
    const mapped = mapGitHubComment(comment);

    if (thread) {
      thread.comments.push(mapped);
      return;
    }

    threadMap.set(rootId, {
      id: String(rootId),
      path: comment.path,
      line: comment.line ?? 0,
      side: comment.side,
      comments: [mapped],
      isResolved: false,
    });
  });

  return Array.from(threadMap.values()).map((thread) => ({
    ...thread,
    comments: [...thread.comments].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    ),
  }));
};

export const useCommentsStore = create<CommentsState>((set, get) => ({
  threads: [],
  isLoading: false,
  error: null,
  announcement: '',
  currentUser: DEFAULT_CURRENT_USER,

  loadThreads: async (owner, repo, number) => {
    set({ isLoading: true, error: null });
    try {
      const data = await githubClient.fetch<GitHubReviewComment[]>(
        `/repos/${owner}/${repo}/pulls/${String(number)}/comments`
      );
      set({ threads: groupCommentsIntoThreads(data), isLoading: false });
    } catch (err) {
      let message = `Unable to load comments for pull request #${String(number)} in ${owner}/${repo}`;
      if (err instanceof GitHubAPIError) {
        message = `${message}: ${err.message}`;
      } else if (err instanceof Error) {
        message = `${message}: ${err.message}`;
      }
      set({ error: message, isLoading: false });
    }
  },

  addComment: ({ path, line, side, body, position }) => {
    const { threads, currentUser } = get();
    const newComment: Comment = {
      id: createLocalId(),
      body,
      author: currentUser,
      createdAt: new Date(),
      updatedAt: new Date(),
      path,
      line,
      side,
      position,
    };

    const existingThreadIndex = threads.findIndex(
      (thread) => thread.path === path && thread.line === line && thread.side === side
    );

    if (existingThreadIndex >= 0) {
      const updatedThreads = threads.map((thread, index) =>
        index === existingThreadIndex
          ? { ...thread, comments: [...thread.comments, newComment] }
          : thread
      );
      set({ threads: updatedThreads, announcement: 'Comment posted.' });
      return Promise.resolve();
    }

    set({
      threads: [
        ...threads,
        {
          id: createLocalId(),
          path,
          line,
          side,
          comments: [newComment],
          isResolved: false,
        },
      ],
      announcement: 'Comment posted.',
    });
    return Promise.resolve();
  },

  addReply: (threadId, body) => {
    const { threads, currentUser } = get();
    const updatedThreads = threads.map((thread) => {
      if (thread.id !== threadId) {
        return thread;
      }
      const lastComment = thread.comments[thread.comments.length - 1];
      const newComment: Comment = {
        id: createLocalId(),
        body,
        author: currentUser,
        createdAt: new Date(),
        updatedAt: new Date(),
        path: thread.path,
        line: thread.line,
        side: thread.side,
        position: lastComment?.position ?? null,
        ...(lastComment?.id ? { inReplyTo: lastComment.id } : {}),
      };
      return { ...thread, comments: [...thread.comments, newComment] };
    });

    set({ threads: updatedThreads, announcement: 'Reply posted.' });
    return Promise.resolve();
  },

  editComment: (commentId, body) => {
    const { threads } = get();
    const updatedThreads = threads.map((thread) => ({
      ...thread,
      comments: thread.comments.map((comment) =>
        comment.id === commentId
          ? { ...comment, body, updatedAt: new Date() }
          : comment
      ),
    }));

    set({ threads: updatedThreads, announcement: 'Comment updated.' });
    return Promise.resolve();
  },

  deleteComment: (commentId) => {
    const { threads } = get();
    const updatedThreads = threads
      .map((thread) => ({
        ...thread,
        comments: thread.comments.filter((comment) => comment.id !== commentId),
      }))
      .filter((thread) => thread.comments.length > 0);

    set({ threads: updatedThreads, announcement: 'Comment deleted.' });
    return Promise.resolve();
  },

  toggleResolved: (threadId) => {
    const { threads } = get();
    set({
      threads: threads.map((thread) =>
        thread.id === threadId ? { ...thread, isResolved: !thread.isResolved } : thread
      ),
    });
  },

  clearError: () => set({ error: null }),
  clearAnnouncement: () => set({ announcement: '' }),
  reset: () =>
    set({
      threads: [],
      isLoading: false,
      error: null,
      announcement: '',
    }),
}));
