'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Container } from './Container';
import { STATE_CONFIG, VALID_STATES, STATE_STORAGE_KEY, type StateCode } from '@/types/state';
import { useEffect, useState } from 'react';

interface StateContextBarProps {
  state: StateCode;
}

/**
 * Context bar showing the current state with option to switch.
 * Displays below the main header to provide clear state context.
 */
export function StateContextBar({ state }: StateContextBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const config = STATE_CONFIG[state];
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Save state preference to localStorage when state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STATE_STORAGE_KEY, state);
    }
  }, [state]);

  const handleStateChange = (newState: StateCode) => {
    if (newState === state) {
      setIsDropdownOpen(false);
      return;
    }

    // Replace the state prefix in the current path
    // e.g., /ny/browse -> /nj/browse
    const pathWithoutState = pathname.replace(/^\/(nyc|ny|nj)/, '');
    const queryString = searchParams.toString();
    const newPath = `/${newState}${pathWithoutState || ''}${queryString ? `?${queryString}` : ''}`;

    // Save to localStorage
    localStorage.setItem(STATE_STORAGE_KEY, newState);

    // Navigate to new state
    router.push(newPath);
    setIsDropdownOpen(false);
  };

  // Get the CSS variable name for the current state
  const bgVar = state === 'ny' ? 'var(--color-state-ny-bg)' : 'var(--color-state-nj-bg)';
  const borderVar = state === 'ny' ? 'var(--color-state-ny-border)' : 'var(--color-state-nj-border)';
  const accentVar = state === 'ny' ? 'var(--color-state-ny-accent)' : 'var(--color-state-nj-accent)';

  return (
    <div
      className="border-b print:hidden"
      data-print-hide
      style={{
        backgroundColor: bgVar,
        borderColor: borderVar,
      }}
    >
      <Container size="2xl">
        <div className="flex items-center justify-between h-10">
          {/* State indicator */}
          <div className="flex items-center gap-3">
            {/* State badge */}
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${accentVar}15`,
                color: accentVar,
              }}
            >
              <span className="text-base">{config.icon}</span>
              <span>{config.abbrev}</span>
            </div>
            {/* State name */}
            <span className="text-sm text-[var(--color-text-secondary)]">
              {config.regulationsLabel}
            </span>
          </div>

          {/* State switcher */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="
                flex items-center gap-2 px-3 py-1.5 text-sm
                text-[var(--color-text-secondary)]
                hover:text-[var(--color-text)]
                hover:bg-[var(--color-surface)]
                rounded-[var(--radius-md)]
                transition-colors duration-[var(--duration-fast)]
                border border-transparent
                hover:border-[var(--color-neutral-200)]
              "
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
            >
              <span>Switch State</span>
              <svg
                className={`w-4 h-4 transition-transform duration-[var(--duration-fast)] ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown */}
            {isDropdownOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-[var(--z-dropdown)]"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div
                  className="
                    absolute right-0 top-full mt-1 z-[calc(var(--z-dropdown)+1)]
                    min-w-[180px] py-1
                    bg-[var(--color-surface)]
                    border border-[var(--color-neutral-200)]
                    rounded-[var(--radius-lg)]
                    shadow-[var(--shadow-lg)]
                  "
                  role="listbox"
                  aria-label="Select state"
                >
                  {VALID_STATES.map((stateOption) => {
                    const optionConfig = STATE_CONFIG[stateOption];
                    const isSelected = stateOption === state;

                    return (
                      <button
                        key={stateOption}
                        onClick={() => handleStateChange(stateOption)}
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
                          <svg
                            className="w-4 h-4 ml-auto"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
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
        </div>
      </Container>
    </div>
  );
}

export default StateContextBar;
