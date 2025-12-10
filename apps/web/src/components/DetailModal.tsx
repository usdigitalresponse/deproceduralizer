'use client';

import { ParsedRegulation } from '@/types/regulation';

interface DetailModalProps {
  regulation: ParsedRegulation | null;
  onClose: () => void;
}

export default function DetailModal({ regulation, onClose }: DetailModalProps) {
  if (!regulation) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 pr-4">
            {regulation.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700">Source:</span>
              <a
                href={regulation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-600 hover:underline"
              >
                View Original
              </a>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700">Red Flag Count:</span>
              <span className="ml-2 inline-block bg-red-100 text-red-800 px-2 py-0.5 rounded text-sm">
                {regulation.num_flags || '0'} flags
              </span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700">Severity:</span>
              <span className={`ml-2 font-bold ${
                regulation.max_severity === '9' || regulation.max_severity === '8'
                  ? 'text-red-600'
                  : regulation.max_severity === '7' || regulation.max_severity === '6'
                  ? 'text-orange-500'
                  : 'text-green-600'
              }`}>
                {regulation.max_severity || '–'}
              </span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700">Complexity:</span>
              <span className="ml-2">{regulation.overall_complexity || '–'}</span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700">Implementation Issues:</span>
              <span className="ml-2">
                {regulation.has_implementation_issues === 'True' ? '✓ Yes' : '– No'}
              </span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700">Tech Review Required:</span>
              <span className="ml-2">
                {regulation.requires_technical_review === 'True' ? '✓ Yes' : '– No'}
              </span>
            </div>
            <div className="border-b pb-2 col-span-2">
              <span className="font-semibold text-gray-700">Reporting Requirement:</span>
              <span className="ml-2">
                {regulation.has_reporting_requirement === 'True' ? '✓ Yes' : '– No'}
              </span>
            </div>
          </div>

          {/* Red Flags Details */}
          {regulation.red_flags && regulation.red_flags.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Red Flags Details:</h3>
              <div className="space-y-2">
                {regulation.red_flags.map((flag, idx) => (
                  <div key={idx} className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
                    <div className="font-medium text-red-800">{flag.category}</div>
                    <div className="text-sm text-gray-700 mt-1">{flag.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">Summary:</h3>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded text-gray-700">
              {regulation.summary || 'No summary available'}
            </div>
          </div>

          {/* Regulation Text */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Regulation Text:</h3>
            <div className="bg-gray-100 border-l-4 border-gray-400 p-4 rounded text-sm font-mono whitespace-pre-wrap text-gray-800 max-h-64 overflow-y-auto">
              {regulation.content || 'No content available'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
