'use client';

import { StickyPageSectionTabs } from '@/components/navigation/StickyPageSectionTabs';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface GuidancePipelineSectionTabsProps {
  sections: SectionConfig[];
}

export function GuidancePipelineSectionTabs({ sections }: GuidancePipelineSectionTabsProps) {
  return <StickyPageSectionTabs sections={sections} scrollOffset={120} />;
}
