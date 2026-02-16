'use client';

import { useState, useEffect } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { FullTextSearchLink } from '@/components/ui/FullTextSearchLink';
import { Button } from '@/components/ui/Button';
import { useStateFromPath } from '@/hooks/useStateFromPath';
import { X } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AlphabeticalIndex } from '@deproceduralizer/database';

interface GlossarySearchProps {
  /** Current search value (from URL state) */
  search: string;
  /** Called when search changes (after debounce) */
  onSearchChange: (value: string) => void;
  /** Current selected letter */
  selectedLetter: string | null;
  /** Called when letter changes */
  onLetterChange: (letter: string | null) => void;
  /** Called when clear all is clicked - clears ALL filters */
  onClearAll: () => void;
  /** Alphabetical index with counts */
  alphabeticalIndex: AlphabeticalIndex[];
  /** Whether search is loading */
  isLoading?: boolean;
  /** Whether any filters are active (from parent, includes all filter types) */
  hasActiveFilters: boolean;
}

// All letters for the alphabet bar
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Debounce delay for search input
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search and A-Z filter component for the glossary page.
 * Uses debounced search input to reduce URL updates during typing.
 */
export function GlossarySearch({
  search,
  onSearchChange,
  selectedLetter,
  onLetterChange,
  onClearAll,
  alphabeticalIndex,
  isLoading = false,
  hasActiveFilters,
}: GlossarySearchProps) {
  const state = useStateFromPath();
  // Local state for immediate UI feedback during typing
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebouncedValue(localSearch, SEARCH_DEBOUNCE_MS);

  // Sync local state when external search prop changes (e.g., from URL navigation)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Update parent when debounced value changes (and differs from current)
  useEffect(() => {
    if (debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, search, onSearchChange]);

  // Create a map for quick letter count lookup
  const letterCounts = new Map(
    alphabeticalIndex.map((item) => [item.letter.toUpperCase(), item.count])
  );

  // Local filters (search input + letter) - used for the filter summary text
  const hasLocalFilters = localSearch.length > 0 || selectedLetter !== null;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={localSearch}
          onSearch={setLocalSearch}
          placeholder="Filter by term..."
          isLoading={isLoading}
          className="flex-1"
        />
        <FullTextSearchLink query={localSearch} state={state} />
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="flex items-center gap-1 whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            Clear all
          </Button>
        )}
      </div>

      {/* A-Z letter bar */}
      <div role="group" aria-label="Filter by first letter" className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant={selectedLetter === null ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onLetterChange(null)}
          aria-label="Show all terms"
          aria-pressed={selectedLetter === null}
          className="px-3 py-1 h-auto text-xs font-medium"
        >
          All
        </Button>
        {ALPHABET.map((letter) => {
          const count = letterCounts.get(letter) ?? 0;
          const isSelected = selectedLetter === letter;
          const hasItems = count > 0;

          return (
            <Button
              key={letter}
              type="button"
              variant={isSelected ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onLetterChange(isSelected ? null : letter)}
              disabled={!hasItems && !isSelected}
              aria-label={`Filter by letter ${letter}${hasItems ? `, ${count} definition${count === 1 ? '' : 's'}` : ', no definitions'}`}
              aria-pressed={isSelected}
              className={`
                px-2.5 py-1 h-auto text-xs font-medium min-w-[32px]
                ${!hasItems && !isSelected ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              title={hasItems ? `${count} definition${count === 1 ? '' : 's'}` : 'No definitions'}
            >
              {letter}
            </Button>
          );
        })}
      </div>

      {/* Active filter summary */}
      {hasLocalFilters && (
        <div className="text-sm text-[var(--color-text-muted)]">
          Showing definitions
          {localSearch && <span className="font-medium"> matching &quot;{localSearch}&quot;</span>}
          {selectedLetter && (
            <span className="font-medium"> starting with &quot;{selectedLetter}&quot;</span>
          )}
        </div>
      )}
    </div>
  );
}

export default GlossarySearch;
