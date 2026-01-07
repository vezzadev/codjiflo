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

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import remarkGithub from 'remark-github';
import { remarkGitHubAlerts } from 'remark-github-markdown-alerts';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

/**
 * Extended sanitization schema that allows GitHub-specific elements
 * while remaining secure against XSS attacks.
 */
const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // GitHub alerts use these elements
    'div',
    'span',
    'svg',
    'path',
  ],
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ['className', /^markdown-alert/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ['className', /^markdown-alert/],
      'ariaHidden',
    ],
    svg: ['viewBox', 'width', 'height', 'fill', 'className', 'ariaHidden'],
    path: ['d', 'fill', 'fillRule'],
    input: [
      ...(defaultSchema.attributes?.input ?? []),
      ['type', 'checkbox'],
      ['checked'],
      ['disabled'],
    ],
  },
};

export interface RenderOptions {
  /** Repository in 'owner/repo' format for GitHub reference linking */
  repository?: string;
}

/**
 * Creates a configured markdown processor for the given repository.
 */
function createProcessor(options: RenderOptions = {}) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkGemoji)
    .use(remarkGitHubAlerts);

  if (options.repository) {
    processor.use(remarkGithub, { repository: options.repository });
  }

  return processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
}

/**
 * Renders markdown to sanitized HTML.
 *
 * @param markdown - The markdown source to render
 * @param options - Rendering options
 * @returns Sanitized HTML string
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions = {}
): Promise<string> {
  const processor = createProcessor(options);
  const result = await processor.process(markdown);
  return String(result);
}

/**
 * Renders markdown synchronously (for use in sync contexts).
 * Note: This still uses the async pipeline internally but blocks.
 */
export function renderMarkdownSync(
  markdown: string,
  options: RenderOptions = {}
): string {
  const processor = createProcessor(options);
  const result = processor.processSync(markdown);
  return String(result);
}
