'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui';

export function PrintButton() {
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() => window.print()}
    >
      <Printer className="w-4 h-4 mr-2" />
      Print
    </Button>
  );
}
