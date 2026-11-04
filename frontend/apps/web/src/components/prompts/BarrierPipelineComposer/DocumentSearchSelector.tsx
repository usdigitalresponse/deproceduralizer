'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Search, Loader2, FileText } from 'lucide-react';
import { searchSectionsForComposer } from '@/lib/actions/barrier-prompt-composer';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { VALID_JURISDICTIONS, JURISDICTION_CONFIG, DEFAULT_JURISDICTION } from '@/types/state';
import type { JurisdictionCode } from '@/types/state';
import type { SectionSearchResult } from './types';

interface DocumentSearchSelectorProps {
  onSelect: (documentId: number) => void;
  isLoading?: boolean;
}

export function DocumentSearchSelector({
  onSelect,
  isLoading = false,
}: DocumentSearchSelectorProps) {
  const [query, setQuery] = useState('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionCode>(DEFAULT_JURISDICTION);
  const [results, setResults] = useState<SectionSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<SectionSearchResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await searchSectionsForComposer(debouncedQuery, jurisdiction);
      if (result.success) {
        setResults(result.data);
        setIsOpen(true);
      }
    });
  }, [debouncedQuery, jurisdiction]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (result: SectionSearchResult) => {
    setSelected(result);
    setQuery('');
    setIsOpen(false);
    onSelect(result.id);
  };

  return (
    <div className="space-y-3">
      {/* Jurisdiction selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text)]">
          Jurisdiction:
        </label>
        <div className="flex gap-1">
          {VALID_JURISDICTIONS.map((j) => (
            <button
              key={j}
              onClick={() => {
                setJurisdiction(j);
                setSelected(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${
                jurisdiction === j
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)]'
              }`}
            >
              {JURISDICTION_CONFIG[j].abbrev}
            </button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
          Search for a regulatory section
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="e.g. 10 NYCRR 405.15 or fire safety..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            className={`
              w-full pl-9 pr-10 py-2.5 text-sm
              border border-[var(--color-neutral-200)] rounded-[var(--radius-md)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
          {(isPending || isLoading) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--color-primary)]" />
          )}
        </div>

        {/* Results dropdown */}
        {isOpen && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-[var(--color-background)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] shadow-lg max-h-[320px] overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-primary-faint)] transition-colors border-b border-[var(--color-neutral-50)] last:border-b-0"
              >
                <FileText className="w-4 h-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text)] truncate">
                    {result.title}
                  </div>
                  {result.citation && (
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {result.citation}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && query.length >= 2 && results.length === 0 && !isPending && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-[var(--color-background)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] shadow-lg px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
            No sections found matching &quot;{query}&quot;
          </div>
        )}
      </div>

      {/* Selected document display */}
      {selected && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary-weaker)] border border-[var(--color-primary-weak)] rounded-[var(--radius-md)]">
          <FileText className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-[var(--color-text)]">
              {selected.citation || selected.title}
            </span>
            {selected.citation && (
              <span className="text-xs text-[var(--color-text-muted)] ml-2">
                {selected.title}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
