'use client';

import { useState, useTransition, useEffect, forwardRef, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { updateDefinitionReview, getAncestorDocumentsForScope } from '@/lib/actions/definitions';
import { useReviewerName } from '@/hooks/useReviewerName';
import { Button, Input, Textarea, Badge, Select } from '@/components/ui';
import { CopyLinkButton } from '@/components/ui/CopyLinkButton';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatNjacCitation } from '@/lib/formatters/njac';
import { CardWrapper, CornellLink, RegulationTextViewer, HierarchyTreeView } from '../shared';
import { ScopeDocumentTypeahead } from './ScopeDocumentTypeahead';
import type { DefinitionWithContext, DefinitionOriginalValues, StateCode, ReferenceCompleteness, ReferenceTarget } from '@deproceduralizer/database';
import { REFERENCE_COMPLETENESS, REFERENCE_TARGETS } from '@deproceduralizer/database';

interface DefinitionReviewCardProps {
  definition: DefinitionWithContext;
  onUpdated: (updatedDefinition: DefinitionWithContext) => void;
  onReviewComplete?: (definitionId: number, status: 'confirmed' | 'corrected' | 'false_positive') => void;
  onViewRegulation: (regulationId: number) => void;
  state: StateCode;
  isFocused?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
  isExiting?: boolean;
}

const SCOPE_LEVELS = [
  { value: 'none', label: 'Not specified' },
  { value: 'section', label: 'Section' },
  { value: 'subpart', label: 'Subpart' },
  { value: 'part', label: 'Part' },
  { value: 'subchapter', label: 'Subchapter' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'title', label: 'Title' },
];

const DEFINITION_TYPES = [
  { value: 'formal', label: 'Formal' },
  { value: 'abbreviation', label: 'Abbreviation' },
];

const REFERENCE_COMPLETENESS_OPTIONS = [
  { value: 'none', label: 'Not specified' },
  { value: 'pure_pointer', label: 'Pure Pointer' },
  { value: 'hybrid', label: 'Hybrid' },
];

const REFERENCE_TARGET_OPTIONS = [
  { value: 'none', label: 'Not specified' },
  { value: 'same_corpus', label: 'Same Corpus (NJ/NY)' },
  { value: 'federal', label: 'Federal (CFR/USC)' },
  { value: 'external_standard', label: 'External Standard' },
  { value: 'other', label: 'Other' },
];

export const DefinitionReviewCard = forwardRef<HTMLDivElement, DefinitionReviewCardProps>(
  ({ definition, onUpdated, onReviewComplete, onViewRegulation, state, isFocused = false, isSelected = false, onSelectionChange, isExiting = false }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
    const [isSourceExpanded, setIsSourceExpanded] = useState(true);
    const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

    // Original values for comparison (from originalValues JSONB or current values if unreviewed)
    const originalValues: DefinitionOriginalValues = (definition.originalValues as DefinitionOriginalValues) || {};

    // Editable form data
    const [formData, setFormData] = useState({
      term: definition.term,
      isVerbatimTextComplete: (definition as unknown as { isVerbatimTextComplete?: boolean }).isVerbatimTextComplete ?? true,
      verbatimText: definition.verbatimText,
      rephrasedDefinition: definition.rephrasedDefinition || '',
      scope: definition.scope || '',
      scopeLevel: definition.scopeLevel || 'none',
      scopeDocumentId: definition.scopeDocumentId,
      definitionType: definition.definitionType || 'formal',
      isCrossReference: definition.isCrossReference ?? false,
      referenceCompleteness: (definition as unknown as { referenceCompleteness?: string }).referenceCompleteness || 'none',
      referenceTarget: (definition as unknown as { referenceTarget?: string }).referenceTarget || 'none',
      reviewerName: '',
      justificationNotes: '',
      teamNotes: '',
    });

    // Pre-fill reviewer name from localStorage
    useEffect(() => {
      if (isLoaded && storedName && !formData.reviewerName) {
        setFormData(prev => ({ ...prev, reviewerName: storedName }));
      }
    }, [isLoaded, storedName, formData.reviewerName]);

    // Format citation based on state
    const citation = definition.regulation
      ? state === 'nj'
        ? formatNjacCitation(
            definition.regulation.njacTitle,
            definition.regulation.njacChapter,
            definition.regulation.njacSubchapter
          )
        : formatNycrrCitation(
            definition.regulation.nycrrTitle,
            definition.regulation.nycrrPart,
            definition.regulation.nycrrSection
          )
      : 'Unknown source';

    // Check if any fields have been modified
    const defWithNewFields = definition as unknown as {
      isVerbatimTextComplete?: boolean;
      referenceCompleteness?: string;
      referenceTarget?: string;
    };
    const hasChanges = useCallback(() => {
      return (
        formData.term !== definition.term ||
        formData.isVerbatimTextComplete !== (defWithNewFields.isVerbatimTextComplete ?? true) ||
        formData.verbatimText !== definition.verbatimText ||
        formData.rephrasedDefinition !== (definition.rephrasedDefinition || '') ||
        formData.scope !== (definition.scope || '') ||
        formData.scopeLevel !== (definition.scopeLevel || '') ||
        formData.scopeDocumentId !== definition.scopeDocumentId ||
        formData.definitionType !== (definition.definitionType || 'formal') ||
        formData.isCrossReference !== (definition.isCrossReference ?? false) ||
        formData.referenceCompleteness !== (defWithNewFields.referenceCompleteness || 'none') ||
        formData.referenceTarget !== (defWithNewFields.referenceTarget || 'none')
      );
    }, [formData, definition, defWithNewFields]);

    const handleConfirm = async () => {
      setError(null);

      if (!formData.reviewerName.trim()) {
        setError('Reviewer name is required');
        return;
      }

      startTransition(async () => {
        try {
          const result = await updateDefinitionReview(definition.id, {
            reviewStatus: 'confirmed',
            reviewerName: formData.reviewerName,
          });

          if (!result.success) {
            setError(result.error);
            return;
          }

          saveReviewerName(formData.reviewerName);
          onUpdated({ ...definition, ...result.data });

          toast.success(`Definition confirmed`, {
            description: `"${definition.term}" reviewed`,
          });

          onReviewComplete?.(definition.id, 'confirmed');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to confirm');
        }
      });
    };

    const handleSaveCorrections = async () => {
      setError(null);

      if (!formData.reviewerName.trim()) {
        setError('Reviewer name is required');
        return;
      }

      if (!formData.justificationNotes.trim()) {
        setError('Please explain why you made this correction');
        return;
      }

      startTransition(async () => {
        try {
          const result = await updateDefinitionReview(definition.id, {
            reviewStatus: 'corrected',
            reviewerName: formData.reviewerName,
            justificationNotes: formData.justificationNotes,
            teamNotes: formData.teamNotes || undefined,
            term: formData.term,
            isVerbatimTextComplete: formData.isVerbatimTextComplete,
            verbatimText: formData.verbatimText,
            rephrasedDefinition: formData.rephrasedDefinition || null,
            scope: formData.scope || null,
            scopeLevel: formData.scopeLevel === 'none' ? null : formData.scopeLevel || null,
            scopeDocumentId: formData.scopeDocumentId ?? null,
            definitionType: formData.definitionType,
            isCrossReference: formData.isCrossReference,
            referenceCompleteness: formData.referenceCompleteness === 'none' ? null : formData.referenceCompleteness,
            referenceTarget: formData.referenceTarget === 'none' ? null : formData.referenceTarget,
          });

          if (!result.success) {
            setError(result.error);
            return;
          }

          saveReviewerName(formData.reviewerName);
          onUpdated({ ...definition, ...result.data });

          toast.success(`Definition corrected`, {
            description: `"${definition.term}" updated and reviewed`,
          });

          onReviewComplete?.(definition.id, 'corrected');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save corrections');
        }
      });
    };

    const handleMarkFalsePositive = async () => {
      setError(null);

      if (!formData.reviewerName.trim()) {
        setError('Reviewer name is required');
        return;
      }

      if (!formData.justificationNotes.trim()) {
        setError('Please explain why this is not a definition');
        return;
      }

      startTransition(async () => {
        try {
          const result = await updateDefinitionReview(definition.id, {
            reviewStatus: 'false_positive',
            reviewerName: formData.reviewerName,
            justificationNotes: formData.justificationNotes,
            teamNotes: formData.teamNotes || undefined,
          });

          if (!result.success) {
            setError(result.error);
            return;
          }

          saveReviewerName(formData.reviewerName);
          onUpdated({ ...definition, ...result.data });

          toast.success(`Marked as not a definition`, {
            description: `"${definition.term}" removed`,
          });

          onReviewComplete?.(definition.id, 'false_positive');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to mark as false positive');
        }
      });
    };

    // Get display value for original vs current
    const getOriginalValue = <K extends keyof DefinitionOriginalValues>(key: K) => {
      if (originalValues[key] !== undefined) {
        return originalValues[key];
      }
      const defRecord = definition as unknown as Record<string, unknown>;
    return defRecord[key];
    };

    const wasChanged = (key: keyof DefinitionOriginalValues) => originalValues[key] !== undefined;

    return (
      <CardWrapper ref={ref} id={`definition-${definition.id}`} isFocused={isFocused} isExiting={isExiting} data-testid="definition-card">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {onSelectionChange && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelectionChange(definition.id, e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
            )}
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                &ldquo;{definition.term}&rdquo;
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {/* Source Document Link */}
                <span className="text-[var(--color-text-secondary)]">Source:</span>
                {definition.regulation ? (
                  <>
                    <Link
                      href={`/${state.toLowerCase()}/regulations/${definition.regulation.id}`}
                      className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
                      target="_blank"
                    >
                      {citation}
                    </Link>
                    <CornellLink url={definition.regulation.url} />
                  </>
                ) : (
                  <span className="text-[var(--color-text-secondary)]">Unknown source</span>
                )}

                {/* Scope Document Link */}
                {definition.scopeDocumentId && (
                  <>
                    <span className="text-[var(--color-text-secondary)] ml-2">Scope:</span>
                    <Link
                      href={`/${state.toLowerCase()}/regulations/${definition.scopeDocumentId}`}
                      className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
                      target="_blank"
                    >
                      ID: {definition.scopeDocumentId}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {definition.reviewStatus === 'unreviewed' && (
              <Badge variant="default">Unreviewed</Badge>
            )}
            {definition.reviewStatus === 'confirmed' && (
              <Badge variant="success">Confirmed</Badge>
            )}
            {definition.reviewStatus === 'corrected' && (
              <Badge variant="warning">Corrected</Badge>
            )}
            {definition.reviewStatus === 'false_positive' && (
              <Badge variant="danger">False Positive</Badge>
            )}
            <CopyLinkButton anchor={`definition-${definition.id}`} />
          </div>
        </div>

        {/* Summary context */}
        {definition.regulation && (definition.regulation.summary || definition.regulation.sectionType || definition.regulation.hasForm || definition.regulation.hasIbr) && (
          <div className="bg-[var(--color-neutral-50)] rounded p-2 mb-4">
            {definition.regulation.summary && (
              <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2">
                {definition.regulation.summary}
              </p>
            )}
            <div className="flex items-center gap-2">
              {definition.regulation.sectionType && (
                <SectionTypeBadge type={definition.regulation.sectionType} compact />
              )}
              <MetadataIndicators hasForm={definition.regulation.hasForm} hasIbr={definition.regulation.hasIbr} />
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Original LLM Extraction (Read-only) */}
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
                <span className="ml-2">{(getOriginalValue('isVerbatimTextComplete') ?? defWithNewFields.isVerbatimTextComplete) ? 'Yes' : 'No'}</span>
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
                    <span className="ml-2">{(getOriginalValue('referenceCompleteness') as string) || defWithNewFields.referenceCompleteness || '(none)'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)]">Ref Target:</span>
                    <span className="ml-2">{(getOriginalValue('referenceTarget') as string) || defWithNewFields.referenceTarget || '(none)'}</span>
                  </div>
                </>
              )}
            </div>

            {/* Source Regulation Text */}
            {definition.regulation?.content && (
              <div className="mt-4 border-t border-[var(--color-neutral-200)] pt-4">
                <RegulationTextViewer
                  content={definition.regulation.content}
                  scrollToText={definition.verbatimText}
                  highlightPattern={definition.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
                  isVerbatim={formData.isVerbatimTextComplete}
                  label="Show Regulation Text"
                  maxHeight="16rem"
                  defaultExpanded={isSourceExpanded}
                />
              </div>
            )}
          </div>

          {/* Right Column - Editable Form */}
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
                  state={state}
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
        </div>

        {/* Hierarchy Tree View */}
        {definition.regulation && (
          <HierarchyTreeView
            documentId={definition.regulation.id}
            state={state}
          />
        )}

        {/* Expandable Metadata Section */}
        <div className="border-t border-[var(--color-neutral-200)] pt-4">
          <button
            onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            <span>{isMetadataExpanded ? '▼' : '▶'}</span>
            Additional Metadata (read-only)
          </button>

          {isMetadataExpanded && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[var(--color-text-secondary)]">
              <div>Source Location: {definition.sourceLocation || 'N/A'}</div>
              <div>Definition Overlap: {definition.definitionOverlap?.toFixed(2) || 'N/A'}</div>
              <div>Model Version: {definition.modelVersion || 'N/A'}</div>
              <div>Extracted At: {definition.extractedAt ? new Date(definition.extractedAt).toLocaleString() : 'N/A'}</div>
              <div>URL: <a href={definition.url || '#'} className="text-[var(--color-link)] hover:underline" target="_blank" rel="noreferrer">{definition.url ? 'View' : 'N/A'}</a></div>
            </div>
          )}
        </div>

        {/* Notes for Review */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">
              Justification and analysis for the model {hasChanges() && <span className="text-[var(--color-danger)]">*</span>}
            </label>
            <Textarea
              value={formData.justificationNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, justificationNotes: e.target.value }))}
              rows={2}
              placeholder="Required if correcting or marking as false positive"
              data-testid="definition-justification-textarea"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">
              Notes for Development Team
            </label>
            <Textarea
              value={formData.teamNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, teamNotes: e.target.value }))}
              rows={2}
              placeholder="Process notes, research tasks, questions..."
              data-testid="definition-team-notes-textarea"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">
              Reviewer <span className="text-[var(--color-danger)]">*</span>
            </label>
            <Input
              value={formData.reviewerName}
              onChange={(e) => setFormData(prev => ({ ...prev, reviewerName: e.target.value }))}
              placeholder="Your name"
              data-testid="definition-reviewer-input"
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-neutral-200)] pt-4">
          <Button
            variant="danger"
            onClick={handleMarkFalsePositive}
            disabled={isPending || !formData.reviewerName.trim()}
            data-testid="definition-false-positive-button"
          >
            Not a Definition
          </Button>

          <div className="flex gap-2">
            {hasChanges() ? (
              <Button
                variant="primary"
                onClick={handleSaveCorrections}
                disabled={isPending || !formData.reviewerName.trim()}
                data-testid="definition-save-corrections-button"
              >
                {isPending ? 'Saving...' : 'Save Corrections'}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={isPending || !formData.reviewerName.trim()}
                data-testid="definition-confirm-button"
              >
                {isPending ? 'Confirming...' : 'Confirm'}
              </Button>
            )}
          </div>
        </div>
      </CardWrapper>
    );
  }
);

DefinitionReviewCard.displayName = 'DefinitionReviewCard';

export default DefinitionReviewCard;
