import { Input, Textarea, Select } from '@/components/ui';
import { ScopeDocumentTypeahead } from '../ScopeDocumentTypeahead';
import { SCOPE_LEVELS, DEFINITION_TYPES, REFERENCE_COMPLETENESS_OPTIONS, REFERENCE_TARGET_OPTIONS } from './constants';
import type { EditableColumnProps } from './types';

export function EditableColumn({ definition, jurisdiction, formData, setFormData, wasChanged }: EditableColumnProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
        Corrected (Editable)
      </h4>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-[var(--color-text-secondary)]">Term</label>
          <Input
            value={formData.term}
            onChange={(e) => setFormData(prev => ({ ...prev, term: e.target.value }))}
            className={wasChanged('term') ? 'border-[var(--color-warning)]' : ''}
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-[var(--color-text-secondary)]">Is Complete:</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={formData.isVerbatimTextComplete}
                onChange={() => setFormData(prev => ({ ...prev, isVerbatimTextComplete: true }))}
                className="text-[var(--color-primary)]"
                data-testid="definition-is-complete-yes"
              />
              Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!formData.isVerbatimTextComplete}
                onChange={() => setFormData(prev => ({ ...prev, isVerbatimTextComplete: false }))}
                className="text-[var(--color-primary)]"
                data-testid="definition-is-complete-no"
              />
              No
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)]">Verbatim Text</label>
          <Textarea
            value={formData.verbatimText}
            onChange={(e) => setFormData(prev => ({ ...prev, verbatimText: e.target.value }))}
            rows={3}
            className={wasChanged('verbatimText') ? 'border-[var(--color-warning)]' : ''}
          />
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)]">Rephrased Definition</label>
          <Textarea
            value={formData.rephrasedDefinition}
            onChange={(e) => setFormData(prev => ({ ...prev, rephrasedDefinition: e.target.value }))}
            rows={2}
            placeholder="Plain-language definition (optional)"
            className={wasChanged('rephrasedDefinition') ? 'border-[var(--color-warning)]' : ''}
          />
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)]">Scope</label>
          <Input
            value={formData.scope}
            onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value }))}
            placeholder='e.g., "in this Part"'
            className={wasChanged('scope') ? 'border-[var(--color-warning)]' : ''}
          />
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)]">Scope Level</label>
          <Select
            value={formData.scopeLevel}
            onValueChange={(value) => setFormData(prev => ({ ...prev, scopeLevel: value }))}
            options={SCOPE_LEVELS}
            className={wasChanged('scopeLevel') ? 'border-[var(--color-warning)]' : ''}
          />
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)] mb-1 block">Scope Document</label>
          <ScopeDocumentTypeahead
            jurisdiction={jurisdiction}
            value={formData.scopeDocumentId}
            onChange={(docId) => setFormData(prev => ({ ...prev, scopeDocumentId: docId }))}
            sourceDocumentId={definition.documentId}
          />
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)]">Definition Type</label>
          <Select
            value={formData.definitionType}
            onValueChange={(value) => setFormData(prev => ({ ...prev, definitionType: value }))}
            options={DEFINITION_TYPES}
            className={wasChanged('definitionType') ? 'border-[var(--color-warning)]' : ''}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isCrossReference}
            onChange={(e) => setFormData(prev => ({ ...prev, isCrossReference: e.target.checked }))}
            id={`cross-ref-${definition.id}`}
            className="text-[var(--color-primary)]"
          />
          <label htmlFor={`cross-ref-${definition.id}`} className="text-sm text-[var(--color-text-secondary)]">
            Is Cross-Reference
          </label>
        </div>

        {formData.isCrossReference && (
          <>
            <div>
              <label className="text-sm text-[var(--color-text-secondary)]">Reference Completeness</label>
              <Select
                value={formData.referenceCompleteness}
                onValueChange={(value) => setFormData(prev => ({ ...prev, referenceCompleteness: value }))}
                options={REFERENCE_COMPLETENESS_OPTIONS}
                className={wasChanged('referenceCompleteness') ? 'border-[var(--color-warning)]' : ''}
              />
            </div>

            <div>
              <label className="text-sm text-[var(--color-text-secondary)]">Reference Target</label>
              <Select
                value={formData.referenceTarget}
                onValueChange={(value) => setFormData(prev => ({ ...prev, referenceTarget: value }))}
                options={REFERENCE_TARGET_OPTIONS}
                className={wasChanged('referenceTarget') ? 'border-[var(--color-warning)]' : ''}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
