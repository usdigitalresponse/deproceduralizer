'use client';

import { SidebarSectionIndex } from '@/components/navigation/SidebarSectionIndex';
import type { SectionConfig } from '@/hooks/useActiveSection';

interface StatuteSidebarWithNavProps {
  sections: SectionConfig[];
  children: React.ReactNode;
}

export function StatuteSidebarWithNav({ sections, children }: StatuteSidebarWithNavProps) {
  return (
    <SidebarSectionIndex sections={sections}>
      {children}
    </SidebarSectionIndex>
  );
}
