'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Tag, GitBranch } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import type { AnalyticsTabValue } from '@/lib/constants/values';

interface AnalyticsTabsProps {
  activeTab: AnalyticsTabValue;
  onTabChange: (tab: AnalyticsTabValue) => void;
}

const TABS: SegmentedControlOption<AnalyticsTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'crossrefs', label: 'Cross-References', icon: getEntityIcon('cross_reference') },
  { value: 'issues', label: 'Issues', icon: getEntityIcon('compliance_issue') },
  { value: 'keywords', label: 'Keywords', icon: Tag },
  { value: 'definitions', label: 'Definitions', icon: getEntityIcon('definition') },
  { value: 'statutes', label: 'Statutes', icon: getEntityIcon('statute') },
  { value: 'guidance', label: 'Guidance', icon: getEntityIcon('guidance_document') },
  { value: 'pipeline', label: 'Pipeline', icon: GitBranch },
];

/**
 * Detects whether a scrollable container has overflow on left/right edges.
 */
function useScrollOverflow(ref: React.RefObject<HTMLDivElement | null>) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [ref, update]);

  return { canScrollLeft, canScrollRight };
}

function getMaskImage(canScrollLeft: boolean, canScrollRight: boolean): string | undefined {
  if (canScrollLeft && canScrollRight) {
    return 'linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)';
  }
  if (canScrollLeft) {
    return 'linear-gradient(to right, transparent, black 2rem)';
  }
  if (canScrollRight) {
    return 'linear-gradient(to right, black calc(100% - 2rem), transparent)';
  }
  return undefined;
}

export function AnalyticsTabs({ activeTab, onTabChange }: AnalyticsTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { canScrollLeft, canScrollRight } = useScrollOverflow(scrollRef);
  const maskImage = getMaskImage(canScrollLeft, canScrollRight);

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto scrollbar-hide"
      style={maskImage ? { WebkitMaskImage: maskImage, maskImage } : undefined}
    >
      <SegmentedControl
        options={TABS}
        value={activeTab}
        onChange={onTabChange}
        variant="filled"
      />
    </div>
  );
}
