import { githubClient, GitHubAPIError } from './github-client';
import type { IFileBackend, FileChange, RawFileContent } from '../types';
import { FileChangeStatus } from '../types';
import type { GitHubFile, GitHubContentsResponse } from './types';

/** Maximum file size for content fetching (1MB) */
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

/**
 * GitHub implementation of IFileBackend
 * Transforms GitHub API responses to platform-agnostic FileChange type
 */
export class GitHubFileBackend implements IFileBackend {
  async getFiles(owner: string, repo: string, number: number): Promise<FileChange[]> {
    // Fetch all pages of files (GitHub API paginates at 30 by default, max 100 per page)
    const allFiles: GitHubFile[] = [];
    let page = 1;
    const perPage = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      const data = await githubClient.fetch<GitHubFile[]>(
        `/repos/${owner}/${repo}/pulls/${number}/files?per_page=${perPage}&page=${page}`
      );

      allFiles.push(...data);

      // If we got fewer files than requested, we've reached the last page
      hasMorePages = data.length === perPage;
      page++;
    }

    return allFiles.map((file): FileChange => {
      const result: FileChange = {
        filename: file.filename,
        status: this.mapStatus(file.status),
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch ?? '',
      };
      if (file.previous_filename) {
        result.previousFilename = file.previous_filename;
      }
      return result;
    });
  }

  /**
   * Fetch raw file content at a specific ref (S-3.1)
   * AC-3.1.1: Fetches complete file content via GitHub API
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<RawFileContent> {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const data = await githubClient.fetch<GitHubContentsResponse>(
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
    );

    // Handle directory type (shouldn't happen for file requests)
    if (data.type !== 'file') {
      throw new GitHubAPIError(
        400,
        'Bad Request',
        `Expected file but got ${data.type} at path: ${path}`
      );
    }

    // Check file size
    if (data.size > MAX_FILE_SIZE_BYTES) {
      throw new GitHubAPIError(
        413,
        'Payload Too Large',
        `File too large (${data.size} bytes). Maximum: ${MAX_FILE_SIZE_BYTES} bytes`
      );
    }

    // Decode base64 content
    let content = '';
    let encoding: RawFileContent['encoding'] = 'utf-8';

    if (data.content && data.encoding === 'base64') {
      try {
        // Handle base64 content with line breaks
        const cleanBase64 = data.content.replace(/\n/g, '');
        content = atob(cleanBase64);
        encoding = 'utf-8';
      } catch (error) {
        // If decoding fails, the base64 content is invalid and should not be treated as valid binary
        throw new GitHubAPIError(
          500,
          'Internal Server Error',
          `Failed to decode base64 content for path: ${path}. ${(error as Error).message}`
        );
      }
    } else if (data.content) {
      content = data.content;
    } else {
      encoding = 'none';
    }

    return {
      path: data.path,
      sha: data.sha,
      content,
      size: data.size,
      encoding,
    };
  }

  private mapStatus(status: GitHubFile['status']): FileChangeStatus {
    switch (status) {
      case 'added':
        return FileChangeStatus.Added;
      case 'removed':
        return FileChangeStatus.Deleted;
      case 'renamed':
        return FileChangeStatus.Renamed;
      default:
        return FileChangeStatus.Modified;
    }
  }
}
