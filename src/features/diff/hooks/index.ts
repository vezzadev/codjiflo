export { useIterationDiff } from './useIterationDiff';
export { useIterationAwareFiles } from './useIterationAwareFiles';
export { useSyntaxTheme } from './useSyntaxTheme';
export { useDiffPipeline } from './useDiffPipeline';
export { useDraftComment } from './useDraftComment';
export { useContainerHeight } from './useContainerHeight';
export { useGoToLine, parseLineInput } from './useGoToLine';

export type { IterationAwareFile } from './useIterationAwareFiles';
export type { UseDraftCommentReturn } from './useDraftComment';
export type { UseContainerHeightReturn } from './useContainerHeight';
export type { UseGoToLineReturn } from './useGoToLine';

// Pipeline stage hooks (for advanced use cases)
export * from './pipeline';
