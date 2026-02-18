import { track } from '@vercel/analytics';

export const EVENTS = {
  STATE_SELECTED: 'State Selected',
  SEARCH_SUBMITTED: 'Search Submitted',
  FILTER_APPLIED: 'Filter Applied',
  REGULATION_VIEWED: 'Regulation Viewed',
  BOOKMARK_TOGGLED: 'Bookmark Toggled',
  REVIEW_STATUS_CHANGED: 'Review Status Changed',
  TAB_SWITCHED: 'Tab Switched',
  VIEW_MODE_CHANGED: 'View Mode Changed',
  COPY_LINK_CLICKED: 'Copy Link Clicked',
  NAV_ITEM_CLICKED: 'Nav Item Clicked',
} as const;

export { track };
