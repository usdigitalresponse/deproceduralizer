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
 * Auth is automatically bypassed in development and Vercel preview environments.
 * These values are compile-time constants inlined by Next.js — cannot be manipulated at runtime.
 *
 * Set window.__TEST_AUTH_FLOW__ = true (via Playwright addInitScript) to disable
 * the bypass and test the actual login flow.
 */
function isAuthBypassed(): boolean {
  if (typeof window !== 'undefined' && (window as any).__TEST_AUTH_FLOW__) {
    return false;
  }
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return true;
  return false;
}

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

  // Skip auth in dev/preview environments (unless testing auth flow)
  if (isAuthBypassed()) {
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
