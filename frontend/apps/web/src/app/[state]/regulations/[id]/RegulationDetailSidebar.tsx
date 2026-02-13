import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RedFlagsList } from '@/components/flags';
import { ComplianceIssuesList } from '@/components/issues';
import { DefinitionsList, ApplicableDefinitions } from '@/components/definitions';
import { CrossReferenceList, IncomingReferenceList } from '@/components/cross-references';
import { formatDisplayTitle } from '@/lib/format';
import {
  RegulationHierarchyDetails,
  RegulationMetadata,
  EnhancedRegulationSummary,
  ExclusionToggle,
} from '@/components/regulations';
import { HierarchyBreadcrumbsServer } from '@/components/regulations/HierarchyBreadcrumbsServer';
import { ChildrenListServer } from '@/components/regulations/ChildrenListServer';
import { EnablingAuthorityCard, StatuteLinksList } from '@/components/statutes';
import type {
  RegulationWithAnalysis,
  ApplicableDefinition,
  CrossReferenceWithTarget,
  CrossReferenceWithSource,
  ComplianceIssueWithAnalysisFields,
  RegulationStatuteLinkWithStatute,
} from '@deproceduralizer/database';

interface RegulationDetailSidebarProps {
  /** The regulation document */
  regulation: RegulationWithAnalysis;
  regulationId: number;
  state: string;
  backUrl: string;
  /** Compliance issues for this document */
  complianceIssues: ComplianceIssueWithAnalysisFields[];
  /** Outgoing cross-references */
  crossRefs: CrossReferenceWithTarget[];
  /** Incoming cross-references (cited by) */
  incomingRefs: CrossReferenceWithSource[];
  /** Non-enabling-authority statute links */
  statuteLinks: RegulationStatuteLinkWithStatute[];
  /** Enabling authority statute links */
  enablingAuthority: RegulationStatuteLinkWithStatute[];
  /** Definitions used in the document text */
  usedDefinitions: ApplicableDefinition[];
  /** Definitions in scope but not used */
  availableButNotUsed: ApplicableDefinition[];
  /** IDs of definitions defined in this document */
  definedHereIds: Set<number>;
}

/**
 * Sidebar component for the regulation detail page.
 * Contains navigation, metadata, analysis findings, and definitions.
 * Server component - renders on the server.
 */
export async function RegulationDetailSidebar({
  regulation,
  regulationId,
  state,
  backUrl,
  complianceIssues,
  crossRefs,
  incomingRefs,
  statuteLinks,
  enablingAuthority,
  usedDefinitions,
  availableButNotUsed,
  definedHereIds,
}: RegulationDetailSidebarProps) {
  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Link href={backUrl}>
        <Button variant="ghost" size="sm">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Browse
        </Button>
      </Link>

      {/* Hierarchy Breadcrumbs */}
      <Card className="p-4">
        <h2 className="font-semibold text-[var(--color-primary)] mb-3 text-sm">Hierarchy</h2>
        <HierarchyBreadcrumbsServer
          documentId={regulationId}
          currentTitle={formatDisplayTitle(regulation) || 'Untitled'}
          state={state}
        />
        <RegulationHierarchyDetails
          regulation={regulation}
          className="mt-3 pt-3 border-t border-[var(--color-neutral-200)] text-sm"
        />
      </Card>

      {/* Enabling Authority */}
      {enablingAuthority.length > 0 && (
        <EnablingAuthorityCard links={enablingAuthority} state={state} />
      )}

      {/* Document Info - Combined Summary and Metadata */}
      <Card className="p-4">
        <h2 className="font-semibold text-[var(--color-text)] mb-3 text-sm">Document Info</h2>

        {/* Summary section */}
        <EnhancedRegulationSummary
          summary={regulation.summary}
          sectionType={regulation.sectionType}
          keywords={regulation.keywords}
          appliesTo={regulation.appliesTo}
          hasForm={regulation.hasForm}
          hasIbr={regulation.hasIbr}
          showHeading={false}
        />

        {/* Source and Analysis section */}
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          <RegulationMetadata regulation={regulation} layout="grid" />
        </div>
      </Card>

      {/* Exclusion Toggle */}
      <Card className="p-4">
        <ExclusionToggle
          documentId={regulationId}
          isExcluded={regulation.excludeFromAnalysis ?? false}
          excludedBy={regulation.excludedBy}
          excludedAt={regulation.excludedAt}
          excludedReason={regulation.excludedReason}
        />
      </Card>

      {/* Children (sub-sections) */}
      <ChildrenListServer documentId={regulationId} state={state} />

      {/* Red Flags */}
      {regulation.redFlags && regulation.redFlags.length > 0 && (
        <RedFlagsList initialFlags={regulation.redFlags} />
      )}

      {/* Compliance Issues */}
      {complianceIssues && complianceIssues.length > 0 && (
        <ComplianceIssuesList
          initialIssues={complianceIssues}
          regulationContent={regulation.content}
        />
      )}

      {/* Cross-References */}
      {crossRefs.length > 0 && (
        <Card className="p-4">
          <CrossReferenceList
            crossRefs={crossRefs}
            state={state as 'nj' | 'ny'}
            title="Cross-References"
          />
        </Card>
      )}

      {/* Incoming References */}
      {incomingRefs.length > 0 && (
        <Card className="p-4">
          <IncomingReferenceList
            crossRefs={incomingRefs}
            state={state as 'nj' | 'ny'}
            title="Cited By"
          />
        </Card>
      )}

      {/* Statute Links */}
      {statuteLinks.length > 0 && (
        <Card className="p-4">
          <StatuteLinksList links={statuteLinks} state={state} />
        </Card>
      )}

      {/* Definitions Used */}
      {usedDefinitions.length > 0 && (
        <DefinitionsList
          definitions={usedDefinitions}
          definedHereIds={definedHereIds}
          currentDocumentId={regulationId}
          state={state}
          title="Definitions Used"
          description="Terms that appear in this document"
          collapsible
          initialCollapsed={false}
        />
      )}

      {/* Available Definitions */}
      {availableButNotUsed.length > 0 && (
        <ApplicableDefinitions
          definitions={availableButNotUsed}
          state={state}
          title="Other Available Definitions"
          description="Terms in scope but not used in this document"
          collapsed={true}
        />
      )}
    </div>
  );
}

export default RegulationDetailSidebar;
