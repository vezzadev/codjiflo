/**
 * Scroll Sync Extension for CodeMirror 6
 *
 * Synchronizes scroll positions between two CodeMirror editors
 * for side-by-side diff view.
 */

import { type Extension, Facet } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

/**
 * Configuration for scroll synchronization.
 */
export interface ScrollSyncConfig {
  /** The partner editor to sync with */
  partner?: EditorView | null;
  /** Direction of sync: 'source' (this editor drives), 'target' (partner drives), or 'bidirectional' */
  direction?: 'source' | 'target' | 'bidirectional';
  /** Callback when scroll position changes */
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  /** Debounce delay in ms (default: 0 for no debounce) */
  debounceMs?: number;
}

/**
 * Facet to store scroll sync configuration.
 */
const scrollSyncConfig = Facet.define<ScrollSyncConfig, ScrollSyncConfig>({
  combine(configs) {
    return configs[configs.length - 1] ?? { direction: 'bidirectional' };
  },
});

/**
 * Facet to store the partner editor reference.
 */
const scrollSyncPartner = Facet.define<EditorView | null, EditorView | null>({
  combine(partners) {
    return partners[partners.length - 1] ?? null;
  },
});

/**
 * View plugin that handles scroll synchronization.
 */
const scrollSyncPlugin = ViewPlugin.fromClass(
  class {
    private scrollHandler: (() => void) | null = null;
    private isSyncing = false;
    private debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(private view: EditorView) {
      this.setupScrollHandler();
    }

    setupScrollHandler(): void {
      const config = this.view.state.facet(scrollSyncConfig);
      const { direction = 'bidirectional', onScroll, debounceMs = 0 } = config;

      // Only setup handler if this editor is source or bidirectional
      if (direction === 'target') return;

      this.scrollHandler = () => {
        if (this.isSyncing) return;

        const handler = () => {
          const scrollTop = this.view.scrollDOM.scrollTop;
          const scrollLeft = this.view.scrollDOM.scrollLeft;

          // Notify callback
          onScroll?.(scrollTop, scrollLeft);

          // Sync to partner
          const partner = this.view.state.facet(scrollSyncPartner);
          if (partner?.scrollDOM) {
            this.isSyncing = true;
            partner.scrollDOM.scrollTop = scrollTop;
            partner.scrollDOM.scrollLeft = scrollLeft;

            // Use RAF to reset syncing flag to avoid feedback loops
            requestAnimationFrame(() => {
              this.isSyncing = false;
            });
          }
        };

        if (debounceMs > 0) {
          if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
          }
          this.debounceTimeout = setTimeout(handler, debounceMs);
        } else {
          handler();
        }
      };

      this.view.scrollDOM.addEventListener('scroll', this.scrollHandler);
    }

    update(update: ViewUpdate): void {
      // Partner might have changed, but we handle it through facet
      void update;
    }

    destroy(): void {
      if (this.scrollHandler) {
        this.view.scrollDOM.removeEventListener('scroll', this.scrollHandler);
      }
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
    }
  }
);

/**
 * Creates a scroll sync extension.
 *
 * Usage for a pair of editors:
 * ```ts
 * // Left editor (drives scroll)
 * const leftExtensions = [
 *   createScrollSync({
 *     partner: rightView,
 *     direction: 'source',
 *   }),
 * ];
 *
 * // Right editor (follows scroll)
 * const rightExtensions = [
 *   createScrollSync({
 *     partner: leftView,
 *     direction: 'target',
 *   }),
 * ];
 *
 * // Or bidirectional (both can drive):
 * const extensions = [
 *   createScrollSync({
 *     partner: otherView,
 *     direction: 'bidirectional',
 *   }),
 * ];
 * ```
 *
 * To update the partner dynamically:
 * ```ts
 * view.dispatch({
 *   effects: StateEffect.reconfigure.of([
 *     createScrollSync({ partner: newPartnerView }),
 *   ]),
 * });
 * ```
 */
export function createScrollSync(config: ScrollSyncConfig = {}): Extension {
  return [
    scrollSyncConfig.of(config),
    scrollSyncPartner.of(config.partner ?? null),
    scrollSyncPlugin,
  ];
}

/**
 * Convenience export for backward compatibility.
 */
export const scrollSync = createScrollSync;

/**
 * Helper to create a bidirectional scroll sync pair.
 * Returns extensions for both left and right editors.
 */
export function createScrollSyncPair(): {
  left: (partner: EditorView) => Extension;
  right: (partner: EditorView) => Extension;
} {
  return {
    left: (partner) =>
      createScrollSync({
        partner,
        direction: 'bidirectional',
      }),
    right: (partner) =>
      createScrollSync({
        partner,
        direction: 'bidirectional',
      }),
  };
}

/**
 * Programmatically sync scroll position.
 * Useful when you need to sync from external events.
 */
export function syncScrollPosition(
  source: EditorView,
  target: EditorView,
  options?: { top?: number; left?: number }
): void {
  const top = options?.top ?? source.scrollDOM.scrollTop;
  const left = options?.left ?? source.scrollDOM.scrollLeft;

  target.scrollDOM.scrollTop = top;
  target.scrollDOM.scrollLeft = left;
}
