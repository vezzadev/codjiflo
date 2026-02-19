/**
 * Iteration Store
 *
 * Manages iteration state including loading from artifacts,
 * range selection, and integration with SpanTracker.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { githubClient } from '@/api/github/github-client';
import { ArtifactLoader } from '../artifact-loader';
import { IterationClient } from '../iteration-client';
import { TimelineLoader } from '../timeline-loader';
import { SpanTrackerService } from '../application';
import { SQLiteSpanTrackerReader } from '../infrastructure';
import type {
  Iteration,
  ReviewFileArtifact,
  IterationRange,
  IterationPreset,
  ArtifactReference,
  CollapsedIterationGroup,
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
  cache: { [key: string]: IterationRange },
  key: string,
  value: IterationRange
): { [key: string]: IterationRange } {
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
  collapsedGroups: CollapsedIterationGroup[];
  artifacts: ReviewFileArtifact[];
  artifactTimestamp: string | null;
  artifactReference: ArtifactReference | null;

  // Selection (partitioned by PR)
  currentPrKey: string | null;
  selectedRanges: { [key: string]: IterationRange };

  // Collapsed group history view
  activeCollapsedGroupId: string | null;

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
  loadIterations: (owner: string, repo: string, prNumber: number) => Promise<void>;
  selectRange: (fromSnapshot: number, toSnapshot: number) => void;
  selectPreset: (preset: IterationPreset) => void;
  selectCollapsedGroup: (groupId: string) => void;
  /** Available for future "dismiss without expanding" UX */
  clearCollapsedGroup: () => void;
  toggleCollapsedGroupVisibility: (groupId: string) => void;
  getSpanTrackerService: () => SpanTrackerService | null;
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
  collapsedGroups: [] as CollapsedIterationGroup[],
  artifacts: [],
  artifactTimestamp: null,
  artifactReference: null,
  currentPrKey: null,
  selectedRanges: {},
  activeCollapsedGroupId: null,
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

      loadIterations: async (owner, repo, prNumber) => {
        const prKey = getPrKey(owner, repo, prNumber);
        console.info(`[CodjiFlo] Loading iterations for ${prKey}`);
        set({ isLoading: true, error: null, currentPrKey: prKey });

        try {
          // Check for ?mode=stateless query parameter to bypass artifact loading
          const forceStateless = typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).get('mode') === 'stateless';

          // Try loading artifact (unless forced stateless)
          if (!forceStateless) {
            const loader = new ArtifactLoader(owner, repo, prNumber);

            // Get artifact reference early (from PR comment) so UI can show iteration count
            const earlyReference = await loader.findArtifactReference();
            if (earlyReference) {
              set({ artifactReference: earlyReference });
            }

            const result = await loader.load(earlyReference ?? undefined);

            if (result) {
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
              const latestIteration = iterations[iterations.length - 1];
              const defaultRange: IterationRange | null = latestIteration
                ? {
                    fromSnapshot: iterationToLeftSnapshot(latestIteration.revision),
                    toSnapshot: iterationToRightSnapshot(latestIteration.revision),
                  }
                : null;

              const { selectedRanges } = get();
              const cachedRange = selectedRanges[prKey];

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
                !(cachedRange.fromSnapshot === 0 && latestLeftSnapshot > 0);

              const rangeToUse = isCachedRangeValid ? cachedRange : defaultRange;

              const newSelectedRanges = rangeToUse
                ? updateLRUCache(selectedRanges, prKey, rangeToUse)
                : selectedRanges;

              set({
                iterations,
                collapsedGroups: [],
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
              return;
            }
          }

          // Stateless mode: no artifact available or forced via query param
          let reason: string;
          if (forceStateless) {
            reason = 'Stateless mode forced via ?mode=stateless query parameter.';
            console.info(`[CodjiFlo] Entering stateless mode: forced via query param for ${prKey}`);
          } else {
            const hasArtifactReference = get().artifactReference !== null;
            const isAuthenticated = useAuthStore.getState().token !== null;

            if (hasArtifactReference && !isAuthenticated) {
              reason = 'Sign in to enable iteration tracking. CodjiFlo data is available for this PR.';
              console.info(`[CodjiFlo] Entering stateless mode: not authenticated for ${prKey}`);
            } else {
              reason = 'No CodjiFlo artifact found. The repository may not have the CodjiFlo GitHub Action installed.';
              console.info(`[CodjiFlo] Entering stateless mode: no artifact found for ${prKey}`);
            }
          }

          // Load iterations from GitHub Commits + Timeline APIs
          try {
            const prData = await githubClient.fetch<{ base: { sha: string } }>(
              `/repos/${owner}/${repo}/pulls/${String(prNumber)}`
            );
            const timelineLoader = new TimelineLoader(owner, repo, prNumber, prData.base.sha);
            const timelineResult = await timelineLoader.load();

            if (timelineResult.iterations.length > 0) {
              const latestLiveIteration = [...timelineResult.iterations]
                .reverse()
                .find(i => i.status === 'live');
              const latestIteration = latestLiveIteration ?? timelineResult.iterations[timelineResult.iterations.length - 1];

              const defaultRange = latestIteration
                ? {
                    fromSnapshot: iterationToLeftSnapshot(latestIteration.revision),
                    toSnapshot: iterationToRightSnapshot(latestIteration.revision),
                  }
                : null;

              const { selectedRanges } = get();
              const newSelectedRanges = defaultRange
                ? updateLRUCache(selectedRanges, prKey, defaultRange)
                : selectedRanges;

              console.info(
                `[CodjiFlo] Stateless mode: loaded ${String(timelineResult.iterations.length)} iteration(s) ` +
                `(${String(timelineResult.collapsedGroups.length)} collapsed group(s)) for ${prKey}`
              );

              set({
                isLoading: false,
                mode: 'stateless',
                statelessReason: reason,
                iterations: timelineResult.iterations,
                collapsedGroups: timelineResult.collapsedGroups,
                artifacts: [],
                selectedRanges: newSelectedRanges,
              });
              return;
            }
          } catch (timelineError) {
            console.warn('[CodjiFlo] Failed to load stateless iterations:', timelineError);
          }

          set({
            isLoading: false,
            mode: 'stateless',
            statelessReason: reason,
            iterations: [],
            collapsedGroups: [],
            artifacts: [],
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load iterations';
          console.error(`[CodjiFlo] Failed to load iterations for ${prKey}: ${message}`);
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
          activeCollapsedGroupId: null,
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
          activeCollapsedGroupId: null,
        });
      },

      selectCollapsedGroup: (groupId: string) => {
        set({ activeCollapsedGroupId: groupId });
      },

      clearCollapsedGroup: () => {
        set({ activeCollapsedGroupId: null });
      },

      toggleCollapsedGroupVisibility: (groupId: string) => {
        const { collapsedGroups } = get();
        set({
          collapsedGroups: collapsedGroups.map(g =>
            g.forcePushEventId === groupId
              ? { ...g, visibility: g.visibility === 'collapsed' ? 'expanded' as const : 'collapsed' as const }
              : g
          ),
          activeCollapsedGroupId: null,
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
