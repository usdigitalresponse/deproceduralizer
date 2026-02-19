'use client';

import { useState, FormEvent } from 'react';
import { validatePassword } from '@/lib/actions/auth';
import { Button } from '@/components/ui';

/**
 * Full-page password authentication form.
 *
 * Validates password against SITE_PASSWORD env var. On success, stores
 * authentication state in localStorage and reloads to show main app.
 *
 * Design follows "modern civic" aesthetic - professional, trustworthy,
 * accessible, with no gratuitous decoration.
 */
export function PasswordForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await validatePassword(password);

      if (result.success) {
        // Store auth state in localStorage
        localStorage.setItem('isAuthenticated', 'true');
        // Reload to trigger AuthGuard re-render
        window.location.href = '/';
      } else {
        setError(result.error || 'Authentication failed');
        setPassword('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Password validation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-primary-faint)] px-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--color-neutral-200)] overflow-hidden">
          {/* Header */}
          <div className="bg-[var(--color-primary)] px-6 py-8 text-center">
            <div className="flex justify-center mb-4">
              {/* Document icon matching Header.tsx */}
              <div className="flex items-center justify-center w-12 h-12 bg-white rounded-[var(--radius-md)]">
                <svg
                  className="w-7 h-7 text-[var(--color-primary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              Deproceduralizer
            </h1>
            <p className="text-sm text-[var(--color-primary-weaker)] font-medium">
              Regulatory analysis and review tool
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                Authentication Required
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Please enter the password to access this site.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="px-4 py-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)] text-sm text-[var(--color-danger)]"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--color-text)] mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                required
                className="
                  w-full px-4 py-2.5
                  text-base text-[var(--color-text)]
                  bg-[var(--color-surface)]
                  border border-[var(--color-neutral-300)]
                  rounded-[var(--radius-md)]
                  transition-colors duration-[var(--duration-fast)]
                  hover:border-[var(--color-neutral-400)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                placeholder="Enter password"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !password.trim()}
              className="w-full"
            >
              {isSubmitting ? 'Authenticating...' : 'Continue'}
            </Button>
          </form>
        </div>

        {/* Footer Notice */}
        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          This site is password-protected. Your session will persist in this browser.
        </p>
      </div>
    </div>
  );
}
