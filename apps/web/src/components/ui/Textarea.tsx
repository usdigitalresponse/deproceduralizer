'use client';

import { forwardRef, TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className = '',
    label,
    error,
    helperText,
    id,
    disabled,
    rows = 3,
    ...props
  }, ref) => {
    const textareaId = id || props.name;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          rows={rows}
          className={`
            w-full
            px-3 py-2
            text-sm text-[var(--color-text)]
            bg-[var(--color-surface)]
            border rounded-[var(--radius-md)]
            transition-colors duration-[var(--duration-fast)]
            placeholder:text-[var(--color-text-muted)]
            resize-vertical
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

Textarea.displayName = 'Textarea';

export default Textarea;
