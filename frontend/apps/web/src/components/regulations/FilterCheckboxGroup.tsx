'use client';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterCheckboxGroupProps {
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxVisible?: number;
}

/**
 * Multi-select checkbox group for faceted filters.
 * Supports showing counts per option and collapsing to maxVisible items.
 */
export function FilterCheckboxGroup({
  options,
  selected,
  onChange,
  maxVisible,
}: FilterCheckboxGroupProps) {
  const visibleOptions = maxVisible ? options.slice(0, maxVisible) : options;
  const hiddenCount = maxVisible ? Math.max(0, options.length - maxVisible) : 0;

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-1">
      {visibleOptions.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-[var(--color-neutral-50)] transition-colors"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => handleToggle(option.value)}
            className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
          />
          <span className="flex-1 text-sm text-[var(--color-text-secondary)]">
            {option.label}
          </span>
          {option.count !== undefined && (
            <span className="text-xs text-[var(--color-text-muted)]">
              ({option.count})
            </span>
          )}
        </label>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] pl-6 mt-1"
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}

interface FilterRadioGroupProps {
  options: FilterOption[];
  selected: string | null;
  onChange: (value: string | null) => void;
  allowDeselect?: boolean;
}

/**
 * Single-select radio group for faceted filters.
 */
export function FilterRadioGroup({
  options,
  selected,
  onChange,
  allowDeselect = false,
}: FilterRadioGroupProps) {
  const handleChange = (value: string) => {
    if (allowDeselect && selected === value) {
      onChange(null);
    } else {
      onChange(value);
    }
  };

  return (
    <div className="space-y-1">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-[var(--color-neutral-50)] transition-colors"
        >
          <input
            type="radio"
            name={`filter-${options[0]?.value}`}
            checked={selected === option.value}
            onChange={() => handleChange(option.value)}
            className="w-4 h-4 border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
          />
          <span className="flex-1 text-sm text-[var(--color-text-secondary)]">
            {option.label}
          </span>
          {option.count !== undefined && (
            <span className="text-xs text-[var(--color-text-muted)]">
              ({option.count})
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
