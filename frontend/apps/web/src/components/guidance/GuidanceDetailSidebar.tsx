'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tag } from '@/components/ui/Tag';
import { EnhancedRegulationSummary } from '@/components/regulations/EnhancedRegulationSummary';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { PolicyCategoryBadge } from './PolicyCategoryBadge';
import { LinkedCitationList } from './LinkedCitationList';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { KeywordTags } from '@/components/ui/KeywordTags';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { TagBadge } from '@/components/tags/TagBadge';
import { ClickableTag } from '@/components/tags/ClickableTag';
import type { GuidanceDocumentDetail, ResolvedRegulationCitation } from '@/lib/actions/guidance-documents';

interface GuidanceDetailSidebarProps {
  doc: GuidanceDocumentDetail;
  state?: string;
  resolvedCitations?: ResolvedRegulationCitation[];
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

function DocumentDateTimeline({ doc }: { doc: GuidanceDocumentDetail }) {
  const dates = [
    doc.datePublished ? { label: 'Published', date: doc.datePublished } : null,
    doc.dateEffective ? { label: 'Effective', date: doc.dateEffective } : null,
    doc.dateRevised ? { label: 'Revised', date: doc.dateRevised } : null,
    doc.dateExpires ? { label: 'Expires', date: doc.dateExpires } : null,
  ].filter((d): d is { label: string; date: string } => d !== null);

  if (dates.length === 0) return null;

  // Fall back to plain metadata rows for single date
  if (dates.length === 1) {
    return <MetadataRow label={dates[0].label}>{dates[0].date}</MetadataRow>;
  }

  return (
    <div className="py-2 border-b border-[var(--color-neutral-100)]">
      <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-2">Timeline</span>
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[var(--color-neutral-200)]" />
        {dates.map((d, i) => (
          <div key={d.label} className={`relative flex items-start gap-2 ${i < dates.length - 1 ? 'pb-3' : ''}`}>
            <div
              className={`absolute left-[-13px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                i === dates.length - 1
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-neutral-300)]'
              }`}
            />
            <div>
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">{d.label}</span>
              <span className="text-xs text-[var(--color-text)] block">{d.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const directionVariant: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  public: 'success',
  government: 'info',
  both: 'warning',
};

const expertiseVariant: Record<string, 'success' | 'warning' | 'default'> = {
  lay: 'success',
  specialized: 'warning',
};

export function GuidanceDetailSidebar({ doc, state, resolvedCitations }: GuidanceDetailSidebarProps) {
  const hasSummaryMetadata = doc.summary || doc.sectionType || doc.keywords?.length || doc.appliesTo?.length || doc.hasForm || doc.hasIbr;
  const hasAudience = doc.targetAudience?.length || doc.audienceDirection || doc.audienceExpertise || doc.audienceExplanation;

  return (
    <>
      {hasSummaryMetadata && (
        <EnhancedRegulationSummary
          summary={doc.summary}
          sectionType={doc.sectionType}
          keywords={doc.keywords}
          appliesTo={doc.appliesTo}
          hasForm={doc.hasForm}
          hasIbr={doc.hasIbr}
          showHeading
        />
      )}
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
          <PolicyCategoryBadge category={doc.policyCategory} clickable />
        </MetadataRow>
        <MetadataRow label="Status">
          <GuidanceStatusBadge status={doc.status} />
        </MetadataRow>

        {/* Dates — timeline if 2+ dates, plain rows otherwise */}
        <DocumentDateTimeline doc={doc} />

        {/* Sender */}
        {doc.senderName && (
          <MetadataRow label="Sender">
            {doc.senderName}{doc.senderTitle ? `, ${doc.senderTitle}` : ''}
          </MetadataRow>
        )}

        {/* Compliance issues */}
        {doc.complianceIssueCount > 0 && state && (
          <MetadataRow label="Compliance Issues">
            <Link
              href={`/${state}/pipeline?source=guidance`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Badge variant="warning">{doc.complianceIssueCount}</Badge>
            </Link>
          </MetadataRow>
        )}

        {/* Audience — integrated section */}
        {hasAudience && (
          <div className="pt-3 mt-3 border-t border-[var(--color-neutral-200)]">
            <span className="text-xs font-semibold text-[var(--color-text)] block mb-2">Audience</span>
            {(doc.audienceDirection || doc.audienceExpertise) && (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {doc.audienceDirection && (
                  <ClickableTag field="audience_direction" value={doc.audienceDirection}>
                    <Badge variant={directionVariant[doc.audienceDirection] ?? 'default'}>
                      {doc.audienceDirection}
                    </Badge>
                  </ClickableTag>
                )}
                {doc.audienceExpertise && (
                  <ClickableTag field="audience_expertise" value={doc.audienceExpertise}>
                    <Badge variant={expertiseVariant[doc.audienceExpertise] ?? 'default'}>
                      {doc.audienceExpertise}
                    </Badge>
                  </ClickableTag>
                )}
              </div>
            )}
            {doc.targetAudience && doc.targetAudience.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {doc.targetAudience.map((audience) => (
                  <ClickableTag key={audience} field="target_audience" value={audience}>
                    <Tag variant="primary" size="sm">
                      {audience}
                    </Tag>
                  </ClickableTag>
                ))}
              </div>
            )}
            {doc.audienceExplanation && (
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                {doc.audienceExplanation}
              </p>
            )}
          </div>
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
      </div>
    </Card>
    </>
  );
}
