'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { PolicyCategoryBadge } from './PolicyCategoryBadge';
import { LinkedCitationList } from './LinkedCitationList';
import type { GuidanceDocumentDetail, ResolvedRegulationCitation } from '@/lib/actions/guidance-documents';

interface GuidanceDetailSidebarProps {
  doc: GuidanceDocumentDetail;
  state?: string;
  resolvedCitations?: ResolvedRegulationCitation[];
  hasComplianceCard?: boolean;
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-2 border-b border-[var(--color-neutral-100)] last:border-b-0">
      <span className="text-xs font-medium text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="text-xs text-[var(--color-text)] text-right">{children}</span>
    </div>
  );
}

function ListSection({ label, items }: { label: string; items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="py-2 border-b border-[var(--color-neutral-100)] last:border-b-0">
      <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">{label}</span>
      <ul className="space-y-0.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-[var(--color-text)]">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function GuidanceDetailSidebar({ doc, state, resolvedCitations, hasComplianceCard }: GuidanceDetailSidebarProps) {
  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Document Metadata</CardTitle>
      </CardHeader>
      <div className="pt-4">
        <MetadataRow label="Agency">{doc.agency}</MetadataRow>
        {doc.agencyDivision && (
          <MetadataRow label="Division">{doc.agencyDivision}</MetadataRow>
        )}
        {doc.docType && (
          <MetadataRow label="Doc Type">{doc.docType}</MetadataRow>
        )}
        {doc.domain && (
          <MetadataRow label="Domain">{doc.domain}</MetadataRow>
        )}
        <MetadataRow label="Category">
          <PolicyCategoryBadge category={doc.policyCategory} />
        </MetadataRow>
        <MetadataRow label="Status">
          <GuidanceStatusBadge status={doc.status} />
        </MetadataRow>

        {/* Dates */}
        {doc.datePublished && (
          <MetadataRow label="Published">{doc.datePublished}</MetadataRow>
        )}
        {doc.dateEffective && (
          <MetadataRow label="Effective">{doc.dateEffective}</MetadataRow>
        )}
        {doc.dateRevised && (
          <MetadataRow label="Revised">{doc.dateRevised}</MetadataRow>
        )}
        {doc.dateExpires && (
          <MetadataRow label="Expires">{doc.dateExpires}</MetadataRow>
        )}

        {/* Sender */}
        {doc.senderName && (
          <MetadataRow label="Sender">
            {doc.senderName}{doc.senderTitle ? `, ${doc.senderTitle}` : ''}
          </MetadataRow>
        )}

        {/* Programs */}
        <ListSection label="Programs" items={doc.programs} />

        {/* Citations */}
        {resolvedCitations && resolvedCitations.length > 0 && state ? (
          <LinkedCitationList citations={resolvedCitations} state={state} />
        ) : (
          <ListSection label="Cited Regulations" items={doc.citesRegulations} />
        )}
        <ListSection label="Cited Federal Statutes" items={doc.citesFederal} />
        <ListSection label="Cited Documents" items={doc.citesDocuments} />

        {/* Compliance issues */}
        {doc.complianceIssueCount > 0 && state && (
          <MetadataRow label="Compliance Issues">
            {hasComplianceCard ? (
              <a
                href="#compliance-analysis"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Badge variant="warning">{doc.complianceIssueCount}</Badge>
              </a>
            ) : (
              <Link
                href={`/${state}/pipeline?source=guidance`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Badge variant="warning">{doc.complianceIssueCount}</Badge>
              </Link>
            )}
          </MetadataRow>
        )}
      </div>
    </Card>
  );
}
