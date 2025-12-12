'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--color-primary)] text-white
    hover:bg-[var(--color-primary-strong)]
    active:bg-[var(--color-primary-stronger)]
    focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2
  `,
  secondary: `
    bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)]
    hover:bg-[var(--color-primary-weaker)]
    active:bg-[var(--color-primary-weak)]
    focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2
  `,
  ghost: `
    bg-transparent text-[var(--color-text-secondary)]
    hover:bg-[var(--color-neutral-100)]
    active:bg-[var(--color-neutral-200)]
    focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2
  `,
  danger: `
    bg-[var(--color-danger)] text-white
    hover:bg-[#9f2424]
    active:bg-[#871d1d]
    focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    children,
    ...props
  }, ref) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-[var(--radius-md)]
          transition-colors duration-[var(--transition-fast)]
          outline-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        disabled={isDisabled}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
