/**
 * Comment Widgets Extension for CodeMirror 6
 *
 * Provides block widgets for rendering comment threads inline with diff content.
 * Uses React portals to render actual CommentThread components inside widgets.
 */

import {
  StateField,
  StateEffect,
  type Extension,
  RangeSetBuilder,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import type { ReviewThread } from '@/features/comments';

/**
 * Configuration for comment widgets.
 */
export interface CommentWidgetConfig {
  /** Initial threads mapped to line indices */
  threadsByLine?: Map<number, ReviewThread[]> | undefined;
  /** Whether comments are visible */
  showComments?: boolean | undefined;
  /** Draft comment line index (shows editor at this line) */
  draftLineIndex?: number | null | undefined;
  /** Callback to get the DOM node for a thread (for React portal mounting) */
  onMountThread?: ((threadId: string, container: HTMLElement) => void) | undefined;
  /** Callback when thread container is unmounted */
  onUnmountThread?: ((threadId: string) => void) | undefined;
  /** Callback to mount draft editor */
  onMountDraft?: ((lineIndex: number, container: HTMLElement) => void) | undefined;
  /** Callback when draft editor is unmounted */
  onUnmountDraft?: (() => void) | undefined;
}

/**
 * State effect to update comment threads.
 */
export const setCommentThreads = StateEffect.define<Map<number, ReviewThread[]>>();

/**
 * State effect to update draft line index.
 */
export const setDraftLineIndex = StateEffect.define<number | null>();

/**
 * State effect to toggle comment visibility.
 */
export const setShowComments = StateEffect.define<boolean>();

/**
 * Widget for rendering a comment thread.
 */
class CommentThreadWidget extends WidgetType {
  constructor(
    private thread: ReviewThread,
    private config: CommentWidgetConfig
  ) {
    super();
  }

  override toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-comment-widget';
    container.dataset.threadId = this.thread.id;

    // Call mount callback for React portal
    if (this.config.onMountThread) {
      // Defer to next tick to ensure DOM is ready
      requestAnimationFrame(() => {
        this.config.onMountThread?.(this.thread.id, container);
      });
    }

    return container;
  }

  override destroy(dom: HTMLElement): void {
    const threadId = dom.dataset.threadId;
    if (threadId && this.config.onUnmountThread) {
      this.config.onUnmountThread(threadId);
    }
  }

  override eq(other: WidgetType): boolean {
    if (!(other instanceof CommentThreadWidget)) return false;
    // Compare thread IDs and resolved status for equality
    return (
      this.thread.id === other.thread.id &&
      this.thread.isResolved === other.thread.isResolved &&
      this.thread.comments.length === other.thread.comments.length
    );
  }

  override get estimatedHeight(): number {
    // Estimate based on number of comments
    const baseHeight = 80;
    const perComment = 60;
    return baseHeight + this.thread.comments.length * perComment;
  }

  override ignoreEvent(): boolean {
    // Allow events to pass through to React components
    return false;
  }
}

/**
 * Widget for rendering the draft comment editor.
 */
class DraftEditorWidget extends WidgetType {
  constructor(
    private lineIndex: number,
    private config: CommentWidgetConfig
  ) {
    super();
  }

  override toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-comment-widget cm-draft-editor-widget';
    container.dataset.draftLine = String(this.lineIndex);

    // Call mount callback for React portal
    if (this.config.onMountDraft) {
      requestAnimationFrame(() => {
        this.config.onMountDraft?.(this.lineIndex, container);
      });
    }

    return container;
  }

  override destroy(dom: HTMLElement): void {
    void dom; // May be used in future for cleanup
    if (this.config.onUnmountDraft) {
      this.config.onUnmountDraft();
    }
  }

  override eq(other: WidgetType): boolean {
    if (!(other instanceof DraftEditorWidget)) return false;
    return this.lineIndex === other.lineIndex;
  }

  override get estimatedHeight(): number {
    return 120; // Height for the editor
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * State field to manage comment widget state.
 */
interface CommentWidgetState {
  threadsByLine: Map<number, ReviewThread[]>;
  showComments: boolean;
  draftLineIndex: number | null;
  config: CommentWidgetConfig;
  decorations: DecorationSet;
}

function buildCommentDecorations(
  doc: { line: (n: number) => { from: number; to: number }; lines: number },
  state: Omit<CommentWidgetState, 'decorations'>
): DecorationSet {
  const { threadsByLine, showComments, draftLineIndex, config } = state;
  const builder: RangeSetBuilder<Decoration> = new RangeSetBuilder();

  // Collect all positions where we need widgets
  const widgetPositions: {
    lineIndex: number;
    type: 'draft' | 'thread';
    thread?: ReviewThread;
  }[] = [];

  // Add draft editor position
  if (draftLineIndex !== null && draftLineIndex < doc.lines) {
    widgetPositions.push({ lineIndex: draftLineIndex, type: 'draft' });
  }

  // Add thread positions
  if (showComments) {
    threadsByLine.forEach((threads, lineIndex) => {
      for (const thread of threads) {
        if (lineIndex < doc.lines) {
          widgetPositions.push({ lineIndex, type: 'thread', thread });
        }
      }
    });
  }

  // Sort by line index to ensure proper ordering in RangeSet
  widgetPositions.sort((a, b) => {
    if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
    // Draft comes before threads on the same line
    return a.type === 'draft' ? -1 : 1;
  });

  // Build decorations
  for (const pos of widgetPositions) {
    const docLine = doc.line(pos.lineIndex + 1); // 1-indexed

    if (pos.type === 'draft') {
      const widget = new DraftEditorWidget(pos.lineIndex, config);
      builder.add(
        docLine.to,
        docLine.to,
        Decoration.widget({ widget, block: true, side: 1 })
      );
    } else if (pos.thread) {
      const widget = new CommentThreadWidget(pos.thread, config);
      builder.add(
        docLine.to,
        docLine.to,
        Decoration.widget({ widget, block: true, side: 1 })
      );
    }
  }

  return builder.finish();
}

const commentWidgetField = StateField.define<CommentWidgetState>({
  create(state) {
    const initialState: Omit<CommentWidgetState, 'decorations'> = {
      threadsByLine: new Map<number, ReviewThread[]>(),
      showComments: true,
      draftLineIndex: null,
      config: {},
    };
    return {
      ...initialState,
      decorations: buildCommentDecorations(state.doc, initialState),
    };
  },

  update(value, tr) {
    let { threadsByLine, showComments, draftLineIndex } = value;
    const { config } = value;
    let needsRebuild = false;

    for (const effect of tr.effects) {
      if (effect.is(setCommentThreads)) {
        threadsByLine = effect.value;
        needsRebuild = true;
      } else if (effect.is(setShowComments)) {
        showComments = effect.value;
        needsRebuild = true;
      } else if (effect.is(setDraftLineIndex)) {
        draftLineIndex = effect.value;
        needsRebuild = true;
      }
    }

    // Rebuild if state changed or document changed
    if (needsRebuild || tr.docChanged) {
      return {
        threadsByLine,
        showComments,
        draftLineIndex,
        config,
        decorations: buildCommentDecorations(tr.state.doc, {
          threadsByLine,
          showComments,
          draftLineIndex,
          config,
        }),
      };
    }

    return value;
  },

  provide(field) {
    return EditorView.decorations.from(field, (value) => value.decorations);
  },
});

/**
 * Theme extension for comment widgets.
 */
const commentWidgetTheme = EditorView.baseTheme({
  '.cm-comment-widget': {
    padding: '8px 16px',
    borderTop: '1px solid var(--control-bg)',
    borderBottom: '1px solid var(--control-bg)',
    backgroundColor: 'var(--main-bg)',
    marginLeft: '96px', // Account for gutter width
  },
  '.cm-draft-editor-widget': {
    backgroundColor: 'var(--listview-hover)',
  },
});

/**
 * Creates the comment widgets extension.
 *
 * Usage:
 * ```ts
 * const extensions = [
 *   commentWidgets({
 *     threadsByLine: myThreadsMap,
 *     showComments: true,
 *     onMountThread: (threadId, container) => {
 *       // Render React CommentThread into container via portal
 *     },
 *   }),
 * ];
 *
 * // Update threads:
 * view.dispatch({
 *   effects: setCommentThreads.of(newThreadsMap),
 * });
 *
 * // Show draft editor at line 10:
 * view.dispatch({
 *   effects: setDraftLineIndex.of(10),
 * });
 * ```
 */
export function commentWidgets(config: CommentWidgetConfig = {}): Extension {
  const {
    threadsByLine = new Map<number, ReviewThread[]>(),
    showComments = true,
    draftLineIndex = null,
  } = config;

  return [
    commentWidgetField.init((state) => ({
      threadsByLine,
      showComments,
      draftLineIndex,
      config,
      decorations: buildCommentDecorations(state.doc, {
        threadsByLine,
        showComments,
        draftLineIndex,
        config,
      }),
    })),
    commentWidgetTheme,
  ];
}
