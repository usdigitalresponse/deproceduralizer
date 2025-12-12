'use client';

import { Container } from './Container';

interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  return (
    <header className={`sticky top-0 z-[var(--z-sticky)] ${className}`}>
      {/* Official bar */}
      <div className="bg-[var(--color-primary)] text-white">
        <Container size="2xl">
          <div className="flex items-center h-8 text-xs">
            <span className="font-medium">
              Regulatory analysis and review tool
            </span>
          </div>
        </Container>
      </div>

      {/* Main header - White background */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-neutral-200)]">
        <Container size="2xl">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="flex items-center justify-center w-8 h-8 bg-[var(--color-primary)] rounded-[var(--radius-sm)]">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--color-text)] leading-tight">
                  Deproceduralizer
                </h1>
              </div>
            </div>

            {/* Right side - Could add navigation items here in the future */}
            <div className="flex items-center gap-4">
              {/* Placeholder for future nav items */}
            </div>
          </div>
        </Container>
      </div>
    </header>
  );
}

export default Header;
