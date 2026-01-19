export { parsePatch, detectLanguage } from './parse-patch';
export { getDiffLinePosition, getDiffLineIndexForPosition } from './comment-position';
export { computeAlignment, alignDiffLines, applyContentFilter } from './align-diff';
export { filterWhitespaceChanges, filterAlignedWhitespace } from './filter-whitespace';
export { filterToChangesOnly, filterAlignedToChangesOnly } from './filter-to-changes';
export { calculateHunkIndices, calculateAlignedHunkIndices } from './hunk-navigation';
export {
  getParentPath,
  getBasename,
  groupFilesByFolder,
  flattenGroupedFiles,
  type FileGroup,
} from './file-grouping';
