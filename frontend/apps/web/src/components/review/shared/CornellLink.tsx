import { ExternalLink } from 'lucide-react';

interface CornellLinkProps {
  url: string | null;
  className?: string;
}

/**
 * External link to view the regulation on Cornell Law website
 */
export function CornellLink({ url, className = '' }: CornellLinkProps) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline ${className}`}
    >
      <ExternalLink className="w-3 h-3" />
      View Original
    </a>
  );
}

export default CornellLink;
