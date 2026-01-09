import { useState, useEffect, useCallback } from 'react';
import { useReviewerName } from '@/hooks/useReviewerName';
import type { DefinitionWithContext, DefinitionOriginalValues } from '@deproceduralizer/database';
import type { DefinitionFormData, DefinitionWithNewFields } from '../types';

export function useDefinitionForm(definition: DefinitionWithContext) {
  const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

  // Extended definition with new fields
  const defWithNewFields = definition as unknown as DefinitionWithNewFields;

  // Original values for comparison
  const originalValues: DefinitionOriginalValues = (definition.originalValues as DefinitionOriginalValues) || {};

  // Form state
  const [formData, setFormData] = useState<DefinitionFormData>({
    term: definition.term,
    isVerbatimTextComplete: defWithNewFields.isVerbatimTextComplete ?? true,
    verbatimText: definition.verbatimText,
    rephrasedDefinition: definition.rephrasedDefinition || '',
    scope: definition.scope || '',
    scopeLevel: definition.scopeLevel || 'none',
    scopeDocumentId: definition.scopeDocumentId,
    definitionType: definition.definitionType || 'formal',
    isCrossReference: definition.isCrossReference ?? false,
    referenceCompleteness: defWithNewFields.referenceCompleteness || 'none',
    referenceTarget: defWithNewFields.referenceTarget || 'none',
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

  // Check if any fields have been modified
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

  // Get original value for comparison
  const getOriginalValue = useCallback(<K extends keyof DefinitionOriginalValues>(key: K) => {
    if (originalValues[key] !== undefined) {
      return originalValues[key];
    }
    const defRecord = definition as unknown as Record<string, unknown>;
    return defRecord[key];
  }, [originalValues, definition]);

  // Check if a field was changed from original
  const wasChanged = useCallback((key: keyof DefinitionOriginalValues) => {
    return originalValues[key] !== undefined;
  }, [originalValues]);

  return {
    formData,
    setFormData,
    hasChanges,
    getOriginalValue,
    wasChanged,
    saveReviewerName,
    defWithNewFields,
  };
}
