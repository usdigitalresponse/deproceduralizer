'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchInputProps {
  /** Current search value */
  value?: string;
  /** Called when value changes (debounced) */
  onSearch?: (value: string) => void;
  /** Called on every keystroke (not debounced) */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Show loading indicator */
  isLoading?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class name */
  className?: string;
  /** Aria label for accessibility */
  'aria-label'?: string;
}

/**
 * Search input with debouncing, clear button, and loading state.
 *
 * @example
 * // Controlled with debounced search
 * <SearchInput
 *   value={search}
 *   onSearch={(value) => updateUrlParams({ search: value })}
 *   placeholder="Search..."
 * />
 *
 * @example
 * // With custom debounce and loading state
 * <SearchInput
 *   value={search}
 *   onSearch={handleSearch}
 *   debounceMs={500}
 *   isLoading={isSearching}
 *   size="sm"
 * />
 */
export function SearchInput({
  value: controlledValue,
  onSearch,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  isLoading = false,
  size = 'md',
  className = '',
  'aria-label': ariaLabel = 'Search',
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const isControlled = controlledValue !== undefined;

  // Sync internal value when controlled value changes
  useEffect(() => {
    if (isControlled && controlledValue !== internalValue) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue, isControlled, internalValue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(newValue);

      // Clear existing timeout
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      // Set new debounced search
      debounceTimeout.current = setTimeout(() => {
        onSearch?.(newValue.trim());
      }, debounceMs);
    },
    [onChange, onSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange?.('');
    onSearch?.('');

    // Clear any pending debounce
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
  }, [onChange, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear]
  );

  // Size variants
  const sizeClasses = {
    sm: 'py-1.5 pl-8 pr-8 text-sm',
    md: 'py-2 pl-10 pr-10 text-sm',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  };

  const iconLeftClasses = {
    sm: 'pl-2.5',
    md: 'pl-3',
  };

  const iconRightClasses = {
    sm: 'pr-2',
    md: 'pr-3',
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Icon */}
      <div
        className={`absolute inset-y-0 left-0 ${iconLeftClasses[size]} flex items-center pointer-events-none`}
      >
        <Search
          className={`${iconSizeClasses[size]} text-[var(--color-text-muted)]`}
          aria-hidden="true"
        />
      </div>

      {/* Input */}
      <input
        type="search"
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`
          w-full ${sizeClasses[size]}
          bg-[var(--color-surface)]
          border border-[var(--color-neutral-300)]
          rounded-[var(--radius-md)]
          text-[var(--color-text)]
          placeholder:text-[var(--color-text-muted)]
          transition-colors duration-[var(--duration-fast)]
          hover:border-[var(--color-neutral-400)]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1
        `}
      />

      {/* Clear/Loading Button */}
      <div
        className={`absolute inset-y-0 right-0 ${iconRightClasses[size]} flex items-center`}
      >
        {isLoading ? (
          <Loader2
            className={`${iconSizeClasses[size]} text-[var(--color-text-muted)] animate-spin`}
            aria-hidden="true"
          />
        ) : internalValue ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="
              text-[var(--color-text-muted)]
              hover:text-[var(--color-text)]
              transition-colors duration-[var(--duration-fast)]
            "
          >
            <X className={iconSizeClasses[size]} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default SearchInput;
