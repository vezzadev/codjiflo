/**
 * Line-level Diff Computation
 *
 * Computes line-level diffs using diff-match-patch.
 * Shared between GitHub Action and E2E test fixtures.
 */
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL, } from "diff-match-patch";
// ============================================================================
// Diff Computation
// ============================================================================
/**
 * Compute line-level diff between two strings.
 * Returns a sequence of LineDiff operations.
 */
export function computeLineDiff(left, right) {
    const dmp = new diff_match_patch();
    // Use line-level diff
    const { chars1, chars2, lineArray } = linesToChars(left, right);
    const diffs = dmp.diff_main(chars1, chars2, false);
    dmp.diff_cleanupSemantic(diffs);
    charsToLines(diffs, lineArray);
    // Convert to LineDiff format
    const result = [];
    let i = 0;
    while (i < diffs.length) {
        const diff = diffs[i];
        if (!diff) {
            i++;
            continue;
        }
        const [op, text] = diff;
        const lines = countLines(text);
        if (op === DIFF_EQUAL) {
            result.push({ type: "unchanged", leftLines: lines, rightLines: lines });
            i++;
        }
        else if (op === DIFF_DELETE) {
            // Check if next is an INSERT (modification)
            const nextDiff = diffs[i + 1];
            if (nextDiff?.[0] === DIFF_INSERT) {
                const insertLines = countLines(nextDiff[1]);
                result.push({
                    type: "modified",
                    leftLines: lines,
                    rightLines: insertLines,
                });
                i += 2;
            }
            else {
                result.push({ type: "deleted", leftLines: lines, rightLines: 0 });
                i++;
            }
        }
        else if (op === DIFF_INSERT) {
            result.push({ type: "added", leftLines: 0, rightLines: lines });
            i++;
        }
        else {
            i++;
        }
    }
    return result;
}
// ============================================================================
// Span Mapping Conversion
// ============================================================================
/**
 * Convert a LineDiff array to SpanMapping array with correct line numbers.
 * Line numbers are 1-based.
 */
export function lineDiffsToSpanMappings(diffs) {
    const mappings = [];
    let leftLine = 1;
    let rightLine = 1;
    for (const diff of diffs) {
        mappings.push(lineDiffToSpanMapping(diff, leftLine, rightLine));
        // Advance line counters
        leftLine += diff.leftLines;
        rightLine += diff.rightLines;
    }
    return mappings;
}
/**
 * Convert a single LineDiff to a SpanMapping.
 */
export function lineDiffToSpanMapping(diff, leftStart, rightStart) {
    switch (diff.type) {
        case "unchanged":
            return {
                left_line_start: leftStart,
                left_line_end: leftStart + diff.leftLines - 1,
                right_line_start: rightStart,
                right_line_end: rightStart + diff.rightLines - 1,
                mapping_type: "unchanged",
            };
        case "modified":
            return {
                left_line_start: leftStart,
                left_line_end: leftStart + diff.leftLines - 1,
                right_line_start: rightStart,
                right_line_end: rightStart + diff.rightLines - 1,
                mapping_type: "modified",
            };
        case "deleted":
            return {
                left_line_start: leftStart,
                left_line_end: leftStart + diff.leftLines - 1,
                right_line_start: null,
                right_line_end: null,
                mapping_type: "deleted",
            };
        case "added":
            return {
                left_line_start: null,
                left_line_end: null,
                right_line_start: rightStart,
                right_line_end: rightStart + diff.rightLines - 1,
                mapping_type: "added",
            };
    }
}
/**
 * Count lines in a string.
 */
function countLines(text) {
    if (!text)
        return 0;
    // Count newlines + 1 for last line (unless text ends with newline)
    const newlines = (text.match(/\n/g) ?? []).length;
    return text.endsWith("\n") ? newlines : newlines + 1;
}
/**
 * Convert two texts to line-based representation.
 */
function linesToChars(text1, text2) {
    const lineArray = [];
    const lineHash = new Map();
    // Start at char 1 (char 0 reserved)
    lineArray[0] = "";
    const chars1 = textToChars(text1, lineArray, lineHash);
    const chars2 = textToChars(text2, lineArray, lineHash);
    return { chars1, chars2, lineArray };
}
function textToChars(text, lineArray, lineHash) {
    let chars = "";
    let lineStart = 0;
    let lineEnd = -1;
    while (lineEnd < text.length - 1) {
        lineEnd = text.indexOf("\n", lineStart);
        if (lineEnd === -1) {
            lineEnd = text.length - 1;
        }
        let line = text.substring(lineStart, lineEnd + 1);
        const existing = lineHash.get(line);
        if (existing !== undefined) {
            chars += existing;
        }
        else {
            if (lineArray.length === 65535) {
                // Max chars, just stop here
                line = text.substring(lineStart);
                lineEnd = text.length;
            }
            const charCode = String.fromCharCode(lineArray.length);
            lineArray.push(line);
            lineHash.set(line, charCode);
            chars += charCode;
        }
        lineStart = lineEnd + 1;
    }
    return chars;
}
/**
 * Convert char-based diff back to line-based.
 */
function charsToLines(diffs, lineArray) {
    for (const diff of diffs) {
        const text = [];
        for (let i = 0; i < diff[1].length; i++) {
            const lineIndex = diff[1].charCodeAt(i);
            const line = lineArray[lineIndex];
            if (line !== undefined) {
                text.push(line);
            }
        }
        diff[1] = text.join("");
    }
}
