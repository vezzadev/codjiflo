import Image from 'next/image';
import Markdown from 'react-markdown';
import type { Comment } from '../types';
import { Button } from '@/components';
import { formatTimeAgo } from '@/utils/time';

interface CommentItemProps {
  comment: Comment;
  isCurrentUser: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function CommentItem({ comment, isCurrentUser, onEdit, onDelete }: CommentItemProps) {
  const timeAgo = formatTimeAgo(comment.createdAt);

  return (
    <article
      className="comment-item"
      aria-label={`Comment by ${comment.author.login}, ${timeAgo}`}
    >
      <Image
        src={comment.author.avatarUrl}
        alt={`${comment.author.login} avatar`}
        width={32}
        height={32}
        className="comment-avatar"
      />
      <div className="comment-body">
        <div className="comment-meta">
          <span className="comment-author">{comment.author.login}</span>
          <time dateTime={comment.createdAt.toISOString()}>{timeAgo}</time>
          {comment.isPending && (
            <span className="badge badge-warning">
              Pending
            </span>
          )}
        </div>
        <div className="comment-content">
          <Markdown
            components={{
              a: ({ children, href, ...props }) => {
                const isExternal = typeof href === 'string' && /^https?:\/\//.test(href);

                return (
                  <a
                    {...props}
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    className="link"
                  >
                    {children}
                    {isExternal && (
                      <>
                        <span
                          aria-hidden="true"
                          className="external-link-icon"
                        >
                          ↗
                        </span>
                        <span className="sr-only">(opens in a new tab)</span>
                      </>
                    )}
                  </a>
                );
              },
            }}
          >
            {comment.body}
          </Markdown>
        </div>
        {isCurrentUser && (
          <div className="comment-actions">
            <Button
              label="Edit"
              variant="secondary"
              size="sm"
              onClick={onEdit}
            />
            <Button
              label="Delete"
              variant="secondary"
              size="sm"
              onClick={onDelete}
            />
          </div>
        )}
      </div>
    </article>
  );
}
