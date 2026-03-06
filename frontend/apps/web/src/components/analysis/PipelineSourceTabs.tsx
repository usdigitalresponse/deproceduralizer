'use client';

import { useQueryState } from 'nuqs';
import { BookOpen, ScrollText } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import { pipelineSourceParser } from '@/lib/url/parsers';
import type { PipelineSourceValue } from '@/lib/constants/values';

const SOURCE_OPTIONS: SegmentedControlOption<PipelineSourceValue>[] = [
  { value: 'regulations', label: 'Regulations', icon: ScrollText },
  { value: 'guidance', label: 'Guidance', icon: BookOpen },
];

export function PipelineSourceTabs() {
  const [source, setSource] = useQueryState('source', pipelineSourceParser.withOptions({ shallow: false }));

  const handleSourceChange = (value: PipelineSourceValue) => {
    setSource(value);
  };

  return (
    <SegmentedControl
      options={SOURCE_OPTIONS}
      value={source}
      onChange={handleSourceChange}
      variant="filled"
    />
  );
}
