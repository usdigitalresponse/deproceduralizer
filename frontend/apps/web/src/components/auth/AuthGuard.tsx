'use client';

import { useState, useEffect, ReactNode } from 'react';
import { PasswordForm } from './PasswordForm';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Client-side authentication guard.
 *
 * Checks localStorage for authentication state. If authenticated,
 * renders children. Otherwise, shows the password form.
 *
 * This is intentionally a lightweight client-side check - it can be
 * bypassed via devtools, but that's acceptable per requirements.
 * Server-side validation happens in the auth actions.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check localStorage on mount
    const authStatus = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authStatus === 'true');
  }, []);

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
