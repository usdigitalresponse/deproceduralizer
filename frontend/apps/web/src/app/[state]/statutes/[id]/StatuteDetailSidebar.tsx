import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight, Folder } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';

const StatuteIcon = getEntityIcon('statute');
import { LINK_TYPE_LABELS, MATCH_STATUS_LABELS } from '@/lib/constants/values';
import { STATUTE_HIERARCHY_LEVEL_LABELS } from '@/lib/constants/hierarchy';
import { StatuteSidebarWithNav } from './StatuteSidebarWithNav';
import type { SectionConfig } from '@/hooks/useActiveSection';
import type { StatuteWithLinks, StatuteAncestor, StatuteHierarchyNode } from '@deproceduralizer/database';

interface StatuteDetailSidebarProps {
  statute: StatuteWithLinks;
  state: string;
  backUrl: string;
  ancestors: StatuteAncestor[];
  childStatutes: StatuteHierarchyNode[];
}

export function StatuteDetailSidebar({
  statute,
  state,
  backUrl,
  ancestors,
  childStatutes,
}: StatuteDetailSidebarProps) {
  // Group regulation links by type
  const linksByType = statute.regulationLinks.reduce<Record<string, typeof statute.regulationLinks>>((acc, link) => {
    const type = link.linkType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(link);
    return acc;
  }, {});

  // Order: enabling_authority first, then requirement, definition, reference
  const typeOrder = ['enabling_authority', 'requirement', 'definition', 'reference'];
  const orderedTypes = typeOrder.filter(t => linksByType[t]);

  const sections: SectionConfig[] = [
    ...(ancestors.length > 0 ? [{ id: 'sidebar-hierarchy', label: 'Hierarchy' }] : []),
    { id: 'sidebar-statute-info', label: 'Info' },
    ...(statute.regulationLinks.length > 0
      ? [{ id: 'sidebar-linked-regs', label: 'Linked Regs', count: statute.regulationLinks.length }]
      : []),
    ...(childStatutes.length > 0
      ? [{ id: 'sidebar-children', label: 'Children', count: childStatutes.length }]
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
          Back to Statutes
        </Button>
      </Link>

      <StatuteSidebarWithNav sections={sections}>
        {/* Hierarchy Breadcrumbs */}
        {ancestors.length > 0 && (
          <Card id="sidebar-hierarchy" className="p-4">
            <h2 className="font-semibold text-[var(--color-primary)] mb-3 text-sm">Hierarchy</h2>
            <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Statute hierarchy breadcrumb">
              <Link
                href={`/${state}/statutes`}
                className="px-2 py-1 rounded text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:bg-[var(--color-neutral-100)] transition-colors duration-[var(--duration-fast)]"
              >
                Statutes
              </Link>
              {ancestors.map((ancestor) => (
                <span key={ancestor.id} className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <Link
                    href={`/${state}/statutes/${ancestor.id}`}
                    className="px-2 py-1 rounded text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:bg-[var(--color-neutral-100)] transition-colors duration-[var(--duration-fast)] max-w-[250px] truncate inline-block"
                    title={ancestor.title}
                  >
                    {ancestor.citation}
                  </Link>
                </span>
              ))}
              <span className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span className="px-2 py-1 text-[var(--color-text)] font-medium max-w-[250px] truncate inline-block" title={statute.title}>
                  {statute.citation}
                </span>
              </span>
            </nav>
          </Card>
        )}

        {/* Statute Info */}
        <Card id="sidebar-statute-info" className="p-4">
          <h2 className="font-semibold text-[var(--color-text)] mb-3 text-sm">Statute Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <StatuteIcon className="w-4 h-4 text-violet-600" />
              <span className="font-mono text-[var(--color-primary)]">{statute.citation}</span>
            </div>
            {statute.hierarchyLevel && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-muted)]">Level:</span>
                <Badge variant="default" className="text-xs">
                  {STATUTE_HIERARCHY_LEVEL_LABELS[statute.hierarchyLevel] || statute.hierarchyLevel}
                </Badge>
              </div>
            )}
            {/* NJ-specific metadata */}
            {statute.njsaTitle && (
              <div className="text-[var(--color-text-secondary)]">
                NJSA Title {statute.njsaTitle}
                {statute.njsaTitleName && ` — ${statute.njsaTitleName}`}
              </div>
            )}
            {/* NY-specific metadata */}
            {statute.nyclsLawName && (
              <div className="text-[var(--color-text-secondary)]">
                {statute.nyclsLawName}
                {statute.nyclsArticleName && ` — ${statute.nyclsArticleName}`}
              </div>
            )}
          </div>
        </Card>

        {/* Linked Regulations */}
        {statute.regulationLinks.length > 0 && (
          <Card id="sidebar-linked-regs" className="p-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-3 text-sm">
              Linked Regulations ({statute.regulationLinks.length})
            </h2>
            <div className="space-y-4">
              {orderedTypes.map(type => (
                <div key={type}>
                  <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                    {LINK_TYPE_LABELS[type] || type} ({linksByType[type].length})
                  </h3>
                  <div className="space-y-1.5">
                    {linksByType[type].map(link => (
                      <Link
                        key={link.linkId}
                        href={`/${state}/regulations/${link.regulationId}`}
                        className="block p-2 rounded hover:bg-[var(--color-neutral-100)] transition-colors duration-[var(--duration-fast)]"
                      >
                        <div className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] truncate">
                          {link.regulation.title || link.regulation.citation || `Regulation #${link.regulationId}`}
                        </div>
                        {link.regulation.citation && (
                          <div className="text-xs text-[var(--color-text-muted)] font-mono">
                            {link.regulation.citation}
                          </div>
                        )}
                        {link.matchStatus !== 'matched' && (
                          <Badge
                            variant={link.matchStatus === 'corrected' ? 'info' : link.matchStatus === 'obsolete' ? 'danger' : 'warning'}
                            className="text-[10px] mt-1"
                          >
                            {MATCH_STATUS_LABELS[link.matchStatus] || link.matchStatus}
                          </Badge>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Children (sub-statutes) */}
        {childStatutes.length > 0 && (
          <Card id="sidebar-children" className="p-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-3 text-sm">
              Child Statutes ({childStatutes.length})
            </h2>
            <div className="space-y-1">
              {childStatutes.map(child => (
                <Link
                  key={child.id}
                  href={`/${state}/statutes/${child.id}`}
                  className="flex items-center gap-2 p-2 rounded hover:bg-[var(--color-neutral-100)] transition-colors duration-[var(--duration-fast)] text-sm"
                >
                  {child.childCount > 0 ? (
                    <Folder className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  ) : (
                    <StatuteIcon className="w-4 h-4 text-violet-600 shrink-0" />
                  )}
                  <span className="text-[var(--color-link)] truncate">{child.citation}</span>
                  {child.linkedRegulationCount > 0 && (
                    <Badge variant="info" className="text-[10px] ml-auto shrink-0">
                      {child.linkedRegulationCount} regs
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </Card>
        )}
      </StatuteSidebarWithNav>
    </div>
  );
}

export default StatuteDetailSidebar;
