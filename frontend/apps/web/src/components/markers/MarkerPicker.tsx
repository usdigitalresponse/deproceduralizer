'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Plus, Tag } from 'lucide-react';
import type { MarkerGroup } from '@deproceduralizer/database';

interface MarkerPickerProps {
  bookmarkId: number;
  assignedMarkerIds: number[];
  availableGroups: MarkerGroup[];
  onToggle: (bookmarkId: number, markerGroupId: number, assigned: boolean) => void;
  onCreateCustom?: (name: string) => Promise<MarkerGroup | null> | void;
  className?: string;
}

export function MarkerPicker({
  bookmarkId,
  assignedMarkerIds,
  availableGroups,
  onToggle,
  onCreateCustom,
  className = '',
}: MarkerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = useCallback(
    (markerGroupId: number) => {
      const isAssigned = assignedMarkerIds.includes(markerGroupId);
      onToggle(bookmarkId, markerGroupId, !isAssigned);
    },
    [bookmarkId, assignedMarkerIds, onToggle]
  );

  const handleCreateCustom = useCallback(async () => {
    const trimmed = customInput.trim();
    if (!trimmed || !onCreateCustom) return;
    const result = await onCreateCustom(trimmed);
    if (result && result.id) {
      onToggle(bookmarkId, result.id, true);
    }
    setCustomInput('');
  }, [customInput, onCreateCustom, onToggle, bookmarkId]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="
          inline-flex items-center gap-1
          p-1 rounded-[var(--radius-sm)]
          text-[var(--color-text-muted)]
          hover:text-[var(--color-primary)]
          hover:bg-[var(--color-neutral-100)]
          transition-colors duration-[var(--duration-fast)]
          cursor-pointer
          focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1
          outline-none
        "
        aria-label="Add label"
        title="Add label"
      >
        <Tag className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          className="
            absolute left-0 top-full mt-1 z-[var(--z-dropdown)]
            w-56 rounded-[var(--radius-md)]
            bg-[var(--color-surface)] border border-[var(--color-neutral-200)]
            shadow-lg
            py-1
          "
          role="listbox"
          aria-label="Labels"
        >
          {availableGroups.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              No labels available
            </div>
          ) : (
            availableGroups.map((group) => {
              const isAssigned = assignedMarkerIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  role="option"
                  aria-selected={isAssigned}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(group.id);
                  }}
                  className="
                    w-full flex items-center gap-2 px-3 py-1.5
                    text-sm text-left
                    hover:bg-[var(--color-neutral-50)]
                    transition-colors duration-[var(--duration-fast)]
                    cursor-pointer
                  "
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-[var(--color-text)]">
                    {group.name}
                  </span>
                  {isAssigned && (
                    <Check className="w-4 h-4 text-[var(--color-success)] shrink-0" />
                  )}
                </button>
              );
            })
          )}

          {onCreateCustom && (
            <>
              <div className="border-t border-[var(--color-neutral-200)] my-1" />
              <div className="px-2 py-1">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateCustom();
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="New label..."
                    className="
                      flex-1 min-w-0
                      px-2 py-1
                      text-xs
                      bg-[var(--color-neutral-50)]
                      border border-[var(--color-neutral-200)]
                      rounded-[var(--radius-sm)]
                      text-[var(--color-text)]
                      placeholder:text-[var(--color-text-muted)]
                      outline-none
                      focus:border-[var(--color-primary)]
                      focus:ring-1 focus:ring-[var(--color-focus-ring)]
                    "
                  />
                  <button
                    type="submit"
                    disabled={!customInput.trim()}
                    className="
                      p-1 rounded-[var(--radius-sm)]
                      text-[var(--color-primary)]
                      hover:bg-[var(--color-primary-weaker)]
                      disabled:opacity-40 disabled:cursor-not-allowed
                      cursor-pointer
                      transition-colors duration-[var(--duration-fast)]
                    "
                    aria-label="Create label"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
