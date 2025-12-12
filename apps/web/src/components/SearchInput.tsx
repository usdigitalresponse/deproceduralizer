'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface SearchInputProps {
  initialValue?: string;
  placeholder?: string;
}

export default function SearchInput({
  initialValue = '',
  placeholder = 'Search regulations...',
}: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Update search params with debounce
  const updateSearch = useCallback(
    (searchValue: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchValue.trim()) {
        params.set('search', searchValue.trim());
        params.set('page', '1'); // Reset to first page on new search
      } else {
        params.delete('search');
        params.set('page', '1');
      }

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new debounced update
    debounceTimeout.current = setTimeout(() => {
      updateSearch(newValue);
    }, 300);
  };

  const handleClear = () => {
    setValue('');
    updateSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full max-w-md">
      {/* Search Icon */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-[var(--color-text-muted)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Input */}
      <input
        type="search"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search regulations"
        className="
          w-full pl-10 pr-10 py-2 text-sm
          bg-[var(--color-surface)]
          border border-[var(--color-neutral-300)]
          rounded-[var(--radius-md)]
          text-[var(--color-text)]
          placeholder:text-[var(--color-text-muted)]
          transition-colors duration-[var(--transition-fast)]
          hover:border-[var(--color-neutral-400)]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
        "
      />

      {/* Clear Button */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="
            absolute inset-y-0 right-0 pr-3 flex items-center
            text-[var(--color-text-muted)]
            hover:text-[var(--color-text)]
            transition-colors duration-[var(--transition-fast)]
          "
        >
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
