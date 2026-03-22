import { Table, FolderTree, ClipboardCheck, Home, Code, BarChart3, FlaskConical, Search, BookOpen, DollarSign, Tag, Layers, type LucideIcon } from 'lucide-react';
// Entity-type icons sourced from entity-types.ts (canonical visual identity)
import { getEntityIcon } from './entity-types';

/**
 * Navigation item configuration.
 * Used by Header (desktop) and MobileNav (mobile drawer).
 */
export interface NavItem {
  /** Unique identifier for the nav item */
  key: string;
  /** Display label */
  label: string;
  /** Icon component for mobile nav */
  icon: LucideIcon;
  /** Whether this is a state-specific route */
  isStateSpecific: boolean;
  /** Static href (for global routes) */
  href?: string;
  /** Path suffix for state-specific routes (e.g., '/browse') */
  pathSuffix?: string;
  /** Query string to append (e.g., '?reviewStatus=unreviewed') */
  query?: string;
  /** Whether to show on desktop nav (default true) */
  showOnDesktop?: boolean;
  /** Group identifier for dropdowns */
  groupId?: 'explorer' | 'review' | 'metrics';
  /** Whether this link should be visually highlighted in the header */
  isHighlighted?: boolean;
  /** Whether this appears after the divider on desktop */
  isGlobalSection?: boolean;
}

/**
 * Group labels for the UI.
 */
export const NAV_GROUPS = {
  explorer: { label: 'Explorer', icon: FolderTree },
  review: { label: 'Review', icon: ClipboardCheck },
  metrics: { label: 'Analysis', icon: BarChart3 },
};

/**
 * Centralized navigation items configuration.
 * Single source of truth for both Header and MobileNav.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: 'Dashboard',
    icon: Home,
    isStateSpecific: false,
    href: '/',
    showOnDesktop: false,
  },
  {
    key: 'browse',
    label: 'Browse Regulations',
    icon: FolderTree,
    isStateSpecific: true,
    pathSuffix: '/browse',
    groupId: 'explorer',
  },
  {
    key: 'glossary',
    label: 'Definitions',
    icon: getEntityIcon('definition'),
    isStateSpecific: true,
    pathSuffix: '/definitions',
    groupId: 'explorer',
  },
  {
    key: 'guidance',
    label: 'Guidance',
    icon: getEntityIcon('guidance_document'),
    isStateSpecific: true,
    pathSuffix: '/guidance',
    groupId: 'explorer',
  },
  {
    key: 'ibr',
    label: 'Referenced Standards',
    icon: getEntityIcon('ibr_standard'),
    isStateSpecific: true,
    pathSuffix: '/ibr',
    groupId: 'explorer',
  },
  {
    key: 'table',
    label: 'Regulations',
    icon: Table,
    isStateSpecific: true,
    pathSuffix: '',
    groupId: 'explorer',
  },
  {
    key: 'search',
    label: 'Search',
    icon: Search,
    isStateSpecific: true,
    pathSuffix: '/search',
    groupId: 'explorer',
  },
  {
    key: 'statutes',
    label: 'Statutes',
    icon: getEntityIcon('statute'),
    isStateSpecific: true,
    pathSuffix: '/statutes',
    groupId: 'explorer',
  },
  {
    key: 'review',
    label: 'Review',
    icon: ClipboardCheck,
    isStateSpecific: true,
    pathSuffix: '/review',
    query: '?reviewStatus=unreviewed',
    groupId: 'review',
    isGlobalSection: true,
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    icon: FlaskConical,
    isStateSpecific: true,
    pathSuffix: '/pipeline',
    isHighlighted: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    isStateSpecific: true,
    pathSuffix: '/analytics',
    groupId: 'metrics',
  },
  {
    key: 'markers',
    label: 'Labels',
    icon: getEntityIcon('marker'),
    isStateSpecific: true,
    pathSuffix: '/markers',
    groupId: 'metrics',
  },
  {
    key: 'burden',
    label: 'Burden Index',
    icon: Layers,
    isStateSpecific: true,
    pathSuffix: '/burden',
    groupId: 'metrics',
  },
  {
    key: 'fines',
    label: 'Fines & Fees',
    icon: DollarSign,
    isStateSpecific: true,
    pathSuffix: '/fines',
    groupId: 'metrics',
  },
  {
    key: 'tags',
    label: 'Tags',
    icon: Tag,
    isStateSpecific: true,
    pathSuffix: '/tags',
    groupId: 'metrics',
  },
  {
    key: 'prompts',
    label: 'Prompts',
    icon: Code,
    isStateSpecific: false,
    href: '/prompts',
    isGlobalSection: true,
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    icon: BookOpen,
    isStateSpecific: false,
    href: '/onboarding',
    isGlobalSection: true,
  },
];

/**
 * Get the full href for a navigation item.
 */
export function getNavHref(item: NavItem, state: string): string {
  if (item.isStateSpecific) {
    const base = `/${state}${item.pathSuffix || ''}`;
    return item.query ? `${base}${item.query}` : base;
  }
  return item.href || '/';
}

/**
 * Get the match path for checking active state.
 * The match path is the base path without query strings.
 */
export function getNavMatchPath(item: NavItem, state: string): string {
  if (item.isStateSpecific) {
    return `/${state}${item.pathSuffix || ''}`;
  }
  return item.href || '/';
}

/**
 * Check if a navigation item is active based on the current pathname.
 */
export function isNavActive(item: NavItem, pathname: string, state: string): boolean {
  const matchPath = getNavMatchPath(item, state);

  if (item.key === 'home') {
    return pathname === '/';
  }

  if (item.key === 'table') {
    // Exact match for table view (state root)
    return pathname === `/${state}` || pathname === `/${state}/`;
  }

  if (!item.isStateSpecific) {
    // Exact match for global routes
    return pathname === matchPath;
  }

  // Prefix match for state-specific routes
  return pathname.startsWith(matchPath);
}

/**
 * Get navigation items for desktop (filtered by showOnDesktop).
 */
export function getDesktopNavItems(): NavItem[] {
  return NAV_ITEMS.filter(item => item.showOnDesktop !== false);
}

/**
 * Get state-specific nav items (for desktop, before the divider).
 */
export function getStateNavItems(): NavItem[] {
  return getDesktopNavItems().filter(item => item.isStateSpecific && !item.isGlobalSection);
}

/**
 * Get global nav items (for desktop, after the divider).
 */
export function getGlobalNavItems(): NavItem[] {
  return getDesktopNavItems().filter(item => item.isGlobalSection);
}
