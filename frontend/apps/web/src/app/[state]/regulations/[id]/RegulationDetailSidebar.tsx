import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ComplianceIssuesSummaryList } from '@/components/issues';
import { DefinitionsList, ApplicableDefinitions } from '@/components/definitions';
import { CrossReferenceList, IncomingReferenceList, GuidanceReferenceList } from '@/components/cross-references';
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
import { JenAIIssuesList } from '@/components/jenai';
import { RegulationSidebarWithNav } from './RegulationSidebarWithNav';
import type { SectionConfig } from '@/hooks/useActiveSection';
import type {
  RegulationWithAnalysis,
  ApplicableDefinition,
  CrossReferenceWithTarget,
  CrossReferenceWithSource,
  ComplianceIssueWithAnalysisFields,
  RegulationStatuteLinkWithStatute,
  JenAIIssue,
} from '@deproceduralizer/database';
import type { GuidanceReferenceItem } from '@/lib/actions/cross-references';

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
  /** Guidance documents that reference this regulation */
  guidanceRefs: GuidanceReferenceItem[];
  /** Definitions used in the document text */
  usedDefinitions: ApplicableDefinition[];
  /** Definitions in scope but not used */
  availableButNotUsed: ApplicableDefinition[];
  /** IDs of definitions defined in this document */
  definedHereIds: Set<number>;
  /** JenAI issues for this document */
  jenaiIssues: JenAIIssue[];
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
  guidanceRefs,
  usedDefinitions,
  availableButNotUsed,
  definedHereIds,
  jenaiIssues,
}: RegulationDetailSidebarProps) {
  const sections: SectionConfig[] = [
    { id: 'sidebar-hierarchy', label: 'Hierarchy' },
    ...(enablingAuthority.length > 0 ? [{ id: 'sidebar-enabling-authority', label: 'Authority' }] : []),
    { id: 'sidebar-document-info', label: 'Info' },
    ...(complianceIssues.length > 0
      ? [{ id: 'sidebar-compliance-issues', label: 'Issues', count: complianceIssues.length }]
      : []),
    ...(jenaiIssues.length > 0
      ? [{ id: 'sidebar-jenai', label: 'JenAI', count: jenaiIssues.length }]
      : []),
    ...(crossRefs.length > 0
      ? [{ id: 'sidebar-cross-refs', label: 'Cross-Refs', count: crossRefs.length }]
      : []),
    ...(incomingRefs.length > 0
      ? [{ id: 'sidebar-cited-by', label: 'Cited By', count: incomingRefs.length }]
      : []),
    ...(guidanceRefs.length > 0
      ? [{ id: 'sidebar-guidance-refs', label: 'Guidance', count: guidanceRefs.length }]
      : []),
    ...(statuteLinks.length > 0
      ? [{ id: 'sidebar-statute-links', label: 'Statutes', count: statuteLinks.length }]
      : []),
    ...(usedDefinitions.length > 0
      ? [{ id: 'sidebar-definitions-used', label: 'Definitions', count: usedDefinitions.length }]
      : []),
    ...(availableButNotUsed.length > 0
      ? [{ id: 'sidebar-definitions-available', label: 'Other Defs', count: availableButNotUsed.length }]
      : []),
  ];

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

      <RegulationSidebarWithNav sections={sections}>
        {/* Hierarchy Breadcrumbs */}
        <Card id="sidebar-hierarchy" className="p-4">
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
          <div id="sidebar-enabling-authority">
            <EnablingAuthorityCard links={enablingAuthority} state={state} />
          </div>
        )}

        {/* Document Info - Combined Summary and Metadata */}
        <Card id="sidebar-document-info" className="p-4">
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

        {/* Compliance Issues */}
        {complianceIssues && complianceIssues.length > 0 && (
          <details id="sidebar-compliance-issues" open className="[&[open]>summary]:mb-2">
            <summary className="flex items-center justify-between cursor-pointer px-1 py-1.5 hover:bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] transition-colors list-none [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-sm text-[var(--color-text)]">Compliance Issues</span>
              <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{complianceIssues.length}</span>
            </summary>
            <ComplianceIssuesSummaryList
              issues={complianceIssues}
              state={state}
            />
          </details>
        )}

        {/* JenAI Issues */}
        {jenaiIssues.length > 0 && (
          <details id="sidebar-jenai" open className="[&[open]>summary]:mb-2">
            <summary className="flex items-center justify-between cursor-pointer px-1 py-1.5 hover:bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] transition-colors list-none [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-sm text-[var(--color-text)]">JenAI Issues</span>
              <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{jenaiIssues.length}</span>
            </summary>
            <JenAIIssuesList issues={jenaiIssues} state={state} />
          </details>
        )}

        {/* Cross-References */}
        {crossRefs.length > 0 && (
          <Card id="sidebar-cross-refs" className="p-0 overflow-hidden">
            <details open className="[&[open]>summary]:mb-0">
              <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-[var(--color-neutral-50)] transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-sm text-[var(--color-text)]">Cross-References</span>
                <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{crossRefs.length}</span>
              </summary>
              <div className="px-4 pb-4">
                <CrossReferenceList
                  crossRefs={crossRefs}
                  state={state as 'nj' | 'ny'}
                  title="Cross-References"
                />
              </div>
            </details>
          </Card>
        )}

        {/* Incoming References */}
        {incomingRefs.length > 0 && (
          <Card id="sidebar-cited-by" className="p-0 overflow-hidden">
            <details open className="[&[open]>summary]:mb-0">
              <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-[var(--color-neutral-50)] transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-sm text-[var(--color-text)]">Cited By</span>
                <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{incomingRefs.length}</span>
              </summary>
              <div className="px-4 pb-4">
                <IncomingReferenceList
                  crossRefs={incomingRefs}
                  state={state as 'nj' | 'ny'}
                  title="Cited By"
                />
              </div>
            </details>
          </Card>
        )}

        {/* Guidance References */}
        {guidanceRefs.length > 0 && (
          <Card id="sidebar-guidance-refs" className="p-0 overflow-hidden">
            <details open className="[&[open]>summary]:mb-0">
              <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-[var(--color-neutral-50)] transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-sm text-[var(--color-text)]">Guidance References</span>
                <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{guidanceRefs.length}</span>
              </summary>
              <div className="px-4 pb-4">
                <GuidanceReferenceList
                  items={guidanceRefs}
                  state={state}
                />
              </div>
            </details>
          </Card>
        )}

        {/* Statute Links */}
        {statuteLinks.length > 0 && (
          <Card id="sidebar-statute-links" className="p-0 overflow-hidden">
            <details open className="[&[open]>summary]:mb-0">
              <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-[var(--color-neutral-50)] transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-sm text-[var(--color-text)]">Statute Links</span>
                <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{statuteLinks.length}</span>
              </summary>
              <div className="px-4 pb-4">
                <StatuteLinksList links={statuteLinks} state={state} />
              </div>
            </details>
          </Card>
        )}

        {/* Definitions Used */}
        {usedDefinitions.length > 0 && (
          <details id="sidebar-definitions-used" open className="[&[open]>summary]:mb-2">
            <summary className="flex items-center justify-between cursor-pointer px-1 py-1.5 hover:bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] transition-colors list-none [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-sm text-[var(--color-text)]">Definitions Used</span>
              <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{usedDefinitions.length}</span>
            </summary>
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
          </details>
        )}

        {/* Available Definitions */}
        {availableButNotUsed.length > 0 && (
          <details id="sidebar-definitions-available" className="[&[open]>summary]:mb-2">
            <summary className="flex items-center justify-between cursor-pointer px-1 py-1.5 hover:bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] transition-colors list-none [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-sm text-[var(--color-text)]">Other Available Definitions</span>
              <span className="text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5">{availableButNotUsed.length}</span>
            </summary>
            <ApplicableDefinitions
              definitions={availableButNotUsed}
              state={state}
              title="Other Available Definitions"
              description="Terms in scope but not used in this document"
              collapsed={true}
            />
          </details>
        )}
      </RegulationSidebarWithNav>
    </div>
  );
}

export default RegulationDetailSidebar;
