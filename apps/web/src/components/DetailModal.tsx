'use client';

import { ParsedRegulation } from '@/types/regulation';

interface DetailModalProps {
  regulation: ParsedRegulation | null;
  onClose: () => void;
}

export default function DetailModal({ regulation, onClose }: DetailModalProps) {
  if (!regulation) return null;

  // Format NYCRR citation
  const nycrrCitation = regulation.nycrr_title
    ? `${regulation.nycrr_title} NYCRR ${regulation.nycrr_part || ''}${regulation.nycrr_section ? '.' + regulation.nycrr_section : ''}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 pr-4">
              {regulation.title}
            </h2>
            {nycrrCitation && (
              <span className="text-sm text-gray-500">{nycrrCitation}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Hierarchy Info */}
          {(regulation.hierarchy_level || regulation.hierarchy_path) && (
            <div className="mb-6 bg-purple-50 border-l-4 border-purple-400 p-4 rounded">
              <h3 className="font-semibold text-purple-800 mb-2">Hierarchy Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {regulation.hierarchy_level && (
                  <div>
                    <span className="font-medium text-gray-600">Level:</span>
                    <span className="ml-2 capitalize">{regulation.hierarchy_level}</span>
                  </div>
                )}
                {regulation.nycrr_title && (
                  <div>
                    <span className="font-medium text-gray-600">Title:</span>
                    <span className="ml-2">{regulation.nycrr_title}</span>
                  </div>
                )}
                {regulation.nycrr_part && (
                  <div>
                    <span className="font-medium text-gray-600">Part:</span>
                    <span className="ml-2">{regulation.nycrr_part}</span>
                  </div>
                )}
                {regulation.nycrr_section && (
                  <div>
                    <span className="font-medium text-gray-600">Section:</span>
                    <span className="ml-2">{regulation.nycrr_section}</span>
                  </div>
                )}
                {regulation.parent_source_index && (
                  <div>
                    <span className="font-medium text-gray-600">Parent ID:</span>
                    <span className="ml-2">{regulation.parent_source_index}</span>
                  </div>
                )}
                {regulation.hierarchy_path && (
                  <div className="col-span-2 md:col-span-3">
                    <span className="font-medium text-gray-600">Path:</span>
                    <span className="ml-2 font-mono text-xs">{regulation.hierarchy_path}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">Source:</span>
              <a
                href={regulation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-600 hover:underline text-sm"
              >
                View Original
              </a>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">URL Type:</span>
              <span className="ml-2 text-sm">{regulation.url_type || '–'}</span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">Source Index:</span>
              <span className="ml-2 text-sm font-mono">{regulation.source_index || '–'}</span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">Red Flags:</span>
              <span className="ml-2 inline-block bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
                {regulation.num_flags || '0'} flags
              </span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">Severity:</span>
              <span className={`ml-2 font-bold ${
                regulation.max_severity >= 8
                  ? 'text-red-600'
                  : regulation.max_severity >= 6
                  ? 'text-orange-500'
                  : 'text-green-600'
              }`}>
                {regulation.max_severity || '–'}
              </span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">Complexity:</span>
              <span className="ml-2 text-sm">{regulation.overall_complexity || '–'}</span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">Impl Issues:</span>
              <span className="ml-2 text-sm">
                {regulation.has_implementation_issues ? '✓ Yes' : '– No'}
              </span>
            </div>
            <div className="border-b pb-2">
              <span className="font-semibold text-gray-700 text-sm">Tech Review:</span>
              <span className="ml-2 text-sm">
                {regulation.requires_technical_review ? '✓ Yes' : '– No'}
              </span>
            </div>
            <div className="border-b pb-2 col-span-2">
              <span className="font-semibold text-gray-700 text-sm">Reporting Req:</span>
              <span className="ml-2 text-sm">
                {regulation.has_reporting_requirement ? '✓ Yes' : '– No'}
              </span>
            </div>
          </div>

          {/* Red Flags Details */}
          {regulation.red_flags && regulation.red_flags.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Red Flags Details:</h3>
              <div className="space-y-3">
                {regulation.red_flags.map((flag, idx) => (
                  <div key={idx} className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-red-800">{flag.category}</span>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          flag.severity >= 8 ? 'bg-red-200 text-red-800' :
                          flag.severity >= 6 ? 'bg-orange-200 text-orange-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          Severity: {flag.severity}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                          {flag.complexity}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{flag.explanation}</p>
                    {flag.implementation_approach && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-gray-600">Implementation:</span>
                        <span className="ml-2 text-gray-700">{flag.implementation_approach}</span>
                      </div>
                    )}
                    {flag.effort_estimate && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium text-gray-600">Effort:</span>
                        <span className="ml-2 text-gray-700">{flag.effort_estimate}</span>
                      </div>
                    )}
                    {flag.matched_phrases && flag.matched_phrases.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-600">Matched phrases:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {flag.matched_phrases.map((phrase, i) => (
                            <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              {phrase}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {flag.text_examples && flag.text_examples.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-600">Examples from text:</span>
                        <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                          {flag.text_examples.map((ex, i) => (
                            <li key={i} className="italic">&quot;{ex}&quot;</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">Summary:</h3>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded text-gray-700 text-sm">
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
