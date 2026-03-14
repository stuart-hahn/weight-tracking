import { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;
type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export interface FieldProps {
  id: string;
  label: string;
  error?: string | null;
  hint?: string | null;
  required?: boolean;
}

export const FieldInput = forwardRef<HTMLInputElement, FieldProps & Omit<InputProps, 'id'>>(
  function FieldInput(
    { id, label, error, hint, required, className = '', ...inputProps },
    ref
  ) {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={id}>
          {label}
          {required && ' *'}
        </label>
        <input
          ref={ref}
          id={id}
          className={`form-input ${error ? 'form-input--error' : ''} ${className}`.trim()}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          required={required}
          {...inputProps}
        />
        {hint && !error && (
          <p id={`${id}-hint`} className="form-hint">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

export function FieldSelect({
  id,
  label,
  error,
  hint,
  required,
  className = '',
  children,
  ...selectProps
}: FieldProps & Omit<SelectProps, 'id'>) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}
        {required && ' *'}
      </label>
      <select
        id={id}
        className={`form-input ${error ? 'form-input--error' : ''} ${className}`.trim()}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        required={required}
        {...selectProps}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FieldTextarea({
  id,
  label,
  error,
  hint,
  required,
  className = '',
  ...textareaProps
}: FieldProps & Omit<TextareaProps, 'id'>) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}
        {required && ' *'}
      </label>
      <textarea
        id={id}
        className={`form-input ${error ? 'form-input--error' : ''} ${className}`.trim()}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        required={required}
        {...textareaProps}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
