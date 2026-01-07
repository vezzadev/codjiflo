import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PRDescriptionProps {
  /** Raw markdown source (used for fallback or when renderedHtml not available) */
  description: string;
  /** Pre-rendered HTML from SQLite artifact (preferred) */
  renderedHtml?: string | undefined;
}

/**
 * Renders PR description as markdown.
 * Uses pre-rendered HTML when available (from SQLite artifact),
 * otherwise falls back to runtime markdown rendering.
 *
 * S-1.2: AC-1.2.2 - Markdown rendered
 */
export function PRDescription({ description, renderedHtml }: PRDescriptionProps) {
  if (!description.trim() && !renderedHtml) {
    return (
      <div className="pr-description pr-description-empty">
        No description provided.
      </div>
    );
  }

  // Use pre-rendered HTML when available (sanitized at build time in action)
  if (renderedHtml) {
    return (
      <div className="pr-description">
        <div
          className="pr-description-content"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    );
  }

  // Fallback: runtime markdown rendering for degraded mode
  // Uses basic GFM support (tables, task lists, strikethrough, autolinks)
  return (
    <div className="pr-description">
      <div className="pr-description-content">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                {children}
              </a>
            ),
          }}
        >
          {description}
        </Markdown>
      </div>
    </div>
  );
}
