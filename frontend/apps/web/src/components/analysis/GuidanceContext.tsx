import { Badge } from '@/components/ui';

interface GuidanceDocumentContext {
  id: number;
  title: string;
  agency: string;
  agencyDivision: string | null;
  docType: string | null;
  canonicalRef: string | null;
  url: string | null;
  programs: string[] | null;
  policyCategory: string | null;
}

interface GuidanceContextProps {
  guidanceDocument: GuidanceDocumentContext;
}

/**
 * GuidanceContext - Shows agency badge, doc type, canonical ref, and programs for guidance documents.
 *
 * Simplified version of RegulatoryContext: no hierarchy breadcrumb (guidance docs are flat),
 * instead shows agency/division, document type, canonical reference, and program tags.
 */
export function GuidanceContext({ guidanceDocument }: GuidanceContextProps) {
  const hasPrograms = guidanceDocument.programs && guidanceDocument.programs.length > 0;
  const hasPolicyCategory = !!guidanceDocument.policyCategory;
  const hasCanonicalRef = !!guidanceDocument.canonicalRef;
  const hasDocType = !!guidanceDocument.docType;
  const hasDivision = !!guidanceDocument.agencyDivision;

  const hasMetadata = hasDocType || hasCanonicalRef || hasDivision;
  const hasTags = hasPrograms || hasPolicyCategory;

  // Don't render if there's no context to show
  if (!hasMetadata && !hasTags) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
      {/* Agency and Document Type Info */}
      {hasMetadata && (
        <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
          <Badge variant="info" className="text-xs font-medium">
            {guidanceDocument.agency}
          </Badge>

          {hasDivision && (
            <span className="text-[var(--color-text-secondary)]">
              {guidanceDocument.agencyDivision}
            </span>
          )}

          {hasDocType && (
            <Badge variant="default" className="text-xs">
              {guidanceDocument.docType}
            </Badge>
          )}

          {hasCanonicalRef && (
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              {guidanceDocument.canonicalRef}
            </span>
          )}
        </div>
      )}

      {/* Tags Row: Programs and Policy Category */}
      {hasTags && (
        <div className="flex flex-wrap items-center gap-2">
          {hasPolicyCategory && (
            <Badge variant="warning" className="text-xs">
              {guidanceDocument.policyCategory}
            </Badge>
          )}
          {hasPrograms && guidanceDocument.programs!.map((program) => (
            <Badge key={program} variant="default" className="text-xs">
              {program}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
