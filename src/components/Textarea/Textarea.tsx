import { forwardRef, TextareaHTMLAttributes } from "react";
import { FormField } from "@/components/FormField";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const textareaClasses = ["textbox", "textarea", error ? "textbox-error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <FormField label={label} error={error} helperText={helperText} id={id}>
        {({ id: fieldId, ariaDescribedBy, ariaInvalid }) => (
          <textarea
            ref={ref}
            id={fieldId}
            className={textareaClasses}
            style={{ width: "100%" }}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            {...props}
          />
        )}
      </FormField>
    );
  }
);

Textarea.displayName = "Textarea";
