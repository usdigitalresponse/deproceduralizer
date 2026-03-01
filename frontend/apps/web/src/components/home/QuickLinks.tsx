'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FolderTree, ClipboardCheck, Table, BarChart3, ArrowRight } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';

const DefinitionIcon = getEntityIcon('definition');
import type { DashboardStats } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@/types/state';

interface QuickLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: number;
}

function QuickLink({ href, icon, title, description, badge }: QuickLinkProps) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full transition-all duration-[var(--duration-normal)] hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary-weak)]">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-neutral-100)] group-hover:bg-[var(--color-primary-weaker)] transition-colors">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                {title}
              </h3>
              {badge !== undefined && badge > 0 && (
                <Badge variant="danger">{badge}</Badge>
              )}
              <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {description}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

interface QuickLinksProps {
  jurisdiction: JurisdictionCode;
  stats?: DashboardStats;
}

export function QuickLinks({ jurisdiction, stats }: QuickLinksProps) {
  const unreviewedCount = stats
    ? stats.unreviewedFlags + (stats.complianceIssues?.unreviewed ?? 0)
    : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <QuickLink
        href={`/${jurisdiction}/browse`}
        icon={<FolderTree className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Browse Hierarchy"
        description="Explore regulations in a tree view organized by titles, parts, and sections"
      />
      <QuickLink
        href={`/${jurisdiction}/review?reviewStatus=unreviewed`}
        icon={<ClipboardCheck className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Review Queue"
        description="Review and triage flagged regulations that need attention"
        badge={unreviewedCount}
      />
      <QuickLink
        href={`/${jurisdiction}/analytics`}
        icon={<BarChart3 className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Analytics"
        description="View charts, patterns, and insights across all regulatory data"
      />
      <QuickLink
        href={`/${jurisdiction}/definitions`}
        icon={<DefinitionIcon className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Definitions Glossary"
        description="Browse and search regulatory definitions extracted from regulations"
      />
      <QuickLink
        href={`/${jurisdiction}`}
        icon={<Table className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Table View"
        description="View all regulations in a sortable, filterable data table"
      />
    </div>
  );
}

export default QuickLinks;
