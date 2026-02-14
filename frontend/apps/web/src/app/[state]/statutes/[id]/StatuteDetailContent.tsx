'use client';

import { Card } from '@/components/ui/Card';
import { RegulationContent } from '@/components/regulations';

interface StatuteDetailContentProps {
  content: string;
}

export function StatuteDetailContent({
  content,
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
