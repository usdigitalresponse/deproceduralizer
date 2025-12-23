'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchDocumentsForScope, getAncestorDocumentsForScope, getDocumentForScope } from '@/lib/actions/definitions';
import { Input } from '@/components/ui';
import type { StateCode } from '@deproceduralizer/database';

interface ScopeDocument {
  id: number;
  title: string | null;
  hierarchyLevel: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
}

interface ScopeDocumentTypeaheadProps {
  state: StateCode;
  value: number | null | undefined;
  onChange: (docId: number | null) => void;
  sourceDocumentId: number | null | undefined;
  placeholder?: string;
}

export function ScopeDocumentTypeahead({
  state,
  value,
  onChange,
  sourceDocumentId,
  placeholder = 'Search for a document...',
}: ScopeDocumentTypeaheadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ScopeDocument[]>([]);
  const [ancestors, setAncestors] = useState<ScopeDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ScopeDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load ancestors when source document changes
  useEffect(() => {
    if (sourceDocumentId) {
      getAncestorDocumentsForScope(sourceDocumentId).then((result) => {
        if (result.success) {
          setAncestors(result.data);
          // If we have a value, find it in ancestors
          if (value) {
            const found = result.data.find((d) => d.id === value);
            if (found) {
              setSelectedDocument(found);
            }
          }
        }
      });
    }
  }, [sourceDocumentId, value]);

  // Fetch the selected document if we have a value but it wasn't found in ancestors
  useEffect(() => {
    if (value && !selectedDocument) {
      getDocumentForScope(value).then((result) => {
        if (result.success && result.data) {
          setSelectedDocument(result.data);
        }
      });
    }
  }, [value, selectedDocument]);

  // Search for documents when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await searchDocumentsForScope(searchQuery, state, 10);
        if (result.success) {
          setSuggestions(result.data);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, state]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((doc: ScopeDocument) => {
    setSelectedDocument(doc);
    onChange(doc.id);
    setSearchQuery('');
    setIsOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setSelectedDocument(null);
    onChange(null);
    setSearchQuery('');
  }, [onChange]);

  const formatDocumentDisplay = (doc: ScopeDocument) => {
    const level = doc.hierarchyLevel ? `[${doc.hierarchyLevel}]` : '';
    const citation = state === 'ny'
      ? [doc.nycrrTitle && `Title ${doc.nycrrTitle}`, doc.nycrrPart && `Part ${doc.nycrrPart}`].filter(Boolean).join(' ')
      : [doc.njacTitle && `${doc.njacTitle}`, doc.njacChapter && `:${doc.njacChapter}`].filter(Boolean).join('');

    return (
      <div className="flex flex-col">
        <span className="text-sm font-medium truncate">{doc.title || 'Untitled'}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {level} {citation && `- ${citation}`} (ID: {doc.id})
        </span>
      </div>
    );
  };

  // Show either search results or ancestors (when no search query)
  const displayItems = searchQuery.trim() ? suggestions : ancestors;

  return (
    <div className="relative">
      {/* Selected document display */}
      {selectedDocument ? (
        <div className="flex items-center gap-2 p-2 bg-[var(--color-neutral-50)] rounded border border-[var(--color-neutral-200)]">
          <div className="flex-1 min-w-0">
            {formatDocumentDisplay(selectedDocument)}
          </div>
          <button
            onClick={handleClear}
            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            title="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={() => {
              setSelectedDocument(null);
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="p-1 text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
            title="Change selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
          />

          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </>
      )}

      {/* Dropdown */}
      {isOpen && !selectedDocument && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-[var(--color-neutral-200)] rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {!searchQuery.trim() && ancestors.length > 0 && (
            <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
              Ancestor Documents
            </div>
          )}

          {searchQuery.trim() && suggestions.length === 0 && !isLoading && (
            <div className="px-3 py-4 text-sm text-[var(--color-text-secondary)] text-center">
              No documents found
            </div>
          )}

          {displayItems.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleSelect(doc)}
              className="w-full px-3 py-2 text-left hover:bg-[var(--color-primary-faint)] focus:bg-[var(--color-primary-faint)] focus:outline-none border-b border-[var(--color-neutral-100)] last:border-0"
            >
              {formatDocumentDisplay(doc)}
            </button>
          ))}

          {/* Manual ID input option */}
          <div className="px-3 py-2 border-t border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">Or enter ID:</span>
              <input
                type="number"
                placeholder="Document ID"
                className="flex-1 text-sm px-2 py-1 border border-[var(--color-neutral-200)] rounded"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const id = parseInt((e.target as HTMLInputElement).value);
                    if (!isNaN(id) && id > 0) {
                      onChange(id);
                      setIsOpen(false);
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScopeDocumentTypeahead;
