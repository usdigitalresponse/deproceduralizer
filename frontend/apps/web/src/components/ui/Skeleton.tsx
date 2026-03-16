/**
 * Simple loading skeleton primitive with pulse animation.
 * Compose inline for any shape — no separate variants needed.
 *
 * @example
 * ```tsx
 * <Skeleton className="h-8 w-full" />
 * <Skeleton className="h-4 w-32 rounded-full" />
 * ```
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[var(--color-neutral-100)] rounded-[var(--radius-md)] ${className}`}
      aria-hidden="true"
    />
  );
}
