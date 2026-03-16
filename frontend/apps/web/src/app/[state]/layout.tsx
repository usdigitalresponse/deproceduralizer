import { notFound } from 'next/navigation';
import { isValidJurisdiction, type JurisdictionCode } from '@/types/state';
import { StateContextBar } from '@/components/layout/StateContextBar';
import { TagDrawerProvider } from '@/components/tags/useTagDrawer';
import { TagDrawer } from '@/components/tags/TagDrawer';

interface StateLayoutProps {
  children: React.ReactNode;
  params: Promise<{ state: string }>;
}

/**
 * Layout for state-specific routes.
 * Validates the state parameter and renders the StateContextBar.
 */
export default async function StateLayout({ children, params }: StateLayoutProps) {
  const { state } = await params;

  // Validate state parameter
  if (!isValidJurisdiction(state)) {
    notFound();
  }

  return (
    <TagDrawerProvider>
      <StateContextBar jurisdiction={state as JurisdictionCode} />
      {children}
      <TagDrawer />
    </TagDrawerProvider>
  );
}

/**
 * Generate static params for both states
 */
export function generateStaticParams() {
  return [{ state: 'ny' }, { state: 'nj' }, { state: 'nyc' }];
}
