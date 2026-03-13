'use client';

import { useRef, useState, useEffect, useCallback, useMemo, type KeyboardEvent } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, renders a search input at the top of the dropdown for client-side filtering */
  searchable?: boolean;
  'aria-label'?: string;
  'data-testid'?: string;
}

/**
 * Multi-select dropdown component using a custom popover.
 * Displays selected items as chips (max 2 visible, then "+N more").
 * Empty selection acts as "All" (shows placeholder).
 *
 * Keyboard: Space/Enter to toggle, Escape to close, Arrow keys to navigate.
 * Accessibility: role="listbox", aria-multiselectable="true", focus management.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'All',
  disabled = false,
  className = '',
  searchable = false,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
        setSearchTerm('');
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Focus search input or list when dropdown opens; clear search when closing
  useEffect(() => {
    if (isOpen) {
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
      setFocusedIndex(searchable ? -1 : 0);
    } else {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  // Client-side filtered options when searchable
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(term));
  }, [searchable, searchTerm, options]);

  const toggleOption = useCallback((optionValue: string) => {
    const isSelected = value.includes(optionValue);
    if (isSelected) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }, [value, onChange]);

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredOptions.length > 0) {
        setFocusedIndex(0);
        listRef.current?.focus();
      }
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (searchable && focusedIndex <= 0) {
          setFocusedIndex(-1);
          searchInputRef.current?.focus();
        } else {
          setFocusedIndex(prev => Math.max(prev - 1, 0));
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          toggleOption(filteredOptions[focusedIndex].value);
        }
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(filteredOptions.length - 1);
        break;
    }
  };

  // Reset focused index when search term changes
  useEffect(() => {
    if (searchable && searchTerm) {
      setFocusedIndex(-1);
    }
  }, [searchable, searchTerm]);

  // Scroll focused option into view
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const listEl = listRef.current;
    if (!listEl) return;
    const focusedEl = listEl.children[focusedIndex] as HTMLElement | undefined;
    focusedEl?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, isOpen]);

  // Compute visible chips
  const MAX_VISIBLE_CHIPS = 2;
  const selectedLabels = value
    .map(v => options.find(o => o.value === v)?.label)
    .filter(Boolean) as string[];
  const visibleChips = selectedLabels.slice(0, MAX_VISIBLE_CHIPS);
  const moreCount = selectedLabels.length - MAX_VISIBLE_CHIPS;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel || label}
        data-testid={dataTestId}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className={`
          inline-flex items-center justify-between
          w-full
          min-h-[38px]
          px-3 py-1.5
          text-sm text-[var(--color-text)]
          bg-[var(--color-surface)]
          border border-[var(--color-neutral-300)]
          rounded-[var(--radius-md)]
          transition-colors duration-[var(--duration-fast)]
          hover:border-[var(--color-neutral-400)]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        `.trim().replace(/\s+/g, ' ')}
      >
        <span className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
          {value.length === 0 ? (
            <span className="text-[var(--color-text-muted)]">{placeholder}</span>
          ) : (
            <>
              {visibleChips.map((chipLabel, i) => (
                <span
                  key={value[i]}
                  className="
                    inline-flex items-center
                    px-1.5 py-0.5
                    text-xs
                    bg-[var(--color-primary-faint)]
                    text-[var(--color-primary)]
                    rounded-[var(--radius-sm)]
                    max-w-[160px] truncate
                  "
                  title={chipLabel}
                >
                  {chipLabel}
                </span>
              ))}
              {moreCount > 0 && (
                <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  +{moreCount} more
                </span>
              )}
            </>
          )}
        </span>
        <span className="ml-2 text-[var(--color-text-muted)] flex-shrink-0">
          <ChevronDown className="w-3 h-3" />
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="
            absolute z-50 mt-1
            w-full min-w-[320px]
            bg-[var(--color-surface)]
            rounded-[var(--radius-md)]
            border border-[var(--color-neutral-200)]
            shadow-lg
            overflow-hidden
          "
        >
          {/* Clear all link */}
          {value.length > 0 && (
            <div className="px-3 py-1.5 border-b border-[var(--color-neutral-200)]">
              <button
                type="button"
                onClick={clearAll}
                className="
                  text-xs text-[var(--color-primary)]
                  hover:text-[var(--color-primary-hover,var(--color-primary))]
                  hover:underline
                  cursor-pointer
                "
              >
                Clear all
              </button>
            </div>
          )}

          {/* Search input */}
          {searchable && (
            <div className="px-2 py-1.5 border-b border-[var(--color-neutral-200)]">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search..."
                aria-label={`Search ${label}`}
                className="
                  w-full px-2 py-1 text-sm
                  bg-[var(--color-surface)]
                  border border-[var(--color-neutral-300)]
                  rounded-[var(--radius-sm)]
                  outline-none
                  focus:ring-1 focus:ring-[var(--color-focus)]
                  placeholder:text-[var(--color-text-muted)]
                "
              />
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            className="p-1 max-h-[300px] overflow-y-auto outline-none"
          >
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-[var(--color-text-muted)] select-none">
                No matching options
              </li>
            )}
            {filteredOptions.map((option, index) => {
              const isSelected = value.includes(option.value);
              const isFocused = focusedIndex === index;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  data-focused={isFocused || undefined}
                  onClick={() => toggleOption(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`
                    flex items-center gap-2
                    px-3 py-2
                    text-sm text-[var(--color-text)]
                    rounded-[var(--radius-sm)]
                    cursor-pointer
                    select-none
                    ${isFocused ? 'bg-[var(--color-primary-faint)] text-[var(--color-primary)]' : ''}
                  `.trim().replace(/\s+/g, ' ')}
                >
                  {/* Checkbox indicator */}
                  <span
                    className={`
                      flex items-center justify-center
                      w-4 h-4
                      rounded-[3px]
                      border
                      flex-shrink-0
                      transition-colors
                      ${isSelected
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                        : 'border-[var(--color-neutral-400)] bg-[var(--color-surface)]'
                      }
                    `.trim().replace(/\s+/g, ' ')}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="truncate flex-1 min-w-0" title={option.label}>{option.label}</span>
                  {option.count !== undefined && (
                    <span className="flex-shrink-0 text-xs text-[var(--color-text-muted)] tabular-nums ml-1">
                      {option.count.toLocaleString()}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MultiSelect;
