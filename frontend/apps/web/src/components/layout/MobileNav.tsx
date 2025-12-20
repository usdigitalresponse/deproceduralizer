'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerClose,
} from '@/components/ui';
import { Table, FolderTree, ClipboardCheck, BookOpen, Home } from 'lucide-react';
import { getStateFromPathname } from '@/hooks';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { key: 'home', href: '/', label: 'Dashboard', icon: Home, matchPath: '/' },
  { key: 'table', href: (state: string) => `/${state}`, label: 'Table View', icon: Table, matchPath: (state: string) => `/${state}` },
  { key: 'browse', href: (state: string) => `/${state}/browse`, label: 'Browse', icon: FolderTree, matchPath: (state: string) => `/${state}/browse` },
  { key: 'review', href: (state: string) => `/${state}/review?status=unreviewed`, label: 'Review Mode', icon: ClipboardCheck, matchPath: (state: string) => `/${state}/review` },
  { key: 'glossary', href: (state: string) => `/${state}/definitions`, label: 'Glossary', icon: BookOpen, matchPath: (state: string) => `/${state}/definitions` },
];

/**
 * Mobile navigation drawer component.
 * Provides touch-friendly navigation with large tap targets.
 */
export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const currentState = getStateFromPathname(pathname);

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent side="right" size="md" className="flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Menu</DrawerTitle>
          <DrawerClose />
        </DrawerHeader>

        <DrawerBody className="p-0">
          {/* State Selector */}
          <div className="px-4 py-4 border-b border-[var(--color-neutral-200)]">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Select State
            </p>
            <div className="flex gap-2">
              <StateButton
                state="ny"
                label="New York"
                isActive={currentState === 'ny'}
                onClick={onClose}
              />
              <StateButton
                state="nj"
                label="New Jersey"
                isActive={currentState === 'nj'}
                onClick={onClose}
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="py-2">
            {navItems.map((item) => {
              const href = typeof item.href === 'function' ? item.href(currentState) : item.href;
              const matchPath = typeof item.matchPath === 'function' ? item.matchPath(currentState) : item.matchPath;

              // Check if current path matches this nav link
              const isActive = item.key === 'home'
                ? pathname === '/'
                : item.key === 'table'
                  ? pathname === `/${currentState}` || pathname === `/${currentState}/`
                  : pathname.startsWith(matchPath);

              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3
                    px-4 py-3
                    min-h-[48px]
                    text-base font-medium
                    transition-colors duration-[var(--duration-fast)]
                    ${isActive
                      ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)] border-l-3 border-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)]'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </DrawerBody>

        {/* Footer */}
        <div className="mt-auto px-4 py-4 border-t border-[var(--color-neutral-200)]">
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            Regulatory Analysis Tool
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface StateButtonProps {
  state: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function StateButton({ state, label, isActive, onClick }: StateButtonProps) {
  return (
    <Link
      href={`/${state}`}
      onClick={onClick}
      aria-label={`Switch to ${label}`}
      aria-current={isActive ? 'page' : undefined}
      className={`
        flex-1 px-4 py-3
        text-center text-sm font-medium
        rounded-[var(--radius-md)]
        transition-colors duration-[var(--duration-fast)]
        min-h-[44px]
        ${isActive
          ? 'bg-[var(--color-primary)] text-white'
          : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)]'
        }
      `}
    >
      {label}
    </Link>
  );
}

export default MobileNav;
