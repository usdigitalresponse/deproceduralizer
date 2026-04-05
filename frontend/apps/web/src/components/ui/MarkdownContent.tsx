'use client';

import Markdown from 'react-markdown';

interface MarkdownContentProps {
  children: string;
  className?: string;
}

const PROSE_CLASSES = 'prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0';

export function MarkdownContent({ children, className = 'text-sm text-[var(--color-text-secondary)]' }: MarkdownContentProps) {
  return (
    <div className={`${className} ${PROSE_CLASSES}`}>
      <Markdown>{children}</Markdown>
    </div>
  );
}
