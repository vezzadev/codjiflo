export { useIterationDiff } from './useIterationDiff';
export { useIterationAwareFiles } from './useIterationAwareFiles';
export { useFileDisplayOrder } from './useFileDisplayOrder';
export { useDiffPipeline } from './useDiffPipeline';
export { useDraftComment } from './useDraftComment';
export { useContainerHeight } from './useContainerHeight';
export { useStatelessDiff } from './useStatelessDiff';
export { useSpanTrackerPrecompute } from './useSpanTrackerPrecompute';

export type { IterationAwareFile } from './useIterationAwareFiles';
export type { UseDraftCommentReturn } from './useDraftComment';
export type { UseContainerHeightReturn } from './useContainerHeight';
export type { UseStatelessDiffResult } from './useStatelessDiff';
export type { FileWithComments, UseSpanTrackerPrecomputeOptions } from './useSpanTrackerPrecompute';

// Pipeline stage hooks (for advanced use cases)
export * from './pipeline';
