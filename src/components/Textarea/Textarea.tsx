import { forwardRef, TextareaHTMLAttributes, useId } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    const textareaClasses = ["textbox", "textarea", error ? "textbox-error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={textareaId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={textareaClasses}
          style={{ width: "100%" }}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined
          }
          {...props}
        />
        {error && (
          <p
            id={`${textareaId}-error`}
            style={{ marginTop: "4px", fontSize: "12px", color: "var(--error-fg)" }}
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={`${textareaId}-helper`}
            style={{ marginTop: "4px", fontSize: "12px", color: "var(--control-disabled-fg)" }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
