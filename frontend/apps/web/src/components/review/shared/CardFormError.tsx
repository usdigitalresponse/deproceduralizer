'use client';

interface CardFormErrorProps {
  error: string | null;
}

/**
 * Displays form error message in card forms.
 *
 * @example
 * <CardFormError error={error} />
 */
export function CardFormError({ error }: CardFormErrorProps) {
  if (!error) return null;

  return (
    <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
      {error}
    </div>
  );
}

export default CardFormError;
