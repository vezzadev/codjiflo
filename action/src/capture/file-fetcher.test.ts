/**
 * Tests for File Content Fetcher
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFileContent, isBinaryFile } from './file-fetcher';

describe('fetchFileContent', () => {
  let mockOctokit: any;
  const owner = 'testowner';
  const repo = 'testrepo';
  const ref = 'abc123';

  beforeEach(() => {
    mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn(),
        },
      },
    };
  });

  it('should return null for binary files (e.g. .png) even when GitHub returns base64-encoded content', async () => {
    // Arrange: GitHub returns encoding='base64' for ALL files <1MB, including binary files.
    // We simulate a real PNG's first bytes (PNG magic number 89 50 4E 47) base64-encoded.
    const binaryBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    mockOctokit.rest.repos.getContent.mockResolvedValue({
      data: {
        type: 'file',
        encoding: 'base64',
        content: binaryBytes.toString('base64'),
      },
    });

    // Act
    const result = await fetchFileContent(mockOctokit, owner, repo, 'assets/logo.png', ref);

    // Assert: binary files must be skipped (return null) to avoid mojibake from UTF-8 decoding.
    expect(result).toBeNull();
  });

  it('should return decoded content for text files', async () => {
    const text = 'hello world\nsecond line\n';
    mockOctokit.rest.repos.getContent.mockResolvedValue({
      data: {
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(text, 'utf-8').toString('base64'),
      },
    });

    const result = await fetchFileContent(mockOctokit, owner, repo, 'src/index.ts', ref);

    expect(result).toBe(text);
  });

  it('should return null when file is not found (404)', async () => {
    mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });

    const result = await fetchFileContent(mockOctokit, owner, repo, 'missing.ts', ref);

    expect(result).toBeNull();
  });
});

describe('isBinaryFile', () => {
  it('should identify common binary extensions', () => {
    expect(isBinaryFile('foo.png')).toBe(true);
    expect(isBinaryFile('path/to/font.woff2')).toBe(true);
    expect(isBinaryFile('data.sqlite')).toBe(true);
  });

  it('should not flag text files as binary', () => {
    expect(isBinaryFile('src/index.ts')).toBe(false);
    expect(isBinaryFile('README.md')).toBe(false);
  });
});
