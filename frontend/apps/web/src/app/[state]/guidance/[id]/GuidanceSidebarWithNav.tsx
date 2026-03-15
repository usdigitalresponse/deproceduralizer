'use client';

import { SidebarSectionIndex } from '@/components/navigation/SidebarSectionIndex';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface GuidanceSidebarWithNavProps {
  sections: SectionConfig[];
  children: React.ReactNode;
}

export function GuidanceSidebarWithNav({ sections, children }: GuidanceSidebarWithNavProps) {
  return (
    <SidebarSectionIndex sections={sections}>
      {children}
    </SidebarSectionIndex>
  );
}
