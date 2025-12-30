'use client';

import { useState, useTransition, useEffect, forwardRef } from 'react';
import { updateDeveloperStatus, clearEntryForReview, type DeveloperItem } from '@/lib/actions/developer';
import { useDeveloperName } from '@/hooks/useDeveloperName';
import { Button, Textarea, Badge, SeverityBadge, Select, Tag, CopyLinkButton } from '@/components/ui';
import { DEVELOPER_STATUSES, RESOLUTION_TYPES, DEVELOPERS, DEVELOPER_STATUS_LABELS, ISSUE_TYPE_LABELS, formatLabel, PRIORITY_OPTIONS, IMPACT_TYPES } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatNjacCitation } from '@/lib/formatters/njac';
import { CardWrapper, HierarchyBreadcrumbsInline, CornellLink, RegulationTextViewer, HierarchyTreeView } from './shared';
import { Flag, FileWarning, AlertCircle, ChevronDown, ChevronUp, ExternalLink, RotateCcw } from 'lucide-react';

interface DeveloperCardProps {
  item: DeveloperItem;
  onUpdated: (updatedItem: DeveloperItem) => void;
  /** Called after item is cleared and should be removed from the list */
  onCleared?: (itemId: number, itemType: 'red_flag' | 'compliance_issue') => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
  /** State code for hierarchy links */
  state?: string;
}

// Helper to format priority/impact values
const getPriorityLabel = (priority: number | null) => {
  if (!priority) return null;
  const option = PRIORITY_OPTIONS.find(o => o.value === String(priority));
  return option?.label || `P${priority}`;
};

const getImpactLabel = (impact: string | null) => {
  if (!impact) return null;
  const option = IMPACT_TYPES.find(o => o.value === impact);
  return option?.label || formatLabel(impact);
};

// Review Summary Component
function ReviewSummary({ item }: { item: DeveloperItem }) {
  const [showDetails, setShowDetails] = useState(false);

  // Get type-specific fields
  const redFlag = item.redFlagData;
  const compliance = item.complianceIssueData;

  // Determine missing critical fields
  const missingCritical: string[] = [];
  if (!item.reviewedBy) missingCritical.push('Reviewer');
  if (!item.justificationNotes) missingCritical.push('Justification');

  // Type-specific missing fields
  if (item.type === 'red_flag' && redFlag) {
    if (!redFlag.priority) missingCritical.push('Priority');
    if (!redFlag.impactType) missingCritical.push('Impact Type');
  }

  // Check for severity changes (compliance only)
  const severityChanged = compliance && compliance.originalSeverity !== null &&
    compliance.originalSeverity !== compliance.severity;

  return (
    <div className="mb-4 p-3 bg-[var(--color-primary-weaker)] rounded-[var(--radius-md)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-[var(--color-text-secondary)]">Review Summary</div>
        {missingCritical.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
            <AlertCircle className="w-3 h-3" />
            Missing: {missingCritical.join(', ')}
          </div>
        )}
      </div>

      {/* Primary review info */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div>
          <span className="text-[var(--color-text-muted)]">Status: </span>
          <span className="text-[var(--color-text)]">{formatLabel(item.reviewStatus || 'unreviewed')}</span>
        </div>
        {item.reviewedBy ? (
          <div>
            <span className="text-[var(--color-text-muted)]">By: </span>
            <span className="text-[var(--color-text)]">{item.reviewedBy}</span>
          </div>
        ) : (
          <div className="text-[var(--color-text-muted)] italic">No reviewer</div>
        )}
        {item.reviewedAt && (
          <div>
            <span className="text-[var(--color-text-muted)]">Reviewed: </span>
            <span className="text-[var(--color-text)]">
              {new Date(item.reviewedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Type-specific fields */}
      {item.type === 'red_flag' && redFlag && (
        <div className="flex items-center gap-4 text-sm flex-wrap mt-2">
          <div>
            <span className="text-[var(--color-text-muted)]">Priority: </span>
            <span className={redFlag.priority ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] italic'}>
              {getPriorityLabel(redFlag.priority) || 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Impact: </span>
            <span className={redFlag.impactType ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] italic'}>
              {getImpactLabel(redFlag.impactType) || 'Not set'}
            </span>
          </div>
        </div>
      )}

      {item.type === 'compliance_issue' && compliance && (
        <div className="flex items-center gap-4 text-sm flex-wrap mt-2">
          <div>
            <span className="text-[var(--color-text-muted)]">Severity: </span>
            <span className="text-[var(--color-text)]">{compliance.severity ?? 'Not set'}</span>
            {severityChanged && (
              <span className="ml-1 text-[var(--color-warning)] text-xs">
                (was {compliance.originalSeverity})
              </span>
            )}
          </div>
          {compliance.impactType && (
            <div>
              <span className="text-[var(--color-text-muted)]">Impact: </span>
              <span className="text-[var(--color-text)]">{getImpactLabel(compliance.impactType)}</span>
            </div>
          )}
        </div>
      )}

      {/* Justification - always show (critical) */}
      <div className="mt-2 text-sm">
        <span className="text-[var(--color-text-muted)]">Justification: </span>
        {item.justificationNotes ? (
          <span className="text-[var(--color-text)]">{item.justificationNotes}</span>
        ) : (
          <span className="text-[var(--color-text-muted)] italic">Not provided</span>
        )}
      </div>

      {/* Team notes - always show if present or if nothing else to show */}
      {(item.teamNotes || !item.justificationNotes) && (
        <div className="mt-1 text-sm">
          <span className="text-[var(--color-text-muted)]">Team Notes: </span>
          {item.teamNotes ? (
            <span className="text-[var(--color-text)]">{item.teamNotes}</span>
          ) : (
            <span className="text-[var(--color-text-muted)] italic">None</span>
          )}
        </div>
      )}

      {/* Collapsible additional details */}
      {(item.developerNotes || item.resolutionComments || item.developerQuestion) && (
        <div className="mt-2 border-t border-[var(--color-neutral-200)] pt-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDetails ? 'Hide' : 'Show'} developer details
          </button>
          {showDetails && (
            <div className="mt-2 space-y-1 text-sm">
              {item.developerNotes && (
                <p><span className="text-[var(--color-text-muted)]">Dev Notes:</span> {item.developerNotes}</p>
              )}
              {item.resolutionComments && (
                <p><span className="text-[var(--color-text-muted)]">Resolution:</span> {item.resolutionComments}</p>
              )}
              {item.developerQuestion && (
                <p><span className="text-[var(--color-text-muted)]">Question:</span> {item.developerQuestion}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const DeveloperCard = forwardRef<HTMLDivElement, DeveloperCardProps>(
  ({ item, onUpdated, onCleared, onViewRegulation, isFocused = false, state = 'nj' }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [isClearPending, startClearTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const { developerName: storedName, saveDeveloperName, isLoaded } = useDeveloperName();

    const [formData, setFormData] = useState({
      developerStatus: item.developerStatus || 'unresolved',
      developerAssigned: item.developerAssigned || '',
      developerNotes: item.developerNotes || '',
      resolutionType: item.resolutionType || '',
      resolutionComments: item.resolutionComments || '',
      developerQuestion: item.developerQuestion || '',
    });

    // Pre-fill developer name from localStorage
    useEffect(() => {
      if (isLoaded && storedName && !formData.developerAssigned) {
        setFormData((prev) => ({ ...prev, developerAssigned: storedName }));
      }
    }, [isLoaded, storedName, formData.developerAssigned]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!formData.developerAssigned) {
        setError('Developer assignment is required');
        return;
      }

      startTransition(async () => {
        try {
          await updateDeveloperStatus({
            type: item.type,
            id: item.id,
            developerStatus: formData.developerStatus,
            developerAssigned: formData.developerAssigned,
            developerNotes: formData.developerNotes || undefined,
            resolutionType: formData.resolutionType || undefined,
            resolutionComments: formData.resolutionComments || undefined,
            developerQuestion: formData.developerQuestion || undefined,
          });

          // Save developer name for next time
          if (formData.developerAssigned === 'Michael' || formData.developerAssigned === 'Abigail') {
            saveDeveloperName(formData.developerAssigned);
          }

          // Update parent with new data
          onUpdated({
            ...item,
            developerStatus: formData.developerStatus,
            developerAssigned: formData.developerAssigned,
            developerNotes: formData.developerNotes || null,
            resolutionType: formData.resolutionType || null,
            resolutionComments: formData.resolutionComments || null,
            developerQuestion: formData.developerQuestion || null,
            developerCheckedAt: new Date(),
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update developer status');
        }
      });
    };

    // Handle clearing the entry and returning to review
    const handleClearEntry = () => {
      setError(null);
      startClearTransition(async () => {
        try {
          const result = await clearEntryForReview({
            type: item.type,
            id: item.id,
          });

          if (!result.success) {
            setError(result.error || 'Failed to clear entry');
            return;
          }

          // Notify parent to remove this item from the list
          if (onCleared) {
            onCleared(item.id, item.type);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to clear entry');
        } finally {
          setShowClearConfirm(false);
        }
      });
    };

    // Get status color for badge
    const getStatusVariant = (status: string | null) => {
      switch (status) {
        case 'resolved':
          return 'success';
        case 'pending':
          return 'warning';
        case 'backlogged':
          return 'default';
        case 'need_more_info':
          return 'info';
        case 'unresolved':
        default:
          return 'danger';
      }
    };

    // Render type-specific content
    const renderItemContent = () => {
      if (item.type === 'red_flag' && item.redFlagData) {
        const flag = item.redFlagData;
        const nycrrCitation = formatNycrrCitation(
          flag.regulation.nycrrTitle,
          flag.regulation.nycrrPart,
          flag.regulation.nycrrSection
        );

        return (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-[var(--color-text)]">{formatLabel(flag.category)}</span>
              <SeverityBadge severity={flag.severity} />
            </div>
            {/* Hierarchy breadcrumb */}
            <div className="mb-1">
              <HierarchyBreadcrumbsInline
                documentId={flag.regulation.id}
                state={state}
              />
            </div>
            <div className="text-sm text-[var(--color-text-muted)] mb-2">
              {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
              {nycrrCitation && flag.regulation.title && ' - '}
              <span className="text-[var(--color-text-secondary)]">{flag.regulation.title}</span>
            </div>

            {/* Explanation */}
            <div className="mb-4">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Why Flagged:</span>
              <p className="mt-1 text-sm text-[var(--color-text)]">{flag.explanation}</p>
            </div>

            {/* Matched phrases */}
            {flag.matchedPhrases && flag.matchedPhrases.length > 0 && (
              <div className="mb-4">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Matched phrases:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {flag.matchedPhrases.map((phrase, i) => (
                    <Tag key={i} variant="primary" size="sm">
                      {phrase}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {/* Implementation approach */}
            {flag.implementationApproach && (
              <div className="mb-4 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">Implementation:</span>
                <span className="ml-2 text-[var(--color-text)]">{flag.implementationApproach}</span>
              </div>
            )}

            {/* Full Regulation Text Viewer */}
            {(flag.regulation as unknown as { content?: string }).content && (
              <RegulationTextViewer
                content={(flag.regulation as unknown as { content: string }).content}
                scrollToText={flag.explanation}
                highlightPattern={flag.matchedPhrases?.length ? flag.matchedPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : undefined}
                label="Show Regulation Text"
              />
            )}
          </>
        );
      }

      if (item.type === 'compliance_issue' && item.complianceIssueData) {
        const issue = item.complianceIssueData;
        const citation = issue.state === 'NJ'
          ? formatNjacCitation(
              issue.regulation.njacTitle,
              issue.regulation.njacChapter,
              issue.regulation.njacSubchapter
            )
          : formatNycrrCitation(
              issue.regulation.nycrrTitle,
              issue.regulation.nycrrPart,
              issue.regulation.nycrrSection
            );

        return (
          <>
            {/* Header badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="warning">{ISSUE_TYPE_LABELS[issue.issueType] || formatLabel(issue.issueType)}</Badge>
              {issue.requirementFound === true && <Badge variant="success" className="text-xs">LLM Confirmed</Badge>}
              {issue.requirementFound === false && <Badge variant="danger" className="text-xs">LLM Rejected</Badge>}
              {issue.requiredByStatute && <Badge variant="info" className="text-xs">From Statute</Badge>}
              {issue.severity !== null && <SeverityBadge severity={issue.severity} />}
            </div>

            {/* Hierarchy breadcrumb */}
            <div className="mb-1">
              <HierarchyBreadcrumbsInline
                documentId={issue.regulation.id}
                state={issue.state || state}
              />
            </div>

            {/* Regulation citation */}
            <div className="text-sm text-[var(--color-text-muted)] mb-4">
              {citation && <span className="font-mono">{citation}</span>}
              {citation && issue.regulation.title && ' - '}
              <span className="text-[var(--color-text-secondary)]">{issue.regulation.title}</span>
            </div>

            {/* LLM Analysis box */}
            {(issue.impactAssessment || issue.requirementText) && (
              <div className="mb-4 p-4 bg-[var(--color-primary-bg)] rounded-[var(--radius-md)] border border-[var(--color-primary)]/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-[var(--color-primary)]">LLM Analysis</span>
                  {issue.isVerbatim !== null && (
                    <Badge
                      variant={issue.isVerbatim ? 'info' : 'default'}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {issue.isVerbatim ? 'Verbatim Quote' : 'Paraphrased'}
                    </Badge>
                  )}
                </div>

                {/* Requirement Text */}
                {issue.requirementText && (
                  <div className="mb-3">
                    <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                      {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">&quot;</span>}
                      {issue.requirementText}
                      {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">&quot;</span>}
                    </p>
                  </div>
                )}

                {/* Impact Assessment */}
                {issue.impactAssessment && (
                  <div className="pt-3 border-t border-[var(--color-primary)]/10">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">Impact Assessment:</span>
                    <p className="mt-1 text-sm text-[var(--color-text)]">{issue.impactAssessment}</p>
                  </div>
                )}

                {/* Statute Citation */}
                {issue.statuteCitation && (
                  <div className="pt-3 border-t border-[var(--color-primary)]/10">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">Statute Citation:</span>
                    <p className="mt-1 text-sm font-mono text-[var(--color-text)]">{issue.statuteCitation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Full Regulation Text Viewer */}
            {(issue.regulation as unknown as { content?: string }).content && (
              <RegulationTextViewer
                content={(issue.regulation as unknown as { content: string }).content}
                scrollToText={issue.requirementText}
                highlightPattern={issue.matchedPattern}
                isVerbatim={issue.isVerbatim ?? false}
                label="Show Regulation Text"
              />
            )}

            {/* Technical Details (collapsible) */}
            {issue.matchedPattern && (
              <details className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] group">
                <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Technical Details
                </summary>
                <div className="mt-3 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Pattern matched:</span>
                  <div className="mt-1">
                    <Tag variant="warning" size="sm">{issue.matchedPattern}</Tag>
                  </div>
                </div>
              </details>
            )}
          </>
        );
      }

      return null;
    };

    const developerOptions = [...DEVELOPERS];
    const statusOptions = [...DEVELOPER_STATUSES];
    const resolutionOptions = [...RESOLUTION_TYPES];

    const anchor = item.type === 'red_flag' ? `flag-${item.id}` : `compliance-${item.id}`;

    return (
      <CardWrapper
        ref={ref}
        id={anchor}
        isFocused={isFocused}
      >
        {/* Header with type badge and developer status */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <CopyLinkButton anchor={anchor} />
            {item.type === 'red_flag' ? (
              <Badge variant="danger" className="flex items-center gap-1">
                <Flag className="w-3 h-3" />
                Red Flag
              </Badge>
            ) : (
              <Badge variant="warning" className="flex items-center gap-1">
                <FileWarning className="w-3 h-3" />
                Compliance Issue
              </Badge>
            )}
            <Badge variant={getStatusVariant(item.developerStatus)}>
              {DEVELOPER_STATUS_LABELS[item.developerStatus || 'unresolved']}
            </Badge>
          </div>
          {item.developerAssigned && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Assigned: {item.developerAssigned}
            </span>
          )}
        </div>

        {/* Item content */}
        <div className="mb-4">
          {renderItemContent()}
        </div>

        {/* Review info (read-only summary) */}
        <ReviewSummary item={item} />

        {/* Hierarchy Tree View */}
        <HierarchyTreeView
          documentId={item.regulation.id}
          state={state}
          defaultExpanded
        />

        {/* Developer form */}
        <form onSubmit={handleSubmit} className="pt-4 border-t border-[var(--color-neutral-200)]">
          {error && (
            <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {/* Developer */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Developer *
              </label>
              <Select
                value={formData.developerAssigned || undefined}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, developerAssigned: value }))}
                options={developerOptions}
                placeholder="Select developer"
                disabled={isPending}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Status *
              </label>
              <Select
                value={formData.developerStatus}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, developerStatus: value }))}
                options={statusOptions}
                disabled={isPending}
              />
            </div>

            {/* Resolution Type (shown when resolved) */}
            {formData.developerStatus === 'resolved' && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Resolution
                </label>
                <Select
                  value={formData.resolutionType || undefined}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, resolutionType: value }))}
                  options={resolutionOptions}
                  placeholder="--"
                  disabled={isPending}
                />
              </div>
            )}
          </div>

          {/* Resolution Comments (shown when resolved) */}
          {formData.developerStatus === 'resolved' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Resolution Comments
              </label>
              <Textarea
                value={formData.resolutionComments}
                onChange={(e) => setFormData((prev) => ({ ...prev, resolutionComments: e.target.value }))}
                rows={2}
                placeholder="Describe what was done or why not implemented..."
                disabled={isPending}
              />
            </div>
          )}

          {/* Question for Reviewer (shown when need_more_info) */}
          {formData.developerStatus === 'need_more_info' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Question for Reviewer
              </label>
              <Textarea
                value={formData.developerQuestion}
                onChange={(e) => setFormData((prev) => ({ ...prev, developerQuestion: e.target.value }))}
                rows={2}
                placeholder="What information do you need from the reviewer?"
                disabled={isPending}
              />
            </div>
          )}

          {/* Developer Notes */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Developer Notes
            </label>
            <Textarea
              value={formData.developerNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, developerNotes: e.target.value }))}
              rows={2}
              placeholder="Internal notes about this item..."
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/${state.toLowerCase()}/regulations/${item.regulation.id}`, '_blank')}
              >
                View Full Regulation Page
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <CornellLink url={item.regulation.url} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                disabled={isClearPending}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Clear & Return
              </Button>
            </div>
            <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>

        {/* Clear Confirmation Dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
                Clear Entry and Return to Review?
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                This will clear all review data and developer notes. The item will return to the unreviewed queue.
                {item.type === 'compliance_issue' && item.complianceIssueData?.originalSeverity && (
                  <span className="block mt-2 text-[var(--color-warning)]">
                    Severity will be restored from {item.complianceIssueData.severity} to {item.complianceIssueData.originalSeverity}.
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--color-danger)] mb-4">
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleClearEntry}
                  isLoading={isClearPending}
                >
                  {isClearPending ? 'Clearing...' : 'Clear Entry'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardWrapper>
    );
  }
);

DeveloperCard.displayName = 'DeveloperCard';

export default DeveloperCard;
