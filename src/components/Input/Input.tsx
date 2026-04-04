import { forwardRef, type InputHTMLAttributes } from "react";
import { TextField, Label, Input as AriaInput, Text, FieldError } from 'react-aria-components';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, 'aria-label': ariaLabel, ...props }, ref) => {
    const inputClasses = ["textbox", error ? "textbox-error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <TextField isInvalid={!!error} className="form-group" {...(id ? { id } : {})} {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}>
        {label && <Label className="label">{label}</Label>}
        <AriaInput
          ref={ref}
          className={inputClasses}
          style={{ width: "100%" }}
          {...props as { [key: string]: unknown }}
        />
        {helperText && !error && <Text slot="description" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--control-disabled-fg)' }}>{helperText}</Text>}
        {error && <FieldError style={{ marginTop: '4px', fontSize: '12px', color: 'var(--error-fg)' }}>{error}</FieldError>}
      </TextField>
    );
  }
);

Input.displayName = "Input";
