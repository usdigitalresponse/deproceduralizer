import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui';
import { CornellLink, RegulationTextViewer, HierarchyTreeView } from '../shared';
import type { RegulationActionsProps } from './types';

export function RegulationActions({
  regulation,
  stateCode,
  explanation,
  matchedPhrases,
}: RegulationActionsProps) {
  const highlightPattern = matchedPhrases?.length
    ? matchedPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    : undefined;

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
          scrollToText={explanation}
          highlightPattern={highlightPattern}
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
