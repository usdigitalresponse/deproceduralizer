'use client';

import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
import type { AlphabeticalIndex } from '@deproceduralizer/database';

interface GlossarySearchProps {
  /** Current search value */
  search: string;
  /** Called when search changes */
  onSearchChange: (value: string) => void;
  /** Current selected letter */
  selectedLetter: string | null;
  /** Called when letter changes */
  onLetterChange: (letter: string | null) => void;
  /** Alphabetical index with counts */
  alphabeticalIndex: AlphabeticalIndex[];
  /** Whether search is loading */
  isLoading?: boolean;
}

// All letters for the alphabet bar
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Search and A-Z filter component for the glossary page
 */
export function GlossarySearch({
  search,
  onSearchChange,
  selectedLetter,
  onLetterChange,
  alphabeticalIndex,
  isLoading = false,
}: GlossarySearchProps) {
  // Create a map for quick letter count lookup
  const letterCounts = new Map(
    alphabeticalIndex.map((item) => [item.letter.toUpperCase(), item.count])
  );

  // Check if any filters are active
  const hasActiveFilters = search.length > 0 || selectedLetter !== null;

  const handleClearAll = () => {
    onSearchChange('');
    onLetterChange(null);
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onSearch={onSearchChange}
          placeholder="Search definitions by term..."
          isLoading={isLoading}
          className="flex-1"
        />
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="flex items-center gap-1 whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            Clear filters
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
      {hasActiveFilters && (
        <div className="text-sm text-[var(--color-text-muted)]">
          Showing definitions
          {search && <span className="font-medium"> matching "{search}"</span>}
          {selectedLetter && (
            <span className="font-medium"> starting with "{selectedLetter}"</span>
          )}
        </div>
      )}
    </div>
  );
}

export default GlossarySearch;
