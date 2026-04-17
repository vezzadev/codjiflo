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
export async function fetchFileContent(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  // Skip binary files up-front. GitHub returns encoding='base64' for ALL files
  // under 1MB (text and binary alike), so we cannot rely on the encoding field
  // to detect binaries. Decoding binary bytes as UTF-8 produces mojibake.
  if (isBinaryFile(path)) {
    return null;
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    // Handle file (not directory)
    if ('content' in data && data.type === 'file') {
      // Check if binary
      if (data.encoding !== 'base64') {
        return null;
      }

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return content;
    }

    return null;
  } catch (error) {
    // File not found at this ref
    if ((error as { status?: number }).status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if a file is likely binary based on extension.
 */
export function isBinaryFile(filename: string): boolean {
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.db', '.sqlite', '.sqlite3',
  ];

  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return binaryExtensions.includes(ext);
}
