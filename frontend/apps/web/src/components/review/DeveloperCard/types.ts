import type { DeveloperItem } from '@/lib/actions/developer';

export interface DeveloperCardProps {
  item: DeveloperItem;
  onUpdated: (updatedItem: DeveloperItem) => void;
  /** Called after item is cleared and should be removed from the list */
  onCleared?: (itemId: number, itemType: 'red_flag' | 'compliance_issue') => void;
  onViewRegulation?: (regulationId: number) => void;
  isFocused?: boolean;
  /** State code for hierarchy links */
  state?: string;
}

export interface DeveloperFormData {
  developerStatus: string;
  developerAssigned: string;
  developerNotes: string;
  resolutionType: string;
  resolutionComments: string;
  developerQuestion: string;
}

export interface ReviewSummaryProps {
  item: DeveloperItem;
}

export interface RedFlagContentProps {
  item: DeveloperItem;
  state: string;
}

export interface ComplianceIssueContentProps {
  item: DeveloperItem;
  state: string;
}

export interface DeveloperFormProps {
  item: DeveloperItem;
  formData: DeveloperFormData;
  setFormData: React.Dispatch<React.SetStateAction<DeveloperFormData>>;
  isPending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  state: string;
  onShowClearConfirm: () => void;
}

export interface ClearConfirmDialogProps {
  item: DeveloperItem;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
