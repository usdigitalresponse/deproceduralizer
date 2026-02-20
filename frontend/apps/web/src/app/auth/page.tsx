'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { validateShareToken } from '@/lib/actions/auth';
import { PasswordForm } from '@/components/auth/PasswordForm';
import { toast } from 'sonner';

/**
 * Share token authentication page.
 *
 * Validates one-time share tokens from URL query parameter.
 * On success: authenticates user and redirects to homepage.
 * On failure: shows error and falls back to password form.
 */
export default function AuthPage() {
  const searchParams = useSearchParams();
  const [isValidating, setIsValidating] = useState(true);
  const [validationFailed, setValidationFailed] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');

    // No token provided - show password form
    if (!token) {
      setIsValidating(false);
      setValidationFailed(true);
      return;
    }

    // Validate the token
    const validateToken = async () => {
      try {
        const result = await validateShareToken(token);

        if (result.success) {
          // Set auth state in localStorage
          localStorage.setItem('isAuthenticated', 'true');

          // Show success toast with detailed explanation
          toast.info(
            <div className="space-y-2">
              <p className="font-medium">Success! You logged in with a one-time share link.</p>
              <p className="text-sm">
                You now have access to this site. Note: If you clear your browser data or use a different browser, you'll need the password to log in again.
              </p>
              <p className="text-sm">
                This share link has been used and will no longer work. If you'd like to share access with someone else, you'll need to generate a new share link.
              </p>
            </div>,
            {
              duration: 8000,
            }
          );

          // Full page navigation so AuthGuard re-checks localStorage
          window.location.href = '/';
        } else {
          // Token validation failed
          setIsValidating(false);
          setValidationFailed(true);
          toast.error(result.error || 'Invalid or already used link');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValidating(false);
        setValidationFailed(true);
        toast.error('An error occurred while validating the link');
      }
    };

    validateToken();
  }, [searchParams]);

  // Show loading state while validating
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-primary-faint)]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Validating your share link...
          </p>
        </div>
      </div>
    );
  }

  // Show password form if validation failed
  if (validationFailed) {
    return (
      <div>
        <PasswordForm />
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="px-4 py-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)] shadow-lg">
            <p className="text-sm text-[var(--color-danger)] font-medium">
              This link is invalid or has already been used.
            </p>
            <p className="text-sm text-[var(--color-danger)] mt-1">
              Please enter the password below to continue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Should never reach here, but return null just in case
  return null;
}
