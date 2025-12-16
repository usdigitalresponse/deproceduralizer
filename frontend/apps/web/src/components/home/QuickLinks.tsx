'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { FolderTree, ClipboardCheck, Table, ArrowRight } from 'lucide-react';

interface QuickLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function QuickLink({ href, icon, title, description }: QuickLinkProps) {
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
  state: 'ny' | 'nj';
}

export function QuickLinks({ state }: QuickLinksProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <QuickLink
        href={`/${state}/browse`}
        icon={<FolderTree className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Browse Hierarchy"
        description="Explore regulations in a tree view organized by titles, parts, and sections"
      />
      <QuickLink
        href={`/${state}/review?status=unreviewed`}
        icon={<ClipboardCheck className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Review Queue"
        description="Review and triage flagged regulations that need attention"
      />
      <QuickLink
        href={`/${state}`}
        icon={<Table className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />}
        title="Table View"
        description="View all regulations in a sortable, filterable data table"
      />
    </div>
  );
}

export default QuickLinks;
