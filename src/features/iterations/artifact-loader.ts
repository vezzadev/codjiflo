/**
 * Artifact Loader
 *
 * Discovers CodjiFlo PR comment, downloads artifact from GitHub Actions,
 * extracts SQLite database, and manages IndexedDB caching.
 */

import { githubClient, GitHubAPIError } from '@/api/github/github-client';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { SQLiteDatabase } from '@/lib/sqlite-wasm';
import JSZip from 'jszip';
import type { ArtifactReference } from './types';

// ============================================================================
// Constants
// ============================================================================

const COMMENT_MARKER = '<!-- codjiflo-data -->';
const CACHE_DB_NAME = 'codjiflo-artifacts';
const CACHE_STORE_NAME = 'artifacts';

// ============================================================================
// Types
// ============================================================================

interface IssueComment {
  id: number;
  body?: string;
  created_at: string;
  updated_at: string;
}

interface ArtifactResponse {
  id: number;
  name: string;
  archive_download_url: string;
}

interface ArtifactsListResponse {
  artifacts: ArtifactResponse[];
}

interface CachedArtifact {
  data: ArrayBuffer;
  timestamp: string;
}

// ============================================================================
// Artifact Loader Class
// ============================================================================

export class ArtifactLoader {
  private owner: string;
  private repo: string;
  private prNumber: number;

  constructor(owner: string, repo: string, prNumber: number) {
    this.owner = owner;
    this.repo = repo;
    this.prNumber = prNumber;
  }

  /**
   * Main entry point: Load the iteration artifact.
   * Returns the SQLite database if found, null if no artifact exists.
   */
  async load(): Promise<{ db: SQLiteDatabase; reference: ArtifactReference } | null> {
    // 1. Find the CodjiFlo comment
    const reference = await this.findArtifactReference();
    if (!reference) {
      return null;
    }

    // 2. Check IndexedDB cache
    const cached = await this.getCached();
    if (cached && cached.timestamp === reference.timestamp) {
      const db = await SQLiteDatabase.fromArrayBuffer(cached.data);
      return { db, reference };
    }

    // 3. Download the artifact
    const artifactData = await this.downloadArtifact(reference);
    if (!artifactData) {
      return null;
    }

    // 4. Cache for next time
    await this.setCached(artifactData, reference.timestamp);

    // 5. Create SQLite database
    const db = await SQLiteDatabase.fromArrayBuffer(artifactData);
    return { db, reference };
  }

  /**
   * Find the CodjiFlo comment and extract artifact reference.
   */
  async findArtifactReference(): Promise<ArtifactReference | null> {
    try {
      const comments = await githubClient.fetch<IssueComment[]>(
        `/repos/${this.owner}/${this.repo}/issues/${String(this.prNumber)}/comments`
      );

      // Find comment with marker
      const codjifloComment = comments.find((c) => c.body?.includes(COMMENT_MARKER));
      if (!codjifloComment?.body) {
        return null;
      }

      // Parse the comment body
      return this.parseCommentBody(codjifloComment.body);
    } catch (error) {
      if (error instanceof GitHubAPIError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Parse artifact reference from comment body.
   */
  private parseCommentBody(body: string): ArtifactReference | null {
    // Expected format:
    // <!-- codjiflo-data -->
    // ### CodjiFlo Iteration Tracking
    // **Iterations captured**: 3
    // **Last updated**: 2025-01-15T10:30:00Z
    // **Artifact**: `codjiflo-pr-123`
    // **Run ID**: 9876543210

    const iterationCountMatch = /\*\*Iterations captured\*\*:\s*(\d+)/.exec(body);
    const timestampMatch = /\*\*Last updated\*\*:\s*([^\s]+)/.exec(body);
    const artifactMatch = /\*\*Artifact\*\*:\s*`([^`]+)`/.exec(body);
    const runIdMatch = /\*\*Run ID\*\*:\s*(\d+)/.exec(body);

    const iterationCountValue = iterationCountMatch?.[1];
    const timestampValue = timestampMatch?.[1];
    const artifactValue = artifactMatch?.[1];
    const runIdValue = runIdMatch?.[1];

    if (!iterationCountValue || !timestampValue || !artifactValue || !runIdValue) {
      console.warn('Could not parse CodjiFlo comment:', body);
      return null;
    }

    return {
      iterationCount: parseInt(iterationCountValue, 10),
      timestamp: timestampValue,
      artifactName: artifactValue,
      runId: parseInt(runIdValue, 10),
    };
  }

  /**
   * Download artifact from GitHub Actions.
   */
  private async downloadArtifact(reference: ArtifactReference): Promise<ArrayBuffer | null> {
    try {
      // List artifacts for the repository
      const artifactsResponse = await githubClient.fetch<ArtifactsListResponse>(
        `/repos/${this.owner}/${this.repo}/actions/artifacts?name=${encodeURIComponent(reference.artifactName)}`
      );

      const artifact = artifactsResponse.artifacts.find((a) => a.name === reference.artifactName);
      if (!artifact) {
        console.warn(`Artifact not found: ${reference.artifactName}`);
        return null;
      }

      // Download the artifact ZIP
      const downloadUrl = `/repos/${this.owner}/${this.repo}/actions/artifacts/${String(artifact.id)}/zip`;

      // GitHub Actions artifact download returns a ZIP file
      // We need to use fetch directly with the token because it returns binary data
      const response = await fetch(`https://api.github.com${downloadUrl}`, {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new GitHubAPIError(response.status, response.statusText, 'Failed to download artifact');
      }

      // Extract SQLite file from ZIP
      const zipBlob = await response.blob();
      return await this.extractSQLiteFromZip(zipBlob);
    } catch (error) {
      if (error instanceof GitHubAPIError && error.status === 410) {
        // Artifact expired (90-day retention)
        console.warn('Artifact expired:', reference.artifactName);
        return null;
      }
      throw error;
    }
  }

  /**
   * Extract SQLite database file from artifact ZIP.
   */
  private async extractSQLiteFromZip(zipBlob: Blob): Promise<ArrayBuffer> {
    const zip = await JSZip.loadAsync(zipBlob);

    // Find the .db file
    const dbFileName = Object.keys(zip.files).find((name) => name.endsWith('.db'));
    if (!dbFileName) {
      throw new Error('No SQLite database found in artifact');
    }

    const dbFile = zip.files[dbFileName];
    if (!dbFile) {
      throw new Error('SQLite file entry is undefined');
    }

    return dbFile.async('arraybuffer');
  }

  /**
   * Get auth token from store.
   */
  private getToken(): string {
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new GitHubAPIError(401, 'Unauthorized', 'Not authenticated');
    }
    return token;
  }

  // ============================================================================
  // IndexedDB Caching
  // ============================================================================

  /**
   * Get cached artifact from IndexedDB.
   */
  private async getCached(): Promise<CachedArtifact | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(CACHE_DB_NAME, 1);

      request.onerror = () => {
        console.warn('Failed to open IndexedDB cache');
        resolve(null);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const key = this.getCacheKey();

        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
          resolve(getRequest.result as CachedArtifact | null);
        };
        getRequest.onerror = () => {
          console.warn('Failed to read from IndexedDB cache:', getRequest.error?.message);
          resolve(null);
        };
      };
    });
  }

  /**
   * Save artifact to IndexedDB cache.
   */
  private async setCached(data: ArrayBuffer, timestamp: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CACHE_DB_NAME, 1);

      request.onerror = () => {
        console.warn('Failed to open IndexedDB cache for writing');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CACHE_STORE_NAME);
        const key = this.getCacheKey();

        const cached: CachedArtifact = { data, timestamp };
        const putRequest = store.put(cached, key);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error(putRequest.error?.message ?? 'Failed to cache artifact'));
      };
    });
  }

  /**
   * Generate cache key for this PR.
   */
  private getCacheKey(): string {
    return `${this.owner}/${this.repo}/${String(this.prNumber)}`;
  }
}
