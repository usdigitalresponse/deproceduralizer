'use client';

import { useState, forwardRef } from 'react';
import { formatStateCitation } from '@/lib/formatters/citations';
import { CardWrapper, HierarchyTreeView } from '../../shared';
import { useDefinitionForm } from './hooks/useDefinitionForm';
import { useDefinitionHandlers } from './hooks/useDefinitionHandlers';
import { Header } from './Header';
import { SummaryContext } from './SummaryContext';
import { OriginalColumn } from './OriginalColumn';
import { EditableColumn } from './EditableColumn';
import { MetadataSection } from './MetadataSection';
import { ReviewNotesSection } from './ReviewNotesSection';
import { ActionButtons } from './ActionButtons';
import type { DefinitionReviewCardProps } from './types';

export const DefinitionReviewCard = forwardRef<HTMLDivElement, DefinitionReviewCardProps>(
  ({ definition, onUpdated, onReviewComplete, onViewRegulation, state, isFocused = false, isSelected = false, onSelectionChange, isExiting = false }, ref) => {
    const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

    // Form state and helpers
    const {
      formData,
      setFormData,
      hasChanges,
      getOriginalValue,
      wasChanged,
      saveReviewerName,
    } = useDefinitionForm(definition);

    // Submit handlers
    const {
      isPending,
      error,
      handleConfirm,
      handleSaveCorrections,
      handleMarkFalsePositive,
    } = useDefinitionHandlers({
      definition,
      formData,
      onUpdated,
      onReviewComplete,
      saveReviewerName,
    });

    // Format citation based on state
    const citation = definition.regulation
      ? formatStateCitation(state, definition.regulation) ?? 'Unknown source'
      : 'Unknown source';

    return (
      <CardWrapper ref={ref} id={`definition-${definition.id}`} isFocused={isFocused} isExiting={isExiting} data-testid="definition-card">
        <Header
          definition={definition}
          citation={citation ?? 'Unknown source'}
          state={state}
          isSelected={isSelected}
          onSelectionChange={onSelectionChange}
        />

        <SummaryContext regulation={definition.regulation} />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <OriginalColumn
            definition={definition}
            state={state}
            formData={formData}
            getOriginalValue={getOriginalValue}
          />

          <EditableColumn
            definition={definition}
            state={state}
            formData={formData}
            setFormData={setFormData}
            wasChanged={wasChanged}
          />
        </div>

        {/* Hierarchy Tree View */}
        {definition.regulation && (
          <HierarchyTreeView
            documentId={definition.regulation.id}
            state={state}
          />
        )}

        <MetadataSection
          definition={definition}
          isExpanded={isMetadataExpanded}
          onToggle={() => setIsMetadataExpanded(!isMetadataExpanded)}
        />

        <ReviewNotesSection
          formData={formData}
          setFormData={setFormData}
          hasChanges={hasChanges()}
        />

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded text-sm">
            {error}
          </div>
        )}

        <ActionButtons
          isPending={isPending}
          hasChanges={hasChanges()}
          reviewerName={formData.reviewerName}
          onConfirm={handleConfirm}
          onSaveCorrections={handleSaveCorrections}
          onMarkFalsePositive={handleMarkFalsePositive}
        />
      </CardWrapper>
    );
  }
);

DefinitionReviewCard.displayName = 'DefinitionReviewCard';
