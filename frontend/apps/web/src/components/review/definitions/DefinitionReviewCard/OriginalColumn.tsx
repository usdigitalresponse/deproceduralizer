import { RegulationTextViewer } from '../../shared';
import type { OriginalColumnProps } from './types';

export function OriginalColumn({ definition, state, formData, getOriginalValue }: OriginalColumnProps) {

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
        Original (LLM Extraction)
      </h4>

      <div className="space-y-3 text-sm">
        <div>
          <span className="text-[var(--color-text-secondary)]">Term:</span>
          <span className="ml-2 font-medium">{getOriginalValue('term') as string || definition.term}</span>
        </div>

        <div>
          <span className="text-[var(--color-text-secondary)]">Is Complete:</span>
          <span className="ml-2">{(getOriginalValue('isVerbatimTextComplete') ?? definition.isVerbatimTextComplete) ? 'Yes' : 'No'}</span>
        </div>

        <div>
          <span className="text-[var(--color-text-secondary)]">Verbatim Text:</span>
          <p className="mt-1 text-[var(--color-text)] bg-[var(--color-neutral-50)] p-2 rounded text-sm">
            {(getOriginalValue('verbatimText') as string) || definition.verbatimText}
          </p>
        </div>

        {(getOriginalValue('rephrasedDefinition') || definition.rephrasedDefinition) && (
          <div>
            <span className="text-[var(--color-text-secondary)]">Rephrased:</span>
            <p className="mt-1 text-[var(--color-text)] bg-[var(--color-neutral-50)] p-2 rounded text-sm">
              {(getOriginalValue('rephrasedDefinition') as string) || definition.rephrasedDefinition}
            </p>
          </div>
        )}

        <div>
          <span className="text-[var(--color-text-secondary)]">Scope:</span>
          <span className="ml-2">{(getOriginalValue('scope') as string) || definition.scope || '(none)'}</span>
        </div>

        <div>
          <span className="text-[var(--color-text-secondary)]">Scope Level:</span>
          <span className="ml-2">{(getOriginalValue('scopeLevel') as string) || definition.scopeLevel || '(none)'}</span>
        </div>

        <div>
          <span className="text-[var(--color-text-secondary)]">Scope Document:</span>
          <span className="ml-2">
            {definition.scopeDocumentId ? `ID: ${definition.scopeDocumentId}` : '(none)'}
          </span>
        </div>

        <div>
          <span className="text-[var(--color-text-secondary)]">Type:</span>
          <span className="ml-2">{(getOriginalValue('definitionType') as string) || definition.definitionType || 'formal'}</span>
        </div>

        <div>
          <span className="text-[var(--color-text-secondary)]">Cross-Reference:</span>
          <span className="ml-2">{(getOriginalValue('isCrossReference') ?? definition.isCrossReference) ? 'Yes' : 'No'}</span>
        </div>

        {(definition.isCrossReference || getOriginalValue('isCrossReference') as boolean) && (
          <>
            <div>
              <span className="text-[var(--color-text-secondary)]">Ref Completeness:</span>
              <span className="ml-2">{(getOriginalValue('referenceCompleteness') as string) || definition.referenceCompleteness || '(none)'}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">Ref Target:</span>
              <span className="ml-2">{(getOriginalValue('referenceTarget') as string) || definition.referenceTarget || '(none)'}</span>
            </div>
          </>
        )}
      </div>

      {/* Source Regulation Text */}
      {definition.regulation?.content && (
        <div className="mt-4 border-t border-[var(--color-neutral-200)] pt-4">
          <RegulationTextViewer
            content={definition.regulation.content}
            documentId={definition.regulation.id}
            state={state}
            scrollToText={definition.verbatimText}
            highlightPattern={definition.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
            isVerbatim={formData.isVerbatimTextComplete}
            label="Show Regulation Text"
            maxHeight="16rem"
            defaultExpanded
          />
        </div>
      )}
    </div>
  );
}
