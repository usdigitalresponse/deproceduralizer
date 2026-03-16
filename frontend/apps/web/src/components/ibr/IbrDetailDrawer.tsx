'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import type { IbrWithContext } from '@/lib/actions/ibr';

interface IbrDetailDrawerProps {
  ibr: IbrWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: string;
}

export function IbrDetailDrawer({ ibr, open, onOpenChange, state }: IbrDetailDrawerProps) {
  if (!ibr) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" size="lg">
        <div className="flex flex-col h-full">
          <DrawerHeader>
            <div className="flex-1 min-w-0">
              <DrawerTitle>
                {ibr.incorporatedDocument || 'Unknown Standard'}
              </DrawerTitle>
              <div className="flex items-center gap-2 mt-1">
                {ibr.sourceOrganization && (
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {ibr.sourceOrganization}
                  </span>
                )}
                {ibr.version && (
                  <span className="font-mono text-xs bg-[var(--color-neutral-100)] px-1.5 py-0.5 rounded">
                    v{ibr.version}
                  </span>
                )}
              </div>
            </div>
            <DrawerClose />
          </DrawerHeader>

          <DrawerBody className="p-4 space-y-0">
            {/* Requirement Quote */}
            {ibr.requirementQuote && (
              <div className="pb-4">
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  Requirement Quote
                </h4>
                <blockquote className="text-sm text-[var(--color-text)] bg-[var(--color-neutral-50)] border-l-2 border-[var(--color-primary)] pl-3 py-2 rounded-r">
                  {ibr.requirementQuote}
                </blockquote>
              </div>
            )}

            {/* Full Context */}
            <div className="border-t border-[var(--color-neutral-200)] pt-4 mt-4">
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Context
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {ibr.context}
              </p>
            </div>

            {/* Term Matched */}
            {ibr.termMatched && (
              <div className="border-t border-[var(--color-neutral-200)] pt-4 mt-4">
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  Pattern Matched
                </h4>
                <code className="text-xs bg-[var(--color-neutral-100)] px-2 py-1 rounded font-mono">
                  {ibr.termMatched}
                </code>
              </div>
            )}

            {/* Source Regulation */}
            <div className="border-t border-[var(--color-neutral-200)] pt-4 mt-4">
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Source Regulation
              </h4>
              <div className="text-sm space-y-2">
                <p className="text-[var(--color-text)]">{ibr.regulation.title}</p>
                {ibr.regulation.hierarchyPath && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {ibr.regulation.hierarchyPath}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Link href={`/${state}/regulations/${ibr.documentId}`}>
                    <Button variant="secondary" size="sm">
                      View Regulation
                    </Button>
                  </Link>
                  {ibr.url && (
                    <a
                      href={ibr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                    >
                      Original source <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </DrawerBody>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
