/**
 * Iteration Store
 *
 * Manages iteration state including loading from artifacts,
 * range selection, and integration with SpanTracker.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ArtifactLoader } from '../artifact-loader';
import { IterationClient } from '../iteration-client';
import { SpanTrackerService } from '../application';
import { SQLiteSpanTrackerReader } from '../infrastructure';
import type {
  Iteration,
  ReviewFileArtifact,
  IterationRange,
  IterationPreset,
  ArtifactReference,
} from '../types';
import { iterationToRightSnapshot } from '../types';

// ============================================================================
// Store State Interface
// ============================================================================

/** Creates a unique key for a PR to partition cached data */
function getPrKey(owner: string, repo: string, prNumber: number): string {
  return `${owner}/${repo}#${prNumber}`;
}

interface IterationState {
  // Data
  iterations: Iteration[];
  artifacts: ReviewFileArtifact[];
  artifactTimestamp: string | null;
  artifactReference: ArtifactReference | null;

  // Selection (partitioned by PR)
  currentPrKey: string | null;
  selectedRanges: Record<string, IterationRange>;
  // Derived from currentPrKey + selectedRanges for backward compatibility
  selectedRange: IterationRange | null;

  // Services (not persisted)
  client: IterationClient | null;
  spanTrackerService: SpanTrackerService | null;

  // Loading state
  isLoading: boolean;
  error: string | null;
  isDegraded: boolean;

  // Actions
  loadIterations: (owner: string, repo: string, prNumber: number) => Promise<void>;
  selectRange: (fromSnapshot: number, toSnapshot: number) => void;
  selectPreset: (preset: IterationPreset) => void;
  getSpanTrackerService: () => SpanTrackerService | null;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  iterations: [],
  artifacts: [],
  artifactTimestamp: null,
  artifactReference: null,
  currentPrKey: null,
  selectedRanges: {},
  selectedRange: null,
  client: null,
  spanTrackerService: null,
  isLoading: false,
  error: null,
  isDegraded: false,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useIterationStore = create<IterationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadIterations: async (owner, repo, prNumber) => {
        const prKey = getPrKey(owner, repo, prNumber);
        set({ isLoading: true, error: null, currentPrKey: prKey });

        try {
          const loader = new ArtifactLoader(owner, repo, prNumber);
          const result = await loader.load();

          if (!result) {
            // No artifact found - trigger graceful degradation
            set({
              isLoading: false,
              isDegraded: true,
              iterations: [],
              artifacts: [],
              selectedRange: null,
            });
            return;
          }

          const { db, reference } = result;

          // Create iteration client
          const client = new IterationClient(db);

          // Load iterations and artifacts
          const iterations = client.getIterations();
          const artifacts = client.getAllArtifacts();

          // Create SpanTracker service
          const spanTrackerReader = new SQLiteSpanTrackerReader(db);
          const spanTrackerService = new SpanTrackerService(spanTrackerReader);

          // Set default selection (full diff: base to latest)
          const latestIteration = iterations[iterations.length - 1];
          const defaultRange: IterationRange | null = latestIteration
            ? {
                fromSnapshot: 0, // Base
                toSnapshot: iterationToRightSnapshot(latestIteration.revision),
              }
            : null;

          // Check if we have a cached range for this specific PR
          const { selectedRanges } = get();
          const cachedRange = selectedRanges[prKey];

          // Validate cached range against current PR's iterations
          const maxValidSnapshot = latestIteration
            ? iterationToRightSnapshot(latestIteration.revision)
            : 0;
          const isCachedRangeValid =
            cachedRange !== undefined &&
            cachedRange.fromSnapshot >= 0 &&
            cachedRange.toSnapshot <= maxValidSnapshot &&
            cachedRange.fromSnapshot < cachedRange.toSnapshot;

          // Use cached range if valid, otherwise use default
          const rangeToUse = isCachedRangeValid ? cachedRange : defaultRange;

          // Update selectedRanges with the range for this PR
          const newSelectedRanges = rangeToUse
            ? { ...selectedRanges, [prKey]: rangeToUse }
            : selectedRanges;

          set({
            iterations,
            artifacts,
            artifactTimestamp: reference.timestamp,
            artifactReference: reference,
            selectedRanges: newSelectedRanges,
            selectedRange: rangeToUse,
            client,
            spanTrackerService,
            isLoading: false,
            isDegraded: false,
            error: null,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load iterations';
          set({
            isLoading: false,
            error: message,
          });
        }
      },

      selectRange: (fromSnapshot, toSnapshot) => {
        const { currentPrKey, selectedRanges } = get();
        if (!currentPrKey) {
          console.warn('Cannot select range: no PR is currently loaded');
          return;
        }
        if (fromSnapshot >= toSnapshot) {
          console.warn('Invalid range: fromSnapshot must be less than toSnapshot');
          return;
        }

        const newRange = { fromSnapshot, toSnapshot };
        set({
          selectedRanges: {
            ...selectedRanges,
            [currentPrKey]: newRange,
          },
          selectedRange: newRange,
        });
      },

      selectPreset: (preset) => {
        const { iterations, currentPrKey, selectedRanges } = get();
        if (iterations.length === 0 || !currentPrKey) return;

        const latestIteration = iterations[iterations.length - 1];
        if (!latestIteration) return;

        const latestRightSnapshot = iterationToRightSnapshot(latestIteration.revision);

        let newRange: IterationRange;

        switch (preset) {
          case 'full':
            // Base to latest
            newRange = { fromSnapshot: 0, toSnapshot: latestRightSnapshot };
            break;

          case 'latest':
            // Previous iteration to latest
            if (iterations.length === 1) {
              newRange = { fromSnapshot: 0, toSnapshot: latestRightSnapshot };
            } else {
              const prevIteration = iterations[iterations.length - 2];
              if (!prevIteration) {
                newRange = { fromSnapshot: 0, toSnapshot: latestRightSnapshot };
              } else {
                newRange = {
                  fromSnapshot: iterationToRightSnapshot(prevIteration.revision),
                  toSnapshot: latestRightSnapshot,
                };
              }
            }
            break;

          case 'lastReview':
            // TODO: Integrate with review history when available
            // For now, fall back to 'latest'
            if (iterations.length === 1) {
              newRange = { fromSnapshot: 0, toSnapshot: latestRightSnapshot };
            } else {
              const prevIteration = iterations[iterations.length - 2];
              if (!prevIteration) {
                newRange = { fromSnapshot: 0, toSnapshot: latestRightSnapshot };
              } else {
                newRange = {
                  fromSnapshot: iterationToRightSnapshot(prevIteration.revision),
                  toSnapshot: latestRightSnapshot,
                };
              }
            }
            break;

          default:
            return;
        }

        set({
          selectedRanges: {
            ...selectedRanges,
            [currentPrKey]: newRange,
          },
          selectedRange: newRange,
        });
      },

      getSpanTrackerService: () => {
        return get().spanTrackerService;
      },

      reset: () => {
        const { client, spanTrackerService } = get();

        // Cleanup with error handling to ensure both resources are released
        try {
          if (client) {
            client.close();
          }
        } catch (error) {
          console.warn('Failed to close iteration client:', error);
        }

        try {
          if (spanTrackerService) {
            spanTrackerService.clearCache();
          }
        } catch (error) {
          console.warn('Failed to clear SpanTracker cache:', error);
        }

        set(initialState);
      },
    }),
    {
      name: 'iteration-store',
      partialize: (state) => ({
        // Only persist user's selections per PR, not data
        selectedRanges: state.selectedRanges,
      }),
    }
  )
);
