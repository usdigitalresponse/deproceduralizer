'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

/**
 * Accessible select component built on Radix UI.
 * Use this for form selects to ensure consistent styling and accessibility.
 *
 * Note: For DataTable header filters, continue using native selects
 * with compact styling that fits the header context.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  ({
    value,
    onValueChange,
    placeholder = 'Select...',
    options,
    disabled,
    className = '',
    id,
    name,
    'aria-label': ariaLabel,
    'data-testid': dataTestId,
  }, ref) => {
    return (
      <RadixSelect.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
      >
        <RadixSelect.Trigger
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          data-testid={dataTestId}
          className={`
            inline-flex items-center justify-between
            w-full
            px-3 py-2
            text-sm text-[var(--color-text)]
            bg-[var(--color-surface)]
            border border-[var(--color-neutral-300)]
            rounded-[var(--radius-md)]
            transition-colors duration-[var(--duration-fast)]
            hover:border-[var(--color-neutral-400)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            data-[placeholder]:text-[var(--color-text-muted)]
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            ${className}
          `.trim().replace(/\s+/g, ' ')}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className="ml-2 text-[var(--color-text-muted)]">
            <ChevronDownIcon />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className="
              overflow-hidden
              bg-[var(--color-surface)]
              rounded-[var(--radius-md)]
              border border-[var(--color-neutral-200)]
              shadow-lg
              z-50
              min-w-[var(--radix-select-trigger-width)]
            "
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.ScrollUpButton className="flex items-center justify-center h-6 bg-[var(--color-surface)] cursor-default">
              <ChevronUpIcon />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="p-1 max-h-[min(300px,var(--radix-select-content-available-height))] overflow-y-auto">
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className="
                    relative
                    flex items-center
                    px-3 py-2
                    text-sm text-[var(--color-text)]
                    rounded-[var(--radius-sm)]
                    cursor-pointer
                    outline-none
                    select-none
                    data-[highlighted]:bg-[var(--color-primary-faint)]
                    data-[highlighted]:text-[var(--color-primary)]
                    data-[state=checked]:font-medium
                    data-[disabled]:text-[var(--color-text-muted)]
                    data-[disabled]:pointer-events-none
                  "
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-2">
                    <CheckIcon />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="flex items-center justify-center h-6 bg-[var(--color-surface)] cursor-default">
              <ChevronDownIcon />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    );
  }
);

Select.displayName = 'Select';

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 4.5L6 8L9.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.5L6 4L9.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 6L5 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Select;
