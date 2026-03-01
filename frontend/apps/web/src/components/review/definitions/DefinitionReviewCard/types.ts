import type { DefinitionWithContext, DefinitionOriginalValues, JurisdictionCode } from '@deproceduralizer/database';

export interface DefinitionReviewCardProps {
  definition: DefinitionWithContext;
  onUpdated: (updatedDefinition: DefinitionWithContext) => void;
  onReviewComplete?: (definitionId: number, status: 'confirmed' | 'corrected' | 'false_positive') => void;
  onViewRegulation: (regulationId: number) => void;
  jurisdiction: JurisdictionCode;
  isFocused?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
  isExiting?: boolean;
}

export interface DefinitionFormData {
  term: string;
  isVerbatimTextComplete: boolean;
  verbatimText: string;
  rephrasedDefinition: string;
  scope: string;
  scopeLevel: string;
  scopeDocumentId: number | null;
  definitionType: string;
  isCrossReference: boolean;
  referenceCompleteness: string;
  referenceTarget: string;
  reviewerName: string;
  justificationNotes: string;
  teamNotes: string;
}

export interface HeaderProps {
  definition: DefinitionWithContext;
  citation: string;
  jurisdiction: JurisdictionCode;
  isSelected: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
}

export interface SummaryContextProps {
  regulation: DefinitionWithContext['regulation'];
}

export interface OriginalColumnProps {
  definition: DefinitionWithContext;
  jurisdiction: JurisdictionCode;
  formData: Pick<DefinitionFormData, 'isVerbatimTextComplete'>;
  getOriginalValue: <K extends keyof DefinitionOriginalValues>(key: K) => unknown;
}

export interface EditableColumnProps {
  definition: DefinitionWithContext;
  jurisdiction: JurisdictionCode;
  formData: DefinitionFormData;
  setFormData: React.Dispatch<React.SetStateAction<DefinitionFormData>>;
  wasChanged: (key: keyof DefinitionOriginalValues) => boolean;
}

export interface MetadataSectionProps {
  definition: DefinitionWithContext;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface ReviewNotesSectionProps {
  formData: DefinitionFormData;
  setFormData: React.Dispatch<React.SetStateAction<DefinitionFormData>>;
  hasChanges: boolean;
}

export interface ActionButtonsProps {
  isPending: boolean;
  hasChanges: boolean;
  reviewerName: string;
  onConfirm: () => void;
  onSaveCorrections: () => void;
  onMarkFalsePositive: () => void;
}