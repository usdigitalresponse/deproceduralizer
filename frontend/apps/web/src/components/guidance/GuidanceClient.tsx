'use client';

import type { JurisdictionCode } from '@deproceduralizer/database';
import { GuidanceBrowseTab } from './GuidanceBrowseTab';

export interface GuidanceClientProps {
  jurisdiction: JurisdictionCode;
  agencies: string[];
  docTypes: string[];
}

export function GuidanceClient({
  jurisdiction,
  agencies,
  docTypes,
}: GuidanceClientProps) {
  return (
    <GuidanceBrowseTab
      jurisdiction={jurisdiction}
      agencies={agencies}
      docTypes={docTypes}
    />
  );
}
