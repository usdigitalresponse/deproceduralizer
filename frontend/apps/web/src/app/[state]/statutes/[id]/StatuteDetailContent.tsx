'use client';

import { Card } from '@/components/ui/Card';
import { RegulationContent } from '@/components/regulations';

interface StatuteDetailContentProps {
  content: string;
  citation: string;
}

export function StatuteDetailContent({
  content,
  citation,
}: StatuteDetailContentProps) {
  return (
    <Card className="p-6">
      <RegulationContent
        content={content}
        heading="Statute Text"
        maxHeight="none"
      />
    </Card>
  );
}

export default StatuteDetailContent;
