/**
 * Comment Manager
 *
 * Manages the CodjiFlo data comment on PRs.
 */
import * as github from '@actions/github';
interface CommentData {
    iterationCount: number;
    artifactName: string;
    runId: number;
    timestamp: string;
}
/**
 * Create or update the CodjiFlo data comment on the PR.
 */
export declare function updatePRComment(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, prNumber: number, data: CommentData): Promise<void>;
/**
 * Get the artifact name from the existing PR comment.
 * Returns null if no comment exists or artifact name is not found.
 */
export declare function getArtifactNameFromComment(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, prNumber: number): Promise<string | null>;
export {};
//# sourceMappingURL=comment-manager.d.ts.map