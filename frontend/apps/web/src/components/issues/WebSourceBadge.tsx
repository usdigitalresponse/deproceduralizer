'use client';

import { HTMLAttributes } from 'react';

export type WebSourceType = 'government' | 'academic' | 'journalism' | 'advocacy';

interface WebSourceBadgeProps extends HTMLAttributes<HTMLAnchorElement> {
  url: string;
  title?: string;
  sourceType?: WebSourceType;
  showUrl?: boolean;
  maxUrlLength?: number;
}

const SOURCE_TYPE_STYLES: Record<WebSourceType, string> = {
  government: 'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info)]/20',
  academic: 'bg-purple-50 text-purple-700 border-purple-200',
  journalism: 'bg-amber-50 text-amber-700 border-amber-200',
  advocacy: 'bg-rose-50 text-rose-700 border-rose-200',
};

const SOURCE_TYPE_LABELS: Record<WebSourceType, string> = {
  government: 'Gov',
  academic: 'Academic',
  journalism: 'News',
  advocacy: 'Advocacy',
};

const SOURCE_TYPE_ICONS: Record<WebSourceType, string> = {
  government: '🏛️',
  academic: '🎓',
  journalism: '📰',
  advocacy: '📢',
};

function truncateUrl(url: string, maxLength: number): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname;

    if (domain.length + path.length <= maxLength) {
      return domain + path;
    }

    // Truncate path if needed
    const availablePathLength = maxLength - domain.length - 3; // 3 for "..."
    if (availablePathLength > 0) {
      return domain + path.substring(0, availablePathLength) + '...';
    }

    // Just return truncated domain
    if (domain.length > maxLength) {
      return domain.substring(0, maxLength - 3) + '...';
    }

    return domain;
  } catch {
    // If URL parsing fails, just truncate the string
    if (url.length > maxLength) {
      return url.substring(0, maxLength - 3) + '...';
    }
    return url;
  }
}

export function WebSourceBadge({
  url,
  title,
  sourceType,
  showUrl = true,
  maxUrlLength = 40,
  className = '',
  ...props
}: WebSourceBadgeProps) {
  const displayText = title || (showUrl ? truncateUrl(url, maxUrlLength) : 'View source');
  const typeStyles = sourceType ? SOURCE_TYPE_STYLES[sourceType] : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] border-[var(--color-neutral-200)]';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center gap-1.5
        px-2 py-1
        text-xs font-medium
        rounded-[var(--radius-sm)]
        border
        transition-all duration-150
        hover:opacity-80
        ${typeStyles}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      title={url}
      {...props}
    >
      {/* Source type indicator */}
      {sourceType && (
        <span className="flex-shrink-0" aria-label={SOURCE_TYPE_LABELS[sourceType]}>
          {SOURCE_TYPE_ICONS[sourceType]}
        </span>
      )}

      {/* Display text */}
      <span className="truncate max-w-[200px]">{displayText}</span>

      {/* External link icon */}
      <svg
        className="flex-shrink-0 w-3 h-3 opacity-60"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}

// Compact variant that just shows an icon with tooltip
interface WebSourceIconProps extends HTMLAttributes<HTMLAnchorElement> {
  url: string;
  sourceType?: WebSourceType;
}

export function WebSourceIcon({
  url,
  sourceType,
  className = '',
  ...props
}: WebSourceIconProps) {
  const typeStyles = sourceType
    ? SOURCE_TYPE_STYLES[sourceType]
    : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center justify-center
        w-6 h-6
        rounded-full
        transition-all duration-150
        hover:scale-110
        ${typeStyles}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      title={url}
      {...props}
    >
      {sourceType ? (
        <span className="text-xs">{SOURCE_TYPE_ICONS[sourceType]}</span>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      )}
    </a>
  );
}

export default WebSourceBadge;
