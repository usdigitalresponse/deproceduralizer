import { Table, FolderTree, ClipboardCheck, BookOpen, Home, Code, BarChart3, type LucideIcon } from 'lucide-react';

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
  /** Whether this appears after the divider on desktop */
  isGlobalSection?: boolean;
}

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
    showOnDesktop: false, // Dashboard not shown in desktop nav (logo links to it)
  },
  {
    key: 'table',
    label: 'Table View',
    icon: Table,
    isStateSpecific: true,
    pathSuffix: '',
  },
  {
    key: 'browse',
    label: 'Browse',
    icon: FolderTree,
    isStateSpecific: true,
    pathSuffix: '/browse',
  },
  {
    key: 'review',
    label: 'Review Mode',
    icon: ClipboardCheck,
    isStateSpecific: true,
    pathSuffix: '/review',
    query: '?reviewStatus=unreviewed',
  },
  {
    key: 'glossary',
    label: 'Glossary',
    icon: BookOpen,
    isStateSpecific: true,
    pathSuffix: '/definitions',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    isStateSpecific: true,
    pathSuffix: '/analytics',
  },
  {
    key: 'prompts',
    label: 'Prompts',
    icon: Code,
    isStateSpecific: false,
    href: '/prompts',
    isGlobalSection: true, // Shows after divider on desktop
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
  return getDesktopNavItems().filter(item => item.isStateSpecific);
}

/**
 * Get global nav items (for desktop, after the divider).
 */
export function getGlobalNavItems(): NavItem[] {
  return getDesktopNavItems().filter(item => item.isGlobalSection);
}
