'use client';

import { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PasswordForm } from './PasswordForm';

interface AuthGuardProps {
  children: ReactNode;
}

/** Routes that bypass the auth guard (e.g. share-token validation) */
const PUBLIC_ROUTES = ['/auth'];

/**
 * Client-side authentication guard.
 *
 * Checks localStorage for authentication state. If authenticated,
 * renders children. Otherwise, shows the password form.
 *
 * Routes in PUBLIC_ROUTES are always rendered (e.g. /auth handles
 * one-time share token validation before the user is authenticated).
 *
 * This is intentionally a lightweight client-side check - it can be
 * bypassed via devtools, but that's acceptable per requirements.
 * Server-side validation happens in the auth actions.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authStatus === 'true');
  }, []);

  // Always render public routes (share-token validation needs to run)
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return <>{children}</>;
  }

  // Show nothing while checking auth status (prevents flash of password form)
  if (isAuthenticated === null) {
    return null;
  }

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return <PasswordForm />;
  }

  // Show main app if authenticated
  return <>{children}</>;
}
