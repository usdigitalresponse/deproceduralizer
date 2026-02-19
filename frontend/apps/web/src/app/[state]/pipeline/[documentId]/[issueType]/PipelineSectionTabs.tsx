'use client';

import { StickyPageSectionTabs } from '@/components/navigation/StickyPageSectionTabs';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface PipelineSectionTabsProps {
  sections: SectionConfig[];
}

export function PipelineSectionTabs({ sections }: PipelineSectionTabsProps) {
  return <StickyPageSectionTabs sections={sections} scrollOffset={120} />;
}
