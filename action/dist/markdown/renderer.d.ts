/**
 * Markdown Renderer for GitHub Flavored Markdown
 *
 * Pre-renders markdown to HTML with full GFM support including:
 * - Tables, task lists, strikethrough, autolinks
 * - Emoji shortcodes (:+1: → 👍)
 * - GitHub alerts/admonitions (> [!NOTE])
 * - @mentions and issue/PR references (#123)
 *
 * Output is sanitized for safe rendering in the browser.
 */
export interface RenderOptions {
    /** Repository in 'owner/repo' format for GitHub reference linking */
    repository?: string;
}
/**
 * Renders markdown to sanitized HTML.
 *
 * @param markdown - The markdown source to render
 * @param options - Rendering options
 * @returns Sanitized HTML string
 */
export declare function renderMarkdown(markdown: string, options?: RenderOptions): Promise<string>;
/**
 * Renders markdown synchronously (for use in sync contexts).
 * Note: This still uses the async pipeline internally but blocks.
 */
export declare function renderMarkdownSync(markdown: string, options?: RenderOptions): string;
//# sourceMappingURL=renderer.d.ts.map