import { ReactNode } from 'react';

interface RegulationDetailLayoutProps {
  /** Content for the left sidebar (navigation, metadata, analysis) */
  sidebar: ReactNode;
  /** Content for the main area (regulation text + notes) */
  content: ReactNode;
}

/**
 * Two-column layout for the regulation detail page.
 *
 * - Desktop (lg+): Left sidebar (380px) + Right main content (flex-1)
 * - Mobile: Sidebar collapsed behind a <details> toggle above content
 *
 * The sidebar is sticky on desktop to remain visible while scrolling through
 * the regulation text. On mobile, it's inside a native <details> element
 * (no JS required) so users can skip past it to reach the regulation text.
 */
export function RegulationDetailLayout({
  sidebar,
  content,
}: RegulationDetailLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left sidebar - sticky on desktop, collapsible on mobile */}
      <aside className="lg:sticky lg:top-[96px] lg:self-start lg:max-h-[calc(100vh-108px)] lg:overflow-y-auto lg:pr-4">
        {/* Mobile: collapsible details element */}
        <details className="lg:hidden group/sidebar">
          <summary className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] cursor-pointer text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-neutral-50)] group-open/sidebar:rounded-b-none">
            Navigation & Analysis
            <svg className="w-4 h-4 text-[var(--color-text-muted)] transition-transform group-open/sidebar:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="border border-t-0 border-[var(--color-neutral-200)] rounded-b-[var(--radius-md)] p-4">
            {sidebar}
          </div>
        </details>
        {/* Desktop: render sidebar directly */}
        <div className="hidden lg:block">
          {sidebar}
        </div>
      </aside>

      {/* Main content area */}
      <main className="min-w-0">
        {content}
      </main>
    </div>
  );
}

export default RegulationDetailLayout;
