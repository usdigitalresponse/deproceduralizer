'use client';

import { useState, useEffect } from 'react';

export interface SectionConfig {
  id: string;
  label: string;
  count?: number;
}

/**
 * Tracks which section is currently visible.
 *
 * For viewport scrolling (no `root`): uses a scroll listener that picks the
 * last section whose top has scrolled past the offset. This is reliable with
 * sticky headers and tall sections.
 *
 * When `root` is provided (e.g., a scrollable sidebar container): uses
 * IntersectionObserver relative to that element.
 */
export function useActiveSection(
  sectionIds: string[],
  options?: {
    rootMargin?: string;
    threshold?: number;
    root?: Element | null;
    scrollOffset?: number;
    /** Scope element lookups to this container (avoids duplicate-ID issues
     *  when the same sidebar content is rendered for both mobile and desktop). */
    scope?: Element | null;
  }
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    // Scoped lookup: finds element by ID within scope (or falls back to document)
    // This is needed because RegulationDetailLayout renders sidebar content twice
    // (mobile <details> + desktop <div>), creating duplicate IDs in the DOM.
    const findElement = (id: string): Element | null => {
      if (options?.scope) {
        return options.scope.querySelector(`#${CSS.escape(id)}`);
      }
      return document.getElementById(id);
    };

    // For custom scroll containers, use IntersectionObserver
    if (options?.root) {
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

          const topmost = sectionIds.find((id) => visibleIds.has(id));
          if (topmost) {
            setActiveId(topmost);
          }
        },
        {
          root: options.root,
          rootMargin: options?.rootMargin ?? '-100px 0px -50% 0px',
          threshold: options?.threshold ?? 0,
        }
      );

      sectionIds.forEach((id) => {
        const el = findElement(id);
        if (el) observer.observe(el);
      });

      return () => observer.disconnect();
    }

    // For viewport scrolling, use scroll-based detection
    const offset = options?.scrollOffset ?? 150;

    const handleScroll = () => {
      let active: string | null = null;
      for (const id of sectionIds) {
        const el = findElement(id);
        if (el && el.getBoundingClientRect().top <= offset) {
          active = id;
        }
      }
      setActiveId(active ?? sectionIds[0] ?? null);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sectionIds, options?.rootMargin, options?.threshold, options?.root, options?.scrollOffset, options?.scope]);

  return activeId;
}
