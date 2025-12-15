import { notFound } from 'next/navigation';
import { isValidState, type StateCode } from '@/types/state';
import { StateContextBar } from '@/components/layout/StateContextBar';

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
  if (!isValidState(state)) {
    notFound();
  }

  return (
    <>
      <StateContextBar state={state as StateCode} />
      {children}
    </>
  );
}

/**
 * Generate static params for both states
 */
export function generateStaticParams() {
  return [{ state: 'ny' }, { state: 'nj' }];
}
