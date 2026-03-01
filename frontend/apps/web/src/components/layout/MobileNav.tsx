'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerClose,
} from '@/components/ui';
import { getJurisdictionFromPathname } from '@/hooks';
import { NAV_ITEMS, getNavHref, isNavActive, NAV_GROUPS } from '@/lib/constants/navigation';
import { VALID_JURISDICTIONS, JURISDICTION_CONFIG } from '@/types/state';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mobile navigation drawer component.
 * Provides touch-friendly navigation with large tap targets.
 */
export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentJurisdiction = getJurisdictionFromPathname(pathname);

  const handleStateChange = (newState: string) => {
    const pathWithoutState = pathname.replace(/^\/(nyc|ny|nj)/, '');
    const queryString = searchParams.toString();
    const newPath = `/${newState}${pathWithoutState || ''}${queryString ? `?${queryString}` : ''}`;
    router.push(newPath);
    onClose();
  };

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
              {VALID_JURISDICTIONS.map((s) => (
                <StateButton
                  key={s}
                  label={JURISDICTION_CONFIG[s].name}
                  isActive={currentJurisdiction === s}
                  onClick={() => handleStateChange(s)}
                />
              ))}
            </div>
          </div>

          {/* Navigation Groups */}
          <nav className="py-2">
            {(['explorer', 'review', 'metrics'] as const).map((groupId) => {
              const groupItems = NAV_ITEMS.filter(item => item.groupId === groupId);
              if (groupItems.length === 0) return null;

              const group = NAV_GROUPS[groupId];
              const GroupIcon = group.icon;

              return (
                <div key={groupId} className="mb-4">
                  <div className="px-4 py-2 flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    <GroupIcon className="w-3.5 h-3.5" />
                    {group.label}
                  </div>
                  {groupItems.map((item) => {
                    const href = getNavHref(item, currentJurisdiction);
                    const isActive = isNavActive(item, pathname, currentJurisdiction);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.key}
                        href={href}
                        onClick={onClose}
                        className={`
                          flex items-center gap-3
                          px-6 py-3
                          min-h-[48px]
                          text-base font-medium
                          transition-colors duration-[var(--duration-fast)]
                          ${isActive
                            ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)] border-l-4 border-[var(--color-primary)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)]'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5 opacity-70" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}

            {/* Highlighted Items (Pipeline) */}
            {NAV_ITEMS.filter(item => item.isHighlighted).length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-2 flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Featured
                </div>
                {NAV_ITEMS.filter(item => item.isHighlighted).map((item) => {
                  const href = getNavHref(item, currentJurisdiction);
                  const isActive = isNavActive(item, pathname, currentJurisdiction);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.key}
                      href={href}
                      onClick={onClose}
                      className={`
                        flex items-center gap-3
                        px-6 py-3
                        min-h-[48px]
                        text-base font-medium
                        transition-colors duration-[var(--duration-fast)]
                        ${isActive
                          ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)] border-l-4 border-[var(--color-primary)]'
                          : 'text-[var(--color-primary)] hover:bg-[var(--color-primary-weaker)]'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 opacity-70" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Global Items (Prompts, etc.) */}
            <div className="mt-2 border-t border-[var(--color-neutral-100)] pt-2">
              {NAV_ITEMS.filter(item => !item.groupId && !item.isHighlighted && item.key !== 'home').map((item) => {
                const href = getNavHref(item, currentJurisdiction);
                const isActive = isNavActive(item, pathname, currentJurisdiction);
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
                        ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)] border-l-4 border-[var(--color-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)]'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 opacity-70" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
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
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function StateButton({ label, isActive, onClick }: StateButtonProps) {
  return (
    <button
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
    </button>
  );
}

export default MobileNav;
