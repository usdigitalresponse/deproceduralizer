'use client';

import type { TierTransitionData, Tier3EvidenceStats } from '@/lib/actions/pipeline-analytics';
import { TriggerReasons } from '../TriggerReasons';
import { Tier3EvidencePanel } from '../Tier3EvidencePanel';

interface VerificationSubtabProps {
  tierTransitions: TierTransitionData | null;
  tier3Evidence: Tier3EvidenceStats | null;
}

/**
 * Verification subtab: Trigger reasons + Tier 3 evidence findings.
 */
export function VerificationSubtab({ tierTransitions, tier3Evidence }: VerificationSubtabProps) {
  return (
    <div className="space-y-6">
      <TriggerReasons data={tierTransitions} />
      <Tier3EvidencePanel data={tier3Evidence} />
    </div>
  );
}
