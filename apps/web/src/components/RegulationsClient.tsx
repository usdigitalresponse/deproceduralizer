'use client';

import { useState } from 'react';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import { ParsedRegulation } from '@/types/regulation';

interface RegulationsClientProps {
  initialData: ParsedRegulation[];
}

export default function RegulationsClient({ initialData }: RegulationsClientProps) {
  const [selectedRegulation, setSelectedRegulation] = useState<ParsedRegulation | null>(null);
  const [data, setData] = useState(initialData);

  const handleFlagUpdated = (updatedFlag: {
    id: number;
    review_status?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    reviewer_notes?: string;
    priority?: number;
    impact_type?: string;
  }) => {
    setData(prevData =>
      prevData.map(reg => ({
        ...reg,
        red_flags: reg.red_flags.map(flag =>
          flag.id === updatedFlag.id
            ? { ...flag, ...updatedFlag }
            : flag
        )
      }))
    );

    if (selectedRegulation) {
      setSelectedRegulation(prev => prev ? {
        ...prev,
        red_flags: prev.red_flags.map(flag =>
          flag.id === updatedFlag.id
            ? { ...flag, ...updatedFlag }
            : flag
        )
      } : null);
    }
  };

  return (
    <>
      <DataTable data={data} onRowClick={setSelectedRegulation} />
      <DetailModal
        regulation={selectedRegulation}
        onClose={() => setSelectedRegulation(null)}
        onFlagUpdated={handleFlagUpdated}
      />
    </>
  );
}
