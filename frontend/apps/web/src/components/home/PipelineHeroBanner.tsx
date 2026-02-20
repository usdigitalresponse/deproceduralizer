import Link from 'next/link';
import { FlaskConical, ArrowRight } from 'lucide-react';

interface PipelineHeroBannerProps {
  /** Default state for the Pipeline link (e.g., 'ny') */
  state: string;
}

export function PipelineHeroBanner({ state }: PipelineHeroBannerProps) {
  return (
    <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] rounded-[var(--radius-md)] p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-white/15 rounded-[var(--radius-md)]">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Research Pipeline</h2>
            <p className="text-sm text-white/80">
              3-tier AI analysis of compliance issues — review findings, severity scores, and recommendations
            </p>
          </div>
        </div>
        <Link
          href={`/${state}/pipeline`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[var(--color-primary)] rounded-[var(--radius-md)] text-sm font-semibold hover:bg-white/90 transition-colors shrink-0"
        >
          Explore Pipeline
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
