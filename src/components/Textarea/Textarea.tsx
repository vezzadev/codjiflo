import { forwardRef, type TextareaHTMLAttributes } from "react";
import { TextField, Label, TextArea as AriaTextArea, Text } from 'react-aria-components';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, 'aria-label': ariaLabel, ...props }, ref) => {
    const textareaClasses = ["textbox", "textarea", error ? "textbox-error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <TextField isInvalid={!!error} className="form-group" {...(id ? { id } : {})} {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}>
        {label && <Label className="label">{label}</Label>}
        <AriaTextArea
          ref={ref}
          className={textareaClasses}
          style={{ width: "100%" }}
          {...props}
        />
        {helperText && !error && <Text slot="description" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--control-disabled-fg)' }}>{helperText}</Text>}
        {error && <Text slot="errorMessage" role="alert" aria-live="polite" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--error-fg)' }}>{error}</Text>}
      </TextField>
    );
  }
);

Textarea.displayName = "Textarea";
