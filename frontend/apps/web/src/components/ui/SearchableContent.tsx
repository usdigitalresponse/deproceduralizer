'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Input } from './Input';

interface SearchableContentProps {
  content: string;
  className?: string;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Whether search is expanded by default */
  defaultExpanded?: boolean;
  /** Maximum height for content area */
  maxHeight?: string;
  /** Children to render instead of plain text (for AnnotatableContent integration) */
  children?: React.ReactNode;
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void;
}

/**
 * Displays content with an inline search feature that highlights matches.
 * Can be used standalone or as a wrapper for other content components.
 */
export function SearchableContent({
  content,
  className = '',
  placeholder = 'Search in text...',
  defaultExpanded = false,
  maxHeight = '16rem',
  children,
  onSearchChange,
}: SearchableContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(defaultExpanded);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  // Track if search was opened by user click (vs defaultExpanded) for auto-focus
  const [userToggledSearch, setUserToggledSearch] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Find all matches
  const matches = useMemo(() => {
    if (!searchQuery.trim() || !content) return [];

    const query = searchQuery.toLowerCase();
    const matches: { start: number; end: number }[] = [];
    let pos = 0;
    const lowerContent = content.toLowerCase();

    while (pos < content.length) {
      const idx = lowerContent.indexOf(query, pos);
      if (idx === -1) break;
      matches.push({ start: idx, end: idx + query.length });
      pos = idx + 1;
    }

    return matches;
  }, [content, searchQuery]);

  // Reset match refs when matches change
  useEffect(() => {
    matchRefs.current = new Array(matches.length).fill(null);
  }, [matches.length]);

  // Scroll to current match
  useEffect(() => {
    if (matches.length > 0 && matchRefs.current[currentMatchIndex]) {
      matchRefs.current[currentMatchIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentMatchIndex, matches.length]);

  // Reset current match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    onSearchChange?.(value);
  }, [onSearchChange]);

  const goToNextMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  }, [matches.length]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  }, [matches.length]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setIsSearchVisible(false);
    }
  }, [goToNextMatch, goToPrevMatch]);

  // Render content with highlights
  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim() || matches.length === 0 || children) {
      return children || content;
    }

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    matches.forEach((match, idx) => {
      // Add text before match
      if (match.start > lastEnd) {
        parts.push(content.substring(lastEnd, match.start));
      }

      // Add highlighted match
      const isCurrent = idx === currentMatchIndex;
      parts.push(
        <span
          key={`match-${idx}`}
          ref={(el) => { matchRefs.current[idx] = el; }}
          className={`${
            isCurrent
              ? 'bg-[var(--color-warning)] text-[var(--color-text)]'
              : 'bg-yellow-200 text-[var(--color-text)]'
          } rounded px-0.5`}
        >
          {content.substring(match.start, match.end)}
        </span>
      );

      lastEnd = match.end;
    });

    // Add remaining text
    if (lastEnd < content.length) {
      parts.push(content.substring(lastEnd));
    }

    return parts;
  }, [content, searchQuery, matches, currentMatchIndex, children]);

  return (
    <div className={className}>
      {/* Search Toggle & Input */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => {
            const newVisible = !isSearchVisible;
            setIsSearchVisible(newVisible);
            if (newVisible) setUserToggledSearch(true);
          }}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          title={isSearchVisible ? 'Hide search' : 'Search in text (Ctrl+F)'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search</span>
        </button>

        {isSearchVisible && (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 max-w-xs">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="text-xs py-1 h-7"
                autoFocus={userToggledSearch}
              />
            </div>

            {searchQuery && (
              <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                <span>
                  {matches.length > 0
                    ? `${currentMatchIndex + 1}/${matches.length}`
                    : 'No matches'}
                </span>

                {matches.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevMatch}
                      className="p-1 hover:bg-[var(--color-neutral-100)] rounded"
                      title="Previous match (Shift+Enter)"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={goToNextMatch}
                      className="p-1 hover:bg-[var(--color-neutral-100)] rounded"
                      title="Next match (Enter)"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setSearchQuery('');
                    onSearchChange?.('');
                  }}
                  className="p-1 hover:bg-[var(--color-neutral-100)] rounded"
                  title="Clear search"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div
        ref={contentRef}
        className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded p-3 text-sm font-mono whitespace-pre-wrap overflow-y-auto"
        style={{ maxHeight }}
      >
        {highlightedContent}
      </div>
    </div>
  );
}

export default SearchableContent;
