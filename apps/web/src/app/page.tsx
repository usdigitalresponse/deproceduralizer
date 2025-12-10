'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import { Regulation, ParsedRegulation, RedFlag } from '@/types/regulation';

function parseRedFlags(redFlagsStr: string): RedFlag[] {
  try {
    if (!redFlagsStr || redFlagsStr === 'N/A') return [];
    return JSON.parse(redFlagsStr);
  } catch {
    return [];
  }
}

function getCategories(flags: RedFlag[]): string {
  return flags.map((f) => f.category || '').filter((c) => c).join(', ');
}

function getExplanations(flags: RedFlag[]): string {
  return flags.map((f) => f.explanation || '').filter((e) => e).join(' | ');
}

export default function Home() {
  const [data, setData] = useState<ParsedRegulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegulation, setSelectedRegulation] = useState<ParsedRegulation | null>(null);

  useEffect(() => {
    Papa.parse<Regulation>('/data.csv', {
      header: true,
      download: true,
      complete: (results) => {
        const parsed = results.data
          .filter((row) => row.title)
          .map((row): ParsedRegulation => {
            const flags = parseRedFlags(row.red_flags);
            return {
              ...row,
              red_flags: flags,
              categories: getCategories(flags),
              explanations: getExplanations(flags),
            };
          });
        setData(parsed);
        setLoading(false);
      },
      error: () => {
        setLoading(false);
      },
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
