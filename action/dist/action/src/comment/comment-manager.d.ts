/**
 * Comment Manager
 *
 * Manages the CodjiFlo data comment on PRs.
 */
import * as github from '@actions/github';
interface CommentData {
    iterationCount: number;
    runId: number;
    timestamp: string;
}
/**
 * Create or update the CodjiFlo data comment on the PR.
 */
export declare function updatePRComment(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, prNumber: number, data: CommentData): Promise<void>;
/**
 * Get the artifact ID from the existing PR comment.
 * Returns null if no comment exists or artifact ID is not found.
 */
export declare function getArtifactIdFromComment(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, prNumber: number): Promise<number | null>;
/**
 * Update PR description to include CodjiFlo review link.
 * Appends the link if not present, or updates existing link.
 */
export declare function updatePRDescription(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, prNumber: number): Promise<void>;
export {};
//# sourceMappingURL=comment-manager.d.ts.map