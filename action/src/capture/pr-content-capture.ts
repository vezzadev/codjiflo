/**
 * PR Content Capture
 *
 * Captures and pre-renders PR description and review comments.
 * Content is stored as both source markdown and rendered HTML for
 * efficient frontend display without client-side markdown processing.
 */

import * as github from '@actions/github';
import type { IterationDatabase, PRCommentInput } from '../db/database';
import { renderMarkdownSync } from '../markdown';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ContentCaptureContext {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  prNumber: number;
}

interface GitHubReviewComment {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  } | null;
  body: string;
  path?: string;
  line?: number | null;
  side?: 'LEFT' | 'RIGHT';
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
}

// ============================================================================
// Capture Functions
// ============================================================================

/**
 * Capture PR description and render to HTML.
 */
export async function capturePRDescription(
  db: IterationDatabase,
  ctx: ContentCaptureContext,
  iterationId: number
): Promise<void> {
  const repository = `${ctx.owner}/${ctx.repo}`;

  try {
    // Fetch PR details
    const { data: pr } = await ctx.octokit.rest.pulls.get({
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.prNumber,
    });

    const sourceMd = pr.body ?? '';
    const renderedHtml = renderMarkdownSync(sourceMd, { repository });

    db.insertPRDescription(iterationId, sourceMd, renderedHtml);

    logger.info({
      event: 'pr_description_captured',
      'pr.number': ctx.prNumber,
      'content.source_length': sourceMd.length,
      'content.rendered_length': renderedHtml.length,
    }, 'PR description captured and rendered');
  } catch (error) {
    logger.error({
      event: 'pr_description_capture_failed',
      'pr.number': ctx.prNumber,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to capture PR description');
    throw error;
  }
}

/**
 * Capture all review comments and render to HTML.
 */
export async function capturePRComments(
  db: IterationDatabase,
  ctx: ContentCaptureContext,
  iterationId: number
): Promise<void> {
  const repository = `${ctx.owner}/${ctx.repo}`;

  try {
    // Fetch all review comments with pagination
    const comments = await ctx.octokit.paginate(
      ctx.octokit.rest.pulls.listReviewComments,
      {
        owner: ctx.owner,
        repo: ctx.repo,
        pull_number: ctx.prNumber,
        per_page: 100,
      }
    ) as GitHubReviewComment[];

    if (comments.length === 0) {
      logger.info({
        event: 'pr_comments_none',
        'pr.number': ctx.prNumber,
      }, 'No review comments to capture');
      return;
    }

    // Transform and render each comment
    const commentInputs: PRCommentInput[] = comments.map((comment) => {
      const sourceMd = comment.body ?? '';
      const renderedHtml = renderMarkdownSync(sourceMd, { repository });

      return {
        github_id: comment.id,
        author_login: comment.user?.login ?? 'ghost',
        author_avatar_url: comment.user?.avatar_url,
        file_path: comment.path,
        line_number: comment.line ?? undefined,
        side: comment.side as 'LEFT' | 'RIGHT' | undefined,
        source_md: sourceMd,
        rendered_html: renderedHtml,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        in_reply_to_id: comment.in_reply_to_id,
      };
    });

    // Bulk insert all comments
    db.insertPRComments(iterationId, commentInputs);

    logger.info({
      event: 'pr_comments_captured',
      'pr.number': ctx.prNumber,
      'comments.count': comments.length,
    }, `Captured ${comments.length} review comments`);
  } catch (error) {
    logger.error({
      event: 'pr_comments_capture_failed',
      'pr.number': ctx.prNumber,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to capture PR comments');
    throw error;
  }
}

/**
 * Capture both PR description and comments.
 */
export async function capturePRContent(
  db: IterationDatabase,
  ctx: ContentCaptureContext,
  iterationId: number
): Promise<void> {
  await Promise.all([
    capturePRDescription(db, ctx, iterationId),
    capturePRComments(db, ctx, iterationId),
  ]);
}
