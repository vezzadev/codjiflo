export { CommentThread, CommentEditor, RegionCommentButton, CommentBubble, CommentBubbleCanvas, LassoOverlay } from './components';
export { useCommentsStore } from './stores';
export { useCommentTracking, useRegionSelection } from './hooks';
export type { UseRegionSelectionReturn, SelectionPosition, RegionSelectionState } from './hooks';
export type { Comment, ReviewThread, CommentSide, CommentRegion } from './types';
export { singleLineRegion, multiLineRegion, subLineRegion, isMultiLineRegion, hasColumnSelection } from './types';
export { LayoutEngine, createLayoutEngine, type BubbleLayout, type ConnectorData, type CommentBubbleInput, type CodeLinePosition, type LayoutConfig } from './layout-engine';
