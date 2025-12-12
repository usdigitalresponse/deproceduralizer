import { Suspense } from 'react';
import { getRegulationsWithAnalysis } from '@/lib/actions/regulations';
import RegulationsClient from '@/components/RegulationsClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const regulations = await getRegulationsWithAnalysis();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-[98%] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          NY Regulations Red Flag Analysis
        </h1>
        <p className="text-gray-600 mb-6">
          Searchable database of regulatory compliance issues and technical review requirements
        </p>

        <Suspense fallback={<div className="text-center py-10 text-gray-500">Loading data...</div>}>
          <RegulationsClient initialData={regulations} />
        </Suspense>
      </div>
    </div>
  );
}
