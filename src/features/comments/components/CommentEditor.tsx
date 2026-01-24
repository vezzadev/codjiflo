import { useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button, Textarea } from '@/components';
import { MarkdownToolbar } from './MarkdownToolbar';

interface CommentEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  label: string;
  /** Whether to show the markdown toolbar (default: true) */
  showToolbar?: boolean;
}

export function CommentEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Comment',
  label,
  showToolbar = true,
}: CommentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter to submit
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        if (!value.trim()) {
          return;
        }
        onSubmit();
        return;
      }

      // Ctrl+B for bold
      if (event.key === 'b' && event.ctrlKey) {
        event.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const selected = value.slice(start, end);
          const newValue = selected
            ? value.slice(0, start) + '**' + selected + '**' + value.slice(end)
            : value.slice(0, start) + '**bold**' + value.slice(end);
          onChange(newValue);
        }
        return;
      }

      // Ctrl+I for italic
      if (event.key === 'i' && event.ctrlKey) {
        event.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const selected = value.slice(start, end);
          const newValue = selected
            ? value.slice(0, start) + '_' + selected + '_' + value.slice(end)
            : value.slice(0, start) + '_italic_' + value.slice(end);
          onChange(newValue);
        }
        return;
      }
    },
    [onSubmit, value, onChange]
  );

  return (
    <div className="comment-editor">
      {showToolbar && (
        <MarkdownToolbar
          textareaRef={textareaRef}
          value={value}
          onTextChange={onChange}
          disabled={isSubmitting}
        />
      )}
      <Textarea
        ref={textareaRef}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder="Leave a comment (Markdown supported)"
        onKeyDown={handleKeyDown}
      />
      <div className="comment-editor-actions">
        <Button
          label={isSubmitting ? `${submitLabel}...` : submitLabel}
          onClick={onSubmit}
          disabled={isSubmitting || value.trim().length === 0}
        />
        {onCancel && (
          <Button
            label="Cancel"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          />
        )}
        {isSubmitting && (
          <span
            className="spinner-small"
            aria-label="Submitting comment"
          />
        )}
      </div>
    </div>
  );
}
