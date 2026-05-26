import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Button, Textarea } from '@/components';

interface CommentEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  label: string;
}

export function CommentEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Comment',
  label,
}: CommentEditorProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        if (!value.trim()) {
          return;
        }
        onSubmit();
      }
    },
    [onSubmit, value]
  );

  return (
    <div className="comment-editor">
      <Textarea
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder="Leave a comment"
        onKeyDown={handleKeyDown}
      />
      <div className="comment-editor-actions">
        <Button
          onPress={onSubmit}
          isDisabled={isSubmitting || value.trim().length === 0}
        >
          {isSubmitting ? `${submitLabel}...` : submitLabel}
        </Button>
        {onCancel && (
          <Button
            variant="secondary"
            onPress={onCancel}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
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
