'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { getJurisdictionFromPathname } from '@/hooks';
import {
  getJurisdictionConfig,
  VALID_JURISDICTIONS,
  JURISDICTION_CONFIG,
  JURISDICTION_STORAGE_KEY,
  type JurisdictionCode,
} from '@/types/state';

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const currentJurisdiction = getJurisdictionFromPathname(pathname);
  const isHomepage = !pathname.match(/^\/(nyc|ny|nj)/);

  const [selectedJurisdiction, setSelectedJurisdiction] = useState<JurisdictionCode>(currentJurisdiction);
  const [isJurisdictionOpen, setIsJurisdictionOpen] = useState(false);

  // On mount, read saved jurisdiction from localStorage for homepage
  useEffect(() => {
    if (isHomepage && typeof window !== 'undefined') {
      const saved = localStorage.getItem(JURISDICTION_STORAGE_KEY) as JurisdictionCode | null;
      if (saved && VALID_JURISDICTIONS.includes(saved)) {
        setSelectedJurisdiction(saved);
      }
    }
  }, [isHomepage]);

  // When navigating to a jurisdiction page, sync from URL
  useEffect(() => {
    if (!isHomepage) {
      setSelectedJurisdiction(currentJurisdiction);
    }
  }, [isHomepage, currentJurisdiction]);

  const activeJurisdiction = isHomepage ? selectedJurisdiction : currentJurisdiction;
  const jurisdictionAbbrev = getJurisdictionConfig(activeJurisdiction).abbrev;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleJurisdictionSelect = useCallback((jurisdiction: JurisdictionCode) => {
    setSelectedJurisdiction(jurisdiction);
    localStorage.setItem(JURISDICTION_STORAGE_KEY, jurisdiction);
    setIsJurisdictionOpen(false);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    router.push(`/${activeJurisdiction}/search?q=${encodeURIComponent(trimmed)}`);
    setIsOpen(false);
    setQuery('');
  }, [query, activeJurisdiction, router]);

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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2
          px-3 py-1.5
          text-sm text-[var(--color-text-muted)]
          bg-[var(--color-neutral-100)]
          border border-[var(--color-neutral-200)]
          rounded-[var(--radius-md)]
          transition-colors duration-[var(--duration-fast)]
          hover:border-[var(--color-neutral-300)]
          hover:text-[var(--color-text-secondary)]
          ${isOpen ? 'xl:hidden border-[var(--color-neutral-300)] text-[var(--color-text-secondary)]' : ''}
        `}
        aria-label={`Search ${jurisdictionAbbrev} regulations (Cmd+K)`}
      >
        <Search className="w-4 h-4" aria-hidden="true" />
        <span className="hidden xl:inline">Search {jurisdictionAbbrev} regulations...</span>
        <kbd className="hidden xl:inline-flex items-center gap-0.5 ml-2 px-1.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>

      {isOpen && (
        <div className="
          absolute top-full right-0 mt-1 z-50 p-2
          bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] shadow-lg
          xl:static xl:mt-0 xl:p-0 xl:z-auto
          xl:flex xl:items-center xl:gap-2
          xl:bg-transparent xl:border-0 xl:shadow-none xl:rounded-none
        ">
          <div className="hidden xl:flex items-center gap-2 shrink-0">
            <Search className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
          </div>
          {isHomepage && (
            <div className="relative shrink-0">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsJurisdictionOpen(!isJurisdictionOpen);
                }}
                className="
                  flex items-center gap-1 px-2 py-1.5
                  text-sm font-medium
                  text-[var(--color-text-secondary)]
                  hover:text-[var(--color-text)]
                  bg-[var(--color-neutral-50)]
                  border border-[var(--color-neutral-200)]
                  rounded-[var(--radius-md)]
                  transition-colors duration-[var(--duration-fast)]
                  hover:border-[var(--color-neutral-300)]
                "
                aria-expanded={isJurisdictionOpen}
                aria-haspopup="listbox"
                aria-label="Select jurisdiction to search"
              >
                <span className="text-sm">{getJurisdictionConfig(activeJurisdiction).icon}</span>
                <span>{jurisdictionAbbrev}</span>
                <svg
                  className={`w-3 h-3 transition-transform duration-[var(--duration-fast)] ${
                    isJurisdictionOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isJurisdictionOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[var(--z-dropdown)]"
                    onClick={() => setIsJurisdictionOpen(false)}
                  />
                  <div
                    className="
                      absolute left-0 top-full mt-1 z-[calc(var(--z-dropdown)+1)]
                      min-w-[180px] py-1
                      bg-[var(--color-surface)]
                      border border-[var(--color-neutral-200)]
                      rounded-[var(--radius-lg)]
                      shadow-[var(--shadow-lg)]
                    "
                    role="listbox"
                    aria-label="Select jurisdiction"
                  >
                    {VALID_JURISDICTIONS.map((option) => {
                      const optionConfig = JURISDICTION_CONFIG[option];
                      const isSelected = option === activeJurisdiction;

                      return (
                        <button
                          key={option}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleJurisdictionSelect(option)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm
                            transition-colors duration-[var(--duration-fast)]
                            ${isSelected
                              ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]'
                              : 'text-[var(--color-text)] hover:bg-[var(--color-neutral-50)]'
                            }
                          `}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <span className="text-lg">{optionConfig.icon}</span>
                          <div>
                            <div className="font-medium">{optionConfig.name}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {optionConfig.regulationsLabel}
                            </div>
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
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
            placeholder={`Search ${jurisdictionAbbrev} regulations...`}
            aria-label={`Search ${jurisdictionAbbrev} regulations`}
            className="
              w-64 py-1.5 px-2
              text-sm text-[var(--color-text)]
              bg-[var(--color-surface)]
              border border-[var(--color-neutral-300)]
              rounded-[var(--radius-md)]
              placeholder:text-[var(--color-text-muted)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1
            "
          />
        </div>
      )}
    </div>
  );
}
