'use client';

import type { RegulationWithAnalysis } from '@deproceduralizer/database';

interface RegulationHierarchyDetailsProps {
  regulation: Pick<
    RegulationWithAnalysis,
    'hierarchyLevel' | 'nycrrTitle' | 'nycrrPart' | 'nycrrSection' | 'parentId' | 'hierarchyPath'
  >;
  /** Show all fields including parent ID and path (default: false) */
  showAllFields?: boolean;
  className?: string;
}

/**
 * Displays hierarchy details for a regulation (level, title, part, section).
 * Used in DetailModal, DetailPanel, and regulation detail page.
 *
 * @example
 * // Basic usage - shows level, title, part, section
 * <RegulationHierarchyDetails regulation={regulation} />
 *
 * @example
 * // Show all fields including parent ID and path
 * <RegulationHierarchyDetails regulation={regulation} showAllFields />
 */
export function RegulationHierarchyDetails({
  regulation,
  showAllFields = false,
  className = '',
}: RegulationHierarchyDetailsProps) {
  const { hierarchyLevel, nycrrTitle, nycrrPart, nycrrSection, parentId, hierarchyPath } = regulation;

  // Check if we have any data to show
  const hasBasicData = hierarchyLevel || nycrrTitle || nycrrPart || nycrrSection;
  const hasExtendedData = parentId || hierarchyPath;

  if (!hasBasicData && !(showAllFields && hasExtendedData)) {
    return null;
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 text-sm ${className}`}>
      {hierarchyLevel && (
        <div>
          <span className="font-medium text-[var(--color-text-secondary)]">Level:</span>
          <span className="ml-2 capitalize">{hierarchyLevel}</span>
        </div>
      )}
      {nycrrTitle && (
        <div>
          <span className="font-medium text-[var(--color-text-secondary)]">Title:</span>
          <span className="ml-2">{nycrrTitle}</span>
        </div>
      )}
      {nycrrPart && (
        <div>
          <span className="font-medium text-[var(--color-text-secondary)]">Part:</span>
          <span className="ml-2">{nycrrPart}</span>
        </div>
      )}
      {nycrrSection && (
        <div>
          <span className="font-medium text-[var(--color-text-secondary)]">Section:</span>
          <span className="ml-2">{nycrrSection}</span>
        </div>
      )}
      {showAllFields && parentId && (
        <div>
          <span className="font-medium text-[var(--color-text-secondary)]">Parent ID:</span>
          <span className="ml-2">{parentId}</span>
        </div>
      )}
      {showAllFields && hierarchyPath && (
        <div className="col-span-2 md:col-span-4">
          <span className="font-medium text-[var(--color-text-secondary)]">Path:</span>
          <span className="ml-2 font-mono text-xs">{hierarchyPath}</span>
        </div>
      )}
    </div>
  );
}

export default RegulationHierarchyDetails;
