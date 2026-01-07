import { useMemo } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeRemoveComments from 'rehype-remove-comments';
import remarkGemoji from 'remark-gemoji';
import remarkGfm from 'remark-gfm';
import remarkGithub from 'remark-github';
import { remarkGitHubAlerts } from 'remark-github-markdown-alerts';
import type { PluggableList } from 'unified';

interface PRDescriptionProps {
  description: string;
  /** Repository in 'owner/repo' format for GitHub reference linking */
  repository?: string;
}

/**
 * Renders PR description as markdown
 * S-1.2: AC-1.2.2 - Markdown rendered
 */
export function PRDescription({ description, repository }: PRDescriptionProps) {
  const remarkPlugins = useMemo<PluggableList>(() => {
    const plugins: PluggableList = [
      remarkGfm,
      remarkGemoji,
      remarkGitHubAlerts,
    ];
    if (repository) {
      plugins.push([remarkGithub, { repository }]);
    }
    return plugins;
  }, [repository]);

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
          remarkPlugins={remarkPlugins}
          rehypePlugins={[rehypeRaw, rehypeRemoveComments]}
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
