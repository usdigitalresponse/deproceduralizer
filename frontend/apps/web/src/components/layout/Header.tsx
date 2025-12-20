'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Container } from './Container';
import { MobileNav } from './MobileNav';
import { getStateFromPathname } from '@/hooks';
import { Button } from '@/components/ui';

interface HeaderProps {
  className?: string;
}

/**
 * Generate state-aware nav links based on current state
 */
function getNavLinks(state: string) {
  return [
    { href: `/${state}`, label: 'Table View', matchPath: `/${state}` },
    { href: `/${state}/browse`, label: 'Browse', matchPath: `/${state}/browse` },
    { href: `/${state}/review?reviewStatus=unreviewed`, label: 'Review Mode', matchPath: `/${state}/review` },
    { href: `/${state}/definitions`, label: 'Glossary', matchPath: `/${state}/definitions` },
  ];
}

export function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();
  const currentState = getStateFromPathname(pathname);
  const navLinks = getNavLinks(currentState);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <>
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
              <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
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
              </Link>

              {/* Desktop Navigation - hidden on mobile */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => {
                  // Check if current path matches this nav link
                  const isActive = link.matchPath === `/${currentState}`
                    ? pathname === `/${currentState}` || pathname === `/${currentState}/`
                    : pathname.startsWith(link.matchPath);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`
                        px-3 py-2 text-sm font-medium rounded-[var(--radius-md)]
                        transition-colors duration-[var(--duration-fast)]
                        ${isActive
                          ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)]'
                        }
                      `}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile Menu Button - visible on mobile only */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileNavOpen(true)}
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </div>
          </Container>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </>
  );
}

export default Header;
