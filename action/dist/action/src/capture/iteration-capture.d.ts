/**
 * Iteration Capture Logic
 *
 * Captures PR iteration data from GitHub event payload.
 */
import * as github from '@actions/github';
import type { IterationDatabase } from '../db/database';
interface CaptureContext {
    octokit: ReturnType<typeof github.getOctokit>;
    owner: string;
    repo: string;
    prNumber: number;
    headSha: string;
    baseSha: string;
    beforeSha: string | null;
}
/**
 * Capture a new iteration from PR event.
 */
export declare function captureIteration(db: IterationDatabase, ctx: CaptureContext): Promise<number>;
/**
 * Get capture context from GitHub event or environment variable.
 * Supports both pull_request events and workflow_dispatch triggers.
 */
export declare function getCaptureContext(octokit: ReturnType<typeof github.getOctokit>): Promise<CaptureContext | null>;
export {};
//# sourceMappingURL=iteration-capture.d.ts.map