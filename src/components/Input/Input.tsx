import { forwardRef, InputHTMLAttributes } from "react";
import { FormField } from "@/components/FormField";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputClasses = ["textbox", error ? "textbox-error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <FormField label={label} error={error} helperText={helperText} id={id}>
        {({ id: fieldId, ariaDescribedBy, ariaInvalid }) => (
          <input
            ref={ref}
            id={fieldId}
            className={inputClasses}
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

Input.displayName = "Input";
