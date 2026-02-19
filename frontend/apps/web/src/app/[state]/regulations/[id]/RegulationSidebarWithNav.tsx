'use client';

import { SidebarSectionIndex } from '@/components/navigation/SidebarSectionIndex';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface RegulationSidebarWithNavProps {
  sections: SectionConfig[];
  children: React.ReactNode;
}

export function RegulationSidebarWithNav({ sections, children }: RegulationSidebarWithNavProps) {
  return (
    <SidebarSectionIndex sections={sections}>
      {children}
    </SidebarSectionIndex>
  );
}
