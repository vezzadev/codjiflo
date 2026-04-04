import { forwardRef, type InputHTMLAttributes } from "react";
import { TextField, Label, Input as AriaInput, Text, type InputProps as AriaInputProps } from 'react-aria-components';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
}

// Pick the DOM attributes that React Aria's Input accepts and that callers actually use
type SafeInputProps = Pick<AriaInputProps, 'type' | 'value' | 'placeholder' | 'disabled' | 'required' | 'autoFocus' | 'autoComplete' | 'name' | 'onChange' | 'onKeyDown' | 'onFocus' | 'onBlur'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, 'aria-label': ariaLabel, ...props }, ref) => {
    const inputClasses = ["textbox", error ? "textbox-error" : "", className]
      .filter(Boolean)
      .join(" ");

    // Extract only the props that AriaInput supports to maintain type safety
    const safeProps: Partial<SafeInputProps> = {};
    if (props.type !== undefined) safeProps.type = props.type;
    if (props.value !== undefined) safeProps.value = props.value;
    if (props.placeholder !== undefined) safeProps.placeholder = props.placeholder;
    if (props.disabled !== undefined) safeProps.disabled = props.disabled;
    if (props.required !== undefined) safeProps.required = props.required;
    if (props.autoFocus !== undefined) safeProps.autoFocus = props.autoFocus;
    if (props.autoComplete !== undefined) safeProps.autoComplete = props.autoComplete;
    if (props.name !== undefined) safeProps.name = props.name;
    if (props.onChange !== undefined) safeProps.onChange = props.onChange;
    if (props.onKeyDown !== undefined) safeProps.onKeyDown = props.onKeyDown;
    if (props.onFocus !== undefined) safeProps.onFocus = props.onFocus;
    if (props.onBlur !== undefined) safeProps.onBlur = props.onBlur;

    return (
      <TextField isInvalid={!!error} className="form-group" {...(id ? { id } : {})} {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}>
        {label && <Label className="label">{label}</Label>}
        <AriaInput
          ref={ref}
          className={inputClasses}
          style={{ width: "100%" }}
          {...safeProps}
        />
        {helperText && !error && <Text slot="description" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--control-disabled-fg)' }}>{helperText}</Text>}
        {error && <Text slot="errorMessage" role="alert" aria-live="polite" style={{ marginTop: '4px', fontSize: '12px', color: 'var(--error-fg)' }}>{error}</Text>}
      </TextField>
    );
  }
);

Input.displayName = "Input";
