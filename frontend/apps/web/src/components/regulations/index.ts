// Shared regulation display components (client-safe)
export { RegulationHierarchyDetails } from './RegulationHierarchyDetails';
export { RegulationMetadata } from './RegulationMetadata';
export { RegulationSummary } from './RegulationSummary';
export { RegulationContent } from './RegulationContent';
export { RegulationQuickStats } from './RegulationQuickStats';

// NOTE: Server components (HierarchyBreadcrumbsServer, ChildrenListServer) must be
// imported directly from their files to avoid bundling database code into client components.
// Example: import { HierarchyBreadcrumbsServer } from '@/components/regulations/HierarchyBreadcrumbsServer';
