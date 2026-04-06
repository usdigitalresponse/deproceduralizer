'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Tag, X, Check, Loader2, Plus, BookmarkX, Bookmark } from 'lucide-react';
import type { MarkerGroup } from '@deproceduralizer/database';

export interface BulkActionBarProps {
  selectedCount: number;
  onMarkAll: () => void;
  onAssignMarker: (markerGroupId: number) => void;
  onCreateAndAssign?: (name: string) => void;
  onUnmarkAll?: () => void;
  onClear: () => void;
  availableGroups: MarkerGroup[];
  isProcessing?: boolean;
  /** Where the bar is positioned — controls label picker direction */
  position?: 'top' | 'bottom';
}

/**
 * Sticky bottom bar that appears when 1+ table rows are selected.
 * Provides bulk save ("Save All"), bulk unsave, and bulk label assignment actions.
 */
export function BulkActionBar({
  selectedCount,
  onMarkAll,
  onAssignMarker,
  onCreateAndAssign,
  onUnmarkAll,
  onClear,
  availableGroups,
  isProcessing = false,
  position = 'bottom',
}: BulkActionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on click outside
  useEffect(() => {
    if (!pickerOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  // Close picker on Escape
  useEffect(() => {
    if (!pickerOpen) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setPickerOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [pickerOpen]);

  const handleAssign = useCallback((groupId: number) => {
    onAssignMarker(groupId);
    setPickerOpen(false);
  }, [onAssignMarker]);

  const handleCreateAndAssign = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed || !onCreateAndAssign) return;
    onCreateAndAssign(trimmed);
    setCustomInput('');
    setPickerOpen(false);
  }, [customInput, onCreateAndAssign]);

  if (selectedCount === 0) return null;

  return (
    <div>
      {/* Action bar */}
      <div
        className="
          flex items-center gap-3
          bg-[var(--color-neutral-800)] text-[var(--color-text-inverse)]
          px-4 py-2.5
          border-t border-[var(--color-neutral-600)]
        "
        role="toolbar"
        aria-label="Bulk actions"
      >
        {/* Selected count */}
        <div className="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap">
          <Check className="w-4 h-4" />
          <span>{selectedCount} selected</span>
        </div>

        <div className="h-5 w-px bg-[var(--color-neutral-600)]" />

        {/* Mark All button */}
        <button
          type="button"
          onClick={onMarkAll}
          disabled={isProcessing}
          className="
            inline-flex items-center gap-1.5
            px-3 py-1.5 rounded-[var(--radius-sm)]
            text-xs font-medium
            bg-[var(--color-primary)] text-[var(--color-text-inverse)]
            hover:brightness-110
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer
            transition-all duration-[var(--duration-fast)]
          "
          aria-label="Save all selected items"
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
          Save All
        </button>

        {/* Unmark All button */}
        {onUnmarkAll && (
          <button
            type="button"
            onClick={onUnmarkAll}
            disabled={isProcessing}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5 rounded-[var(--radius-sm)]
              text-xs font-medium
              bg-[var(--color-danger)] text-[var(--color-text-inverse)]
              hover:bg-[var(--color-danger-strong)]
              disabled:opacity-50 disabled:cursor-not-allowed
              cursor-pointer
              transition-colors duration-[var(--duration-fast)]
            "
            aria-label="Unsave all selected items"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BookmarkX className="w-3.5 h-3.5" />
            )}
            Unsave All
          </button>
        )}

        {/* Assign Category dropdown */}
        <div ref={pickerRef} className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen(prev => !prev)}
            disabled={isProcessing}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5 rounded-[var(--radius-sm)]
              text-xs font-medium
              bg-[var(--color-neutral-600)] text-[var(--color-text-inverse)]
              hover:bg-[var(--color-neutral-500)]
              disabled:opacity-50 disabled:cursor-not-allowed
              cursor-pointer
              transition-colors duration-[var(--duration-fast)]
            "
            aria-label="Add label to selected items"
            aria-expanded={pickerOpen}
          >
            <Tag className="w-3.5 h-3.5" />
            Add Label
          </button>

          {pickerOpen && (
            <div
              className="
                absolute left-0 ${position === 'top' ? 'top-full mt-1' : 'bottom-full mb-1'}
                w-56 rounded-[var(--radius-md)]
                bg-[var(--color-surface)] border border-[var(--color-neutral-200)]
                shadow-lg py-1
                max-h-64 overflow-y-auto
              "
              role="listbox"
              aria-label="Labels"
            >
              {availableGroups.length > 0 ? (
                availableGroups.map(group => (
                  <button
                    key={group.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleAssign(group.id)}
                    className="
                      w-full flex items-center gap-2 px-3 py-1.5
                      text-sm text-left
                      text-[var(--color-text)]
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
                    <span className="flex-1 truncate">{group.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  No labels yet
                </div>
              )}

              {/* Inline create new category */}
              {onCreateAndAssign && (
                <>
                  <div className="border-t border-[var(--color-neutral-200)] my-1" />
                  <div className="px-2 py-1">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCreateAndAssign();
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
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
                        aria-label="Create label and assign"
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

        {/* Clear button */}
        <button
          type="button"
          onClick={onClear}
          disabled={isProcessing}
          className="
            inline-flex items-center gap-1
            px-2.5 py-1.5 rounded-[var(--radius-sm)]
            text-xs font-medium
            text-[var(--color-neutral-300)]
            hover:text-[var(--color-text-inverse)] hover:bg-[var(--color-neutral-600)]
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer
            transition-colors duration-[var(--duration-fast)]
          "
          aria-label="Clear selection"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}
