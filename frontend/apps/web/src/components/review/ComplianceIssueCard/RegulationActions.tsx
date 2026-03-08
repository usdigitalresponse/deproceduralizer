import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui';
import { CornellLink, RegulationTextViewer, HierarchyTreeView } from '../shared';
import type { RegulationActionsProps } from './types';

export function RegulationActions({
  regulation,
  stateCode,
  verbatimSupportingText,
  regexMatchPattern,
  isVerbatim,
  guidance,
}: RegulationActionsProps) {
  // Guidance document actions
  if (guidance) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => window.open(`/${stateCode}/guidance/${guidance.id}`, '_blank')}>
            View Guidance Page <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          <CornellLink url={guidance.url} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* View Full Regulation Page + Cornell Link */}
      <div className="mb-4 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => window.open(`/${stateCode}/regulations/${regulation.id}`, '_blank')}
        >
          View Full Regulation Page
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
        <CornellLink url={regulation.url} />
      </div>

      {/* Full Regulation Text Viewer */}
      {regulation.content && (
        <RegulationTextViewer
          content={regulation.content}
          documentId={regulation.id}
          state={stateCode}
          scrollToText={verbatimSupportingText?.[0]}
          highlightPattern={regexMatchPattern}
          isVerbatim={isVerbatim ?? false}
          label="Show Regulation Text"
        />
      )}

      {/* Hierarchy Tree View */}
      <HierarchyTreeView
        documentId={regulation.id}
        state={stateCode}
      />
    </>
  );
}
