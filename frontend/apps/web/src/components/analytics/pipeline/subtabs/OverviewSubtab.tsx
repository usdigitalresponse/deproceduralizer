'use client';

import type { PipelineFunnelData, TierTransitionData, TransitionReasonData, ConfidenceByClassificationData } from '@/lib/actions/pipeline-analytics';
import { PipelineFunnel } from '../PipelineFunnel';
import { PipelineStepper } from '../PipelineStepper';
import { ClassificationHeatmap } from '../ClassificationHeatmap';
import { ConfidenceDistributions } from '../ConfidenceDistributions';

interface OverviewSubtabProps {
  funnel: PipelineFunnelData | null;
  tierTransitions: TierTransitionData | null;
  transitionReasons: TransitionReasonData | null;
  confidenceByClassification: ConfidenceByClassificationData | null;
}

/**
 * Pipeline overview subtab: Stepper + StatGrid + Funnel + Heatmap + Confidence by Classification.
 */
export function OverviewSubtab({ funnel, tierTransitions, transitionReasons, confidenceByClassification }: OverviewSubtabProps) {
  return (
    <div className="space-y-6">
      <PipelineStepper data={funnel} />
      <PipelineFunnel data={funnel} />
      <ClassificationHeatmap data={tierTransitions} transitionReasons={transitionReasons} />
      <ConfidenceDistributions data={confidenceByClassification} />
    </div>
  );
}
