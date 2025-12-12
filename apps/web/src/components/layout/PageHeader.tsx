'use client';

import { ReactNode } from 'react';
import { Container } from './Container';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`
        bg-[var(--color-surface)]
        border-b border-[var(--color-neutral-200)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <Container size="2xl">
        <div className="py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text)]">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-[var(--color-text-secondary)]">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-3">
                {actions}
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

export default PageHeader;
