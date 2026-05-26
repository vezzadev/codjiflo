import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components';
import { TextField, Label, TextArea } from '@/components/ui';

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
      <TextField value={value} onChange={onChange} className="form-group">
        <Label className="label">{label}</Label>
        <TextArea
          rows={4}
          placeholder="Leave a comment"
          onKeyDown={handleKeyDown}
          className="textbox textarea"
          style={{ width: '100%' }}
        />
      </TextField>
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
