import Link from 'next/link';
import { FlaskConical, ArrowRight } from 'lucide-react';

interface PipelineHeroBannerProps {
  /** Default state for the Pipeline link (e.g., 'nj') */
  state: string;
}

export function PipelineHeroBanner({ state }: PipelineHeroBannerProps) {
  return (
    <div className="bg-[var(--color-primary-weaker)] border border-[var(--color-primary)]/20 rounded-[var(--radius-md)] p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-[var(--color-primary)] rounded-[var(--radius-md)]">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Research Pipeline</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              3-tier AI analysis of compliance issues — review findings, severity scores, and recommendations
            </p>
          </div>
        </div>
        <Link
          href={`/${state}/pipeline`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--color-primary-strong)] transition-colors"
        >
          Explore Pipeline
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
