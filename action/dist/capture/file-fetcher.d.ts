/**
 * File Content Fetcher
 *
 * Fetches file content from GitHub at specific refs.
 */
import * as github from '@actions/github';
/**
 * Fetch file content from GitHub at a specific ref.
 * Returns null for binary files or if file doesn't exist.
 */
export declare function fetchFileContent(octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, path: string, ref: string): Promise<string | null>;
/**
 * Check if a file is likely binary based on extension.
 */
export declare function isBinaryFile(filename: string): boolean;
//# sourceMappingURL=file-fetcher.d.ts.map