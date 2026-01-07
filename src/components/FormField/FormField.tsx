import { ReactNode, useId } from 'react';

export interface FormFieldProps {
  label?: string | undefined;
  error?: string | undefined;
  helperText?: string | undefined;
  id?: string | undefined;
  children: (props: {
    id: string;
    errorId: string | undefined;
    helperId: string | undefined;
    ariaDescribedBy: string | undefined;
    ariaInvalid: 'true' | 'false';
  }) => ReactNode;
}

/**
 * Shared form field wrapper that handles label, error, and helper text rendering.
 * Used by Input and Textarea components to reduce code duplication.
 */
export function FormField({
  label,
  error,
  helperText,
  id,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const helperId = !error && helperText ? `${fieldId}-helper` : undefined;
  const ariaDescribedBy = errorId ?? helperId;
  const ariaInvalid: 'true' | 'false' = error ? 'true' : 'false';

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={fieldId} className="label">
          {label}
        </label>
      )}
      {children({
        id: fieldId,
        errorId,
        helperId,
        ariaDescribedBy,
        ariaInvalid,
      })}
      {error && (
        <p
          id={errorId}
          style={{ marginTop: '4px', fontSize: '12px', color: 'var(--error-fg)' }}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      {!error && helperText && (
        <p
          id={helperId}
          style={{ marginTop: '4px', fontSize: '12px', color: 'var(--control-disabled-fg)' }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
