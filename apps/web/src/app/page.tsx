'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import { ParsedRegulation } from '@/types/regulation';

export default function Home() {
  const [data, setData] = useState<ParsedRegulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegulation, setSelectedRegulation] = useState<ParsedRegulation | null>(null);

  useEffect(() => {
    fetch('/data.json')
      .then((res) => res.json())
      .then((results: ParsedRegulation[]) => {
        // Add derived fields for table display
        const parsed = results
          .filter((row) => row.title)
          .map((row): ParsedRegulation => {
            const flags = row.red_flags || [];
            return {
              ...row,
              categories: flags.map((f) => f.category || '').filter((c) => c).join(', '),
              explanations: flags.map((f) => f.explanation || '').filter((e) => e).join(' | '),
            };
          });
        setData(parsed);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-[98%] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          NY Regulations Red Flag Analysis
        </h1>
        <p className="text-gray-600 mb-6">
          Searchable database of regulatory compliance issues and technical review requirements
        </p>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading data...</div>
        ) : (
          <DataTable data={data} onRowClick={setSelectedRegulation} />
        )}
      </div>

      <DetailModal
        regulation={selectedRegulation}
        onClose={() => setSelectedRegulation(null)}
      />
    </div>
  );
}
