'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { useActiveSection } from '@/hooks/useActiveSection';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface SidebarSectionIndexProps {
  sections: SectionConfig[];
  children: React.ReactNode;
}

/**
 * Compact pill-based jump nav pinned at the top of a sidebar.
 * Highlights the currently visible section and scrolls to sections on click.
 * Auto-hides when the sidebar content scrolls out of the viewport (e.g., at footer).
 */
export function SidebarSectionIndex({ sections, children }: SidebarSectionIndexProps) {
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);
  const [contentScope, setContentScope] = useState<Element | null>(null);
  const [isContentVisible, setIsContentVisible] = useState(true);

  // Find the sidebar scroll container (aside) and set content scope for scoped element lookups.
  // Scoping is needed because RegulationDetailLayout renders sidebar content twice
  // (mobile <details> + desktop <div>), creating duplicate IDs in the DOM.
  useEffect(() => {
    if (contentRef.current) {
      setScrollRoot(contentRef.current.closest('aside'));
      setContentScope(contentRef.current);
    }
  }, []);

  const activeId = useActiveSection(sectionIds, {
    // Offset: 48px for sticky pill nav height, detect in top 40% of sidebar
    rootMargin: '-48px 0px -60% 0px',
    root: scrollRoot,
    scope: contentScope,
  });

  // Hide nav when sidebar content scrolls out of viewport (e.g., at page footer)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsContentVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback((id: string) => {
    // Scope lookup to contentRef to find the visible element (avoids duplicate-ID
    // issues from RegulationDetailLayout rendering sidebar for mobile + desktop)
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`) ?? document.getElementById(id);
    if (!el) return;

    // Find the sidebar scroll container (aside with overflow-y-auto)
    const scrollContainer = el.closest('aside') ?? el.closest('[style*="overflow"]');
    if (scrollContainer) {
      // Offset by nav pill height (~44px) so the section heading isn't hidden behind sticky pills
      const containerRect = scrollContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top + scrollContainer.scrollTop - 48;
      scrollContainer.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  if (sections.length < 2) {
    return <>{children}</>;
  }

  return (
    <div ref={contentRef} className="space-y-4">
      <nav
        className={`
          sticky top-0 z-10 bg-[var(--color-background)]/95 backdrop-blur-sm pb-2 -mx-1 px-1 hidden lg:block
          transition-opacity duration-200
          ${isContentVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        aria-label="Sidebar section navigation"
        aria-hidden={!isContentVisible}
      >
        <div className="flex flex-wrap gap-1 py-2">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  transition-colors duration-[var(--duration-fast)] cursor-pointer
                  ${
                    isActive
                      ? 'bg-[var(--color-primary-weak)] text-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text)]'
                  }
                `}
              >
                {section.label}
                {section.count !== undefined && section.count > 0 && (
                  <Badge variant="default" className="text-[10px] px-1 py-0 min-w-0 leading-tight">
                    {section.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
