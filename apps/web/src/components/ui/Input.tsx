'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    className = '',
    label,
    error,
    helperText,
    id,
    disabled,
    ...props
  }, ref) => {
    const inputId = id || props.name;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`
            w-full
            px-3 py-2
            text-sm text-[var(--color-text)]
            bg-[var(--color-surface)]
            border rounded-[var(--radius-md)]
            transition-colors duration-[var(--transition-fast)]
            placeholder:text-[var(--color-text-muted)]
            ${hasError
              ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-2 focus:ring-[var(--color-danger-bg)]'
              : 'border-[var(--color-neutral-300)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--color-neutral-50)]' : ''}
            focus:outline-none
            ${className}
          `.trim().replace(/\s+/g, ' ')}
          {...props}
        />
        {(error || helperText) && (
          <p
            className={`mt-1.5 text-xs ${
              hasError ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
