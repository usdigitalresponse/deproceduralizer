'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';

interface BrowseSearchInputProps {
  initialValue?: string;
  placeholder?: string;
}

export function BrowseSearchInput({
  initialValue = '',
  placeholder = 'Search by title...',
}: BrowseSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Update search params with debounce
  const updateSearch = useCallback(
    (searchValue: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchValue.trim()) {
        params.set('search', searchValue.trim());
      } else {
        params.delete('search');
      }

      // Clear expanded state when search changes (tree will reset)
      params.delete('expanded');

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new debounced update (300ms)
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

  // Sync with URL when navigating
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== value) {
      setValue(urlSearch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="relative w-48">
      {/* Search Icon */}
      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
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
          w-full pl-8 pr-8 py-1.5 text-sm
          bg-[var(--color-surface)]
          border border-[var(--color-neutral-300)]
          rounded-[var(--radius-md)]
          text-[var(--color-text)]
          placeholder:text-[var(--color-text-muted)]
          transition-colors duration-[var(--duration-fast)]
          hover:border-[var(--color-neutral-400)]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1
        "
      />

      {/* Clear Button */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="
            absolute inset-y-0 right-0 pr-2 flex items-center
            text-[var(--color-text-muted)]
            hover:text-[var(--color-text)]
            transition-colors duration-[var(--duration-fast)]
          "
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default BrowseSearchInput;
