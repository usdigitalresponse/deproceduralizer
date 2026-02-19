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
 * - Mobile: Single column with sidebar stacked above content
 *
 * The sidebar is sticky on desktop to remain visible while scrolling through
 * the regulation text.
 */
export function RegulationDetailLayout({
  sidebar,
  content,
}: RegulationDetailLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left sidebar - sticky on desktop, offset accounts for 88px sticky header */}
      <aside className="lg:sticky lg:top-[96px] lg:self-start lg:max-h-[calc(100vh-108px)] lg:overflow-y-auto lg:pr-4">
        {sidebar}
      </aside>

      {/* Main content area */}
      <main className="min-w-0">
        {content}
      </main>
    </div>
  );
}

export default RegulationDetailLayout;
