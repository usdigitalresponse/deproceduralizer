'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { getStateFromPathname } from '@/hooks';
import { getStateConfig } from '@/types/state';

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const currentState = getStateFromPathname(pathname);
  const stateAbbrev = getStateConfig(currentState).abbrev;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    router.push(`/${currentState}/search?q=${encodeURIComponent(trimmed)}`);
    setIsOpen(false);
    setQuery('');
  }, [query, currentState, router]);

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the input render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  if (isOpen) {
    return (
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') {
              setIsOpen(false);
              setQuery('');
            }
          }}
          onBlur={() => {
            if (!query.trim()) {
              setIsOpen(false);
            }
          }}
          placeholder={`Search ${stateAbbrev} regulations...`}
          aria-label={`Search ${stateAbbrev} regulations`}
          className="
            w-48 py-1.5 px-2
            text-sm text-[var(--color-text)]
            bg-[var(--color-surface)]
            border border-[var(--color-neutral-300)]
            rounded-[var(--radius-md)]
            placeholder:text-[var(--color-text-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1
          "
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="
        flex items-center gap-2
        px-3 py-1.5
        text-sm text-[var(--color-text-muted)]
        bg-[var(--color-neutral-100)]
        border border-[var(--color-neutral-200)]
        rounded-[var(--radius-md)]
        transition-colors duration-[var(--duration-fast)]
        hover:border-[var(--color-neutral-300)]
        hover:text-[var(--color-text-secondary)]
      "
      aria-label={`Search ${stateAbbrev} regulations (Cmd+K)`}
    >
      <Search className="w-4 h-4" aria-hidden="true" />
      <span className="hidden lg:inline">Search {stateAbbrev} regulations...</span>
      <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-2 px-1.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded">
        <span className="text-xs">&#8984;</span>K
      </kbd>
    </button>
  );
}
