export type CommentSide = "LEFT" | "RIGHT";

export interface CommentAuthor {
  id: string;
  login: string;
  avatarUrl: string;
}

/**
 * Selection range for multi-line or sub-line comments.
 * GitHub API supports start_line/line for multi-line, but not column-level.
 * We store column info for rich UI rendering but fall back to line-level for GitHub persistence.
 */
export interface CommentRegion {
  /** Start line number (1-based) */
  startLine: number;
  /** End line number (1-based, inclusive) */
  endLine: number;
  /** Start column within start line (0-based), undefined for full-line selection */
  startColumn?: number;
  /** End column within end line (0-based, exclusive), undefined for full-line selection */
  endColumn?: number;
}

/**
 * Create a single-line region
 */
export function singleLineRegion(line: number): CommentRegion {
  return { startLine: line, endLine: line };
}

/**
 * Create a multi-line region
 */
export function multiLineRegion(startLine: number, endLine: number): CommentRegion {
  return { startLine, endLine };
}

/**
 * Create a sub-line (character-level) region
 */
export function subLineRegion(
  line: number,
  startColumn: number,
  endColumn: number
): CommentRegion {
  return { startLine: line, endLine: line, startColumn, endColumn };
}

/**
 * Check if a region spans multiple lines
 */
export function isMultiLineRegion(region: CommentRegion): boolean {
  return region.endLine > region.startLine;
}

/**
 * Check if a region has column-level selection
 */
export function hasColumnSelection(region: CommentRegion): boolean {
  return region.startColumn !== undefined || region.endColumn !== undefined;
}

export interface Comment {
  id: string;
  body: string;
  author: CommentAuthor;
  createdAt: Date;
  updatedAt: Date;
  path: string;
  /** Line number, or null if comment is outdated/unmappable */
  line: number | null;
  side: CommentSide;
  position: number | null;
  inReplyTo?: string;
  isPending?: boolean;
  /** Line number when comment was created (for outdated comments) */
  originalLine: number | null;
  /** Commit SHA when comment was originally created */
  originalCommitId: string | null;
  /** Region selection for multi-line/sub-line comments (optional, for rich UI) */
  region?: CommentRegion;
}

export interface ReviewThread {
  id: string;
  path: string;
  /** Line number, or null if thread is outdated/unmappable */
  line: number | null;
  side: CommentSide;
  comments: Comment[];
  isResolved: boolean;
  /** Line number when thread was created (from root comment) */
  originalLine: number | null;
  /** Commit SHA when thread was created */
  originalCommitId: string | null;
  /** Computed current position via SpanTracker (null if not tracked or deleted) */
  trackedLine: number | null;
  /** Region selection for multi-line/sub-line threads (optional, for rich UI) */
  region?: CommentRegion;
}
