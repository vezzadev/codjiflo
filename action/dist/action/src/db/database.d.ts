/**
 * Database Operations for CodjiFlo Action
 *
 * Provides typed query methods for the iteration database.
 */
export interface IterationRow {
    id: number;
    revision: number;
    head_sha: string;
    base_sha: string;
    before_sha: string | null;
    author: string | null;
    created_at: string;
}
export interface FileArtifactRow {
    id: number;
    change_tracking_id: string;
}
export interface ArtifactSnapshotRow {
    id: number;
    artifact_id: number;
    snapshot_index: number;
    file_path: string | null;
    content_hash: string | null;
}
export interface ContentBlobRow {
    content_hash: string;
    content: string;
    size_bytes: number;
}
export interface SpanTrackerRow {
    id: number;
    artifact_id: number;
    left_snapshot_index: number;
    right_snapshot_index: number;
}
export interface SpanMappingRow {
    tracker_id: number;
    left_line_start: number | null;
    left_line_end: number | null;
    right_line_start: number | null;
    right_line_end: number | null;
    mapping_type: 'unchanged' | 'modified' | 'deleted' | 'added';
}
export declare class IterationDatabase {
    private db;
    constructor(filePath: string);
    /**
     * Check if the database schema version matches the code version.
     * Warns if there's a mismatch - this will be useful when we need to
     * perform schema migrations in future versions.
     */
    private checkSchemaVersion;
    insertIteration(data: Omit<IterationRow, 'id'>): number;
    getLatestIteration(): IterationRow | undefined;
    getIterationCount(): number;
    getOrCreateArtifact(changeTrackingId: string): number;
    /**
     * Insert or update an artifact snapshot with optional content.
     * Content is deduplicated via content_blobs table.
     */
    insertArtifactSnapshot(artifactId: number, snapshotIndex: number, filePath: string | null, content: string | null): void;
    /**
     * Get artifact snapshot with content.
     */
    getArtifactSnapshot(artifactId: number, snapshotIndex: number): {
        artifactId: number;
        snapshotIndex: number;
        filePath: string | null;
        content: string | null;
        contentHash: string | null;
        sizeBytes: number;
    } | undefined;
    /**
     * Get or create a content blob with deduplication.
     * Returns the content hash (which is the primary key).
     */
    getOrCreateContentBlob(content: string): string;
    /**
     * Get content by hash.
     */
    getContentBlob(contentHash: string): ContentBlobRow | undefined;
    /**
     * Get all artifact IDs that have snapshots for a given snapshot range.
     * Used to determine which artifacts need SpanTracker computation.
     */
    getArtifactIdsForSnapshotRange(leftSnapshotIndex: number, rightSnapshotIndex: number): number[];
    insertSpanTracker(artifactId: number, leftSnapshotIndex: number, rightSnapshotIndex: number): number;
    insertSpanMapping(trackerId: number, leftStart: number | null, leftEnd: number | null, rightStart: number | null, rightEnd: number | null, mappingType: SpanMappingRow['mapping_type']): void;
    private hashContent;
    /**
     * Get the schema version stored in the database.
     */
    getSchemaVersion(): number;
    /**
     * Check if the database schema is compatible with the current code.
     */
    isSchemaCompatible(): boolean;
    export(): Buffer;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map