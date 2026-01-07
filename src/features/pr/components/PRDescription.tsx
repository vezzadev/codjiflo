import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PRDescriptionProps {
  description: string;
}

/**
 * Renders PR description as markdown
 * S-1.2: AC-1.2.2 - Markdown rendered
 */
export function PRDescription({ description }: PRDescriptionProps) {
  if (!description.trim()) {
    return (
      <div className="pr-description pr-description-empty">
        No description provided.
      </div>
    );
  }

  return (
    <div className="pr-description">
      <div className="pr-description-content">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Open links in new tab
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
