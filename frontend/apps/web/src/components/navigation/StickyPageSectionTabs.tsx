'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/Badge';
import { useActiveSection } from '@/hooks/useActiveSection';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface StickyPageSectionTabsProps {
  sections: SectionConfig[];
  scrollOffset?: number;
}

/**
 * Horizontal tab bar for navigating long single-column pages.
 * Uses IntersectionObserver to highlight the active section.
 */
export function StickyPageSectionTabs({ sections, scrollOffset = 120 }: StickyPageSectionTabsProps) {
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const activeId = useActiveSection(sectionIds);
  const tabsRef = useRef<HTMLDivElement>(null);

  const scrollToSection = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - scrollOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    },
    [scrollOffset]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % sections.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + sections.length) % sections.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = sections.length - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const tabs = tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabs?.[nextIndex]?.focus();
      }
    },
    [sections.length]
  );

  if (sections.length < 2) return null;

  return (
    <div
      ref={tabsRef}
      role="tablist"
      aria-label="Page section navigation"
      className="flex gap-1.5 py-2 overflow-x-auto scrollbar-hide"
    >
      {sections.map((section, index) => {
        const isActive = activeId === section.id;
        return (
          <button
            key={section.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => scrollToSection(section.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
              whitespace-nowrap transition-colors duration-[var(--duration-fast)] cursor-pointer
              ${
                isActive
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text)]'
              }
            `}
          >
            {section.label}
            {section.count !== undefined && section.count > 0 && (
              <Badge
                variant={isActive ? 'default' : 'default'}
                className={`text-[10px] px-1 py-0 min-w-0 leading-tight ${
                  isActive ? 'bg-white/20 text-white border-white/30' : ''
                }`}
              >
                {section.count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
