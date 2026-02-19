'use client';

import { useState, useEffect } from 'react';

export interface SectionConfig {
  id: string;
  label: string;
  count?: number;
}

/**
 * Tracks which section is currently visible using IntersectionObserver.
 * Returns the id of the topmost intersecting section.
 *
 * When `root` is provided (e.g., a scrollable sidebar container), intersection
 * is calculated relative to that element instead of the viewport.
 */
export function useActiveSection(
  sectionIds: string[],
  options?: {
    rootMargin?: string;
    threshold?: number;
    root?: Element | null;
  }
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const visibleIds = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id);
          } else {
            visibleIds.delete(entry.target.id);
          }
        });

        // Pick the topmost visible section (earliest in sectionIds order)
        const topmost = sectionIds.find((id) => visibleIds.has(id));
        if (topmost) {
          setActiveId(topmost);
        }
      },
      {
        root: options?.root ?? null,
        rootMargin: options?.rootMargin ?? '-100px 0px -50% 0px',
        threshold: options?.threshold ?? 0,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sectionIds, options?.rootMargin, options?.threshold, options?.root]);

  return activeId;
}
