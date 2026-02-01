/**
 * Iteration Store
 *
 * Manages iteration state including loading from artifacts,
 * range selection, and integration with SpanTracker.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { ArtifactLoader } from '../artifact-loader';
import { IterationClient } from '../iteration-client';
import { SpanTrackerService } from '../application';
import { SQLiteSpanTrackerReader } from '../infrastructure';
import { tracer, SemanticAttributes } from '@/lib/tracing';
import type {
  Iteration,
  ReviewFileArtifact,
  IterationRange,
  IterationPreset,
  ArtifactReference,
  StatelessIteration,
  CollapsedIterationGroup,
  CollapsedVisibility,
} from '../types';
import { iterationToLeftSnapshot, iterationToRightSnapshot } from '../types';

// ============================================================================
// Store State Interface
// ============================================================================

/** Maximum number of PR ranges to keep in cache (LRU eviction) */
const MAX_CACHED_RANGES = 50;

/** Creates a unique key for a PR using GitHub URL format */
function getPrKey(owner: string, repo: string, prNumber: number): string {
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}

/**
 * LRU cache helper: moves key to end (most recent) and evicts oldest if over limit.
 * Returns a new object with proper ordering.
 */
function updateLRUCache(
  cache: Record<string, IterationRange>,
  key: string,
  value: IterationRange
): Record<string, IterationRange> {
  // Build new cache: exclude existing key (if any), add all others, then add current key at end
  const entries = Object.entries(cache).filter(([k]) => k !== key);

  // Add current entry at end (most recent)
  entries.push([key, value]);

  // Evict oldest entries if over limit
  const trimmedEntries = entries.length > MAX_CACHED_RANGES
    ? entries.slice(entries.length - MAX_CACHED_RANGES)
    : entries;

  return Object.fromEntries(trimmedEntries);
}

/** Iteration storage mode: stateful (artifact available) or stateless (GitHub API only) */
export type IterationMode = 'stateful' | 'stateless';

interface IterationState {
  // Data
  iterations: Iteration[];
  artifacts: ReviewFileArtifact[];
  artifactTimestamp: string | null;
  artifactReference: ArtifactReference | null;

  // Stateless mode data (M4.2)
  statelessIterations: StatelessIteration[];
  collapsedGroups: CollapsedIterationGroup[];

  // Selection (partitioned by PR)
  currentPrKey: string | null;
  selectedRanges: Record<string, IterationRange>;

  // Services (not persisted)
  client: IterationClient | null;
  spanTrackerService: SpanTrackerService | null;

  // Loading state
  isLoading: boolean;
  error: string | null;
  /** Iteration storage mode: 'stateful' when artifact is available, 'stateless' for GitHub API only */
  mode: IterationMode;
  /** Reason for stateless mode (for debugging, null when stateful) */
  statelessReason: string | null;

  // Actions
  loadIterations: (
    owner: string,
    repo: string,
    prNumber: number,
    options?: { forceStateless?: boolean }
  ) => Promise<void>;
  selectRange: (fromSnapshot: number, toSnapshot: number) => void;
  selectPreset: (preset: IterationPreset) => void;
  getSpanTrackerService: () => SpanTrackerService | null;
  toggleCollapsedGroupVisibility: (groupId: string) => void;
  setStatelessIterations: (
    iterations: StatelessIteration[],
    groups: CollapsedIterationGroup[]
  ) => void;
  reset: () => void;
}

/** Selector to get the current PR's selected range */
export function selectSelectedRange(state: IterationState): IterationRange | null {
  const { currentPrKey, selectedRanges } = state;
  if (!currentPrKey) return null;
  return selectedRanges[currentPrKey] ?? null;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  iterations: [],
  artifacts: [],
  artifactTimestamp: null,
  artifactReference: null,
  statelessIterations: [],
  collapsedGroups: [],
  currentPrKey: null,
  selectedRanges: {},
  client: null,
  spanTrackerService: null,
  isLoading: false,
  error: null,
  mode: 'stateful' as IterationMode,
  statelessReason: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useIterationStore = create<IterationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadIterations: async (owner, repo, prNumber, options) => {
        const prKey = getPrKey(owner, repo, prNumber);
        const forceStateless = options?.forceStateless ?? false;

        // Create tracing span for this operation
        const span = tracer.startSpan('iterations.load', {
          [SemanticAttributes.GITHUB_OWNER]: owner,
          [SemanticAttributes.GITHUB_REPO]: repo,
          [SemanticAttributes.GITHUB_PR_NUMBER]: prNumber,
          'iterations.force_stateless': forceStateless,
        });

        console.info(
          `[CodjiFlo] Loading iterations for ${prKey}${forceStateless ? ' (forced stateless)' : ''}`
        );
        set({ isLoading: true, error: null, currentPrKey: prKey });

        // Handle forced stateless mode - skip artifact loading entirely
        if (forceStateless) {
          span.addEvent('stateless.forced');
          span.setStatus('ok');
          span.end();

          set({
            isLoading: false,
            mode: 'stateless',
            statelessReason: 'Stateless mode forced via ?mode=stateless query parameter.',
            iterations: [],
            artifacts: [],
          });
          return;
        }

        try {
          const loader = new ArtifactLoader(owner, repo, prNumber);

          // Get artifact reference early (from PR comment) so UI can show iteration count
          const earlyReference = await loader.findArtifactReference();
          if (earlyReference) {
            set({ artifactReference: earlyReference });
          }

          const result = await loader.load(earlyReference ?? undefined);

          if (!result) {
            // Determine reason for stateless mode
            const hasArtifactReference = earlyReference !== null;
            const isAuthenticated = useAuthStore.getState().token !== null;

            let reason: string;
            if (hasArtifactReference && !isAuthenticated) {
              // Artifact exists but can't download without auth (S-4.1.5)
              reason = 'Sign in to enable iteration tracking. CodjiFlo data is available for this PR.';
              console.info(`[CodjiFlo] Entering stateless mode: not authenticated for ${prKey}`);
              span.addEvent('stateless.not_authenticated');
            } else {
              // No artifact found - workflow not installed
              reason = 'No CodjiFlo artifact found. The repository may not have the CodjiFlo GitHub Action installed.';
              console.info(`[CodjiFlo] Entering stateless mode: no artifact found for ${prKey}`);
              span.addEvent('stateless.no_artifact');
            }

            span.setStatus('ok');
            span.end();

            set({
              isLoading: false,
              mode: 'stateless',
              statelessReason: reason,
              iterations: [],
              artifacts: [],
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

          console.info(
            `[CodjiFlo] Loaded ${iterations.length} iteration(s) and ${artifacts.length} artifact(s) for ${prKey}`
          );

          // Set default selection (full diff: base to latest)
          // Uses the base snapshot of the latest iteration to handle rebases correctly.
          // After a rebase, the latest iteration's left snapshot contains the new base,
          // while snapshot 0 would contain the stale old base.
          const latestIteration = iterations[iterations.length - 1];
          const defaultRange: IterationRange | null = latestIteration
            ? {
                fromSnapshot: iterationToLeftSnapshot(latestIteration.revision),
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
          const latestLeftSnapshot = latestIteration
            ? iterationToLeftSnapshot(latestIteration.revision)
            : 0;
          const isCachedRangeValid =
            cachedRange !== undefined &&
            cachedRange.fromSnapshot >= 0 &&
            cachedRange.toSnapshot <= maxValidSnapshot &&
            cachedRange.fromSnapshot < cachedRange.toSnapshot &&
            // Invalidate cached "full diff" if a rebase occurred:
            // If cached fromSnapshot is 0 but latest iteration's left snapshot is different,
            // the base has changed (rebase) and we should use the new base instead.
            !(cachedRange.fromSnapshot === 0 && latestLeftSnapshot > 0);

          // Use cached range if valid, otherwise use default
          const rangeToUse = isCachedRangeValid ? cachedRange : defaultRange;

          // Update selectedRanges with LRU eviction
          const newSelectedRanges = rangeToUse
            ? updateLRUCache(selectedRanges, prKey, rangeToUse)
            : selectedRanges;

          span.addEvent('stateful.loaded', {
            [SemanticAttributes.ITERATION_COUNT]: iterations.length,
          });
          span.setStatus('ok');
          span.end();

          set({
            iterations,
            artifacts,
            artifactTimestamp: reference.timestamp,
            artifactReference: reference,
            selectedRanges: newSelectedRanges,
            client,
            spanTrackerService,
            isLoading: false,
            mode: 'stateful',
            statelessReason: null,
            error: null,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load iterations';
          console.error(`[CodjiFlo] Failed to load iterations for ${prKey}: ${message}`);

          span.setStatus('error', message);
          span.end();

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

        set({
          selectedRanges: updateLRUCache(selectedRanges, currentPrKey, { fromSnapshot, toSnapshot }),
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
            // Base to latest: use the base snapshot of the latest iteration
            // This handles rebases correctly by using the current base instead of stale snapshot 0
            newRange = {
              fromSnapshot: iterationToLeftSnapshot(latestIteration.revision),
              toSnapshot: latestRightSnapshot,
            };
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
          selectedRanges: updateLRUCache(selectedRanges, currentPrKey, newRange),
        });
      },

      getSpanTrackerService: () => {
        return get().spanTrackerService;
      },

      toggleCollapsedGroupVisibility: (groupId: string) => {
        const { collapsedGroups } = get();
        const updatedGroups = collapsedGroups.map((group) => {
          if (group.id !== groupId) {
            return group;
          }
          const newVisibility: CollapsedVisibility =
            group.visibility === 'collapsed' ? 'expanded' : 'collapsed';
          return { ...group, visibility: newVisibility };
        });
        set({ collapsedGroups: updatedGroups });
      },

      setStatelessIterations: (iterations, groups) => {
        set({
          statelessIterations: iterations,
          collapsedGroups: groups,
        });
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
