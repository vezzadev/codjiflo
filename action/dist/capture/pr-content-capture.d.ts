/**
 * PR Content Capture
 *
 * Captures and pre-renders PR description and review comments.
 * Content is stored as both source markdown and rendered HTML for
 * efficient frontend display without client-side markdown processing.
 */
import * as github from '@actions/github';
import type { IterationDatabase } from '../db/database';
interface ContentCaptureContext {
    octokit: ReturnType<typeof github.getOctokit>;
    owner: string;
    repo: string;
    prNumber: number;
}
/**
 * Capture PR description and render to HTML.
 */
export declare function capturePRDescription(db: IterationDatabase, ctx: ContentCaptureContext, iterationId: number): Promise<void>;
/**
 * Capture all review comments and render to HTML.
 */
export declare function capturePRComments(db: IterationDatabase, ctx: ContentCaptureContext, iterationId: number): Promise<void>;
/**
 * Capture both PR description and comments.
 */
export declare function capturePRContent(db: IterationDatabase, ctx: ContentCaptureContext, iterationId: number): Promise<void>;
export {};
//# sourceMappingURL=pr-content-capture.d.ts.map