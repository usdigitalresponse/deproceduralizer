# Deproceduralizer - Style Guide

This document describes the design system and style considerations for the Deproceduralizer web application.

## Design Philosophy

The interface follows a **"modern civic"** design language, inspired by:
- **Civic design systems**: Professional, trustworthy government tool aesthetics
- **Recoding America Fund**: Framework-forward, institutional seriousness
- **U.S. Digital Response**: Accessibility-focused, service-oriented design
- **USWDS Accessibility Patterns**: Focus states, color contrast, keyboard navigation

### Core Principles

1. **Trust-first**: Header pattern establishes official/credible feel
2. **Clarity over decoration**: No gratuitous shadows, gradients, or effects
3. **Strong hierarchy**: Clear visual weight progression from headings to body
4. **Breathing room**: Generous spacing between sections
5. **Semantic color**: Status colors communicate meaning, not just decoration
6. **Accessible defaults**: Visible focus rings, sufficient contrast, keyboard support
7. **Sparing accent use**: Yellow accent only for important highlights
8. **Atomic components**: Keep components small, composable, and DRY

---

## Color Palette

### Primary Colors (Navy Blue)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#154973` | Primary buttons, header, links |
| `--color-primary-strong` | `#0e324f` | Hover states |
| `--color-primary-stronger` | `#081b2b` | Active states, footer |
| `--color-primary-mid` | `#457aa5` | Secondary accents |
| `--color-primary-weak` | `#cddde9` | Borders, dividers |
| `--color-primary-weaker` | `#eff6fb` | Light backgrounds |
| `--color-primary-faint` | `#f7fafd` | Row hover states |

### Accent Color (Yellow)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | `#face00` | Important highlights only |
| `--color-accent-muted` | `#fef3c7` | Warning backgrounds |

**Note**: Use accent color sparingly. Never as primary color.

### Semantic Colors

| Purpose | Background | Text/Border |
|---------|------------|-------------|
| Success | `--color-success-bg` (`#dcfce7`) | `--color-success` (`#1e752e`) |
| Warning | `--color-warning-bg` (`#fef3c7`) | `--color-warning` (`#b45309`) |
| Danger | `--color-danger-bg` (`#fee2e2`) | `--color-danger` (`#b52c2c`) |
| Danger (hover) | — | `--color-danger-strong` (`#9f2424`) |
| Danger (active) | — | `--color-danger-stronger` (`#871d1d`) |
| Info | `--color-info-bg` (`#dbeafe`) | `--color-info` (`#004dd1`) |

### Neutral Colors

From `--color-neutral-900` (darkest) to `--color-neutral-50` (lightest), plus `--color-white`.

### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-text` | `#1b1b1b` | Primary text |
| `--color-text-secondary` | `#525252` | Secondary text, labels |
| `--color-text-muted` | `#6b6b6b` | Placeholder, disabled text |
| `--color-link` | `#004dd1` | Links |
| `--color-link-hover` | `#003ba1` | Link hover states |

---

## Typography

### Font Families

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", "Consolas", monospace;
```

### Font Sizes

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 12px | Badges, small labels |
| `--text-sm` | 14px | Body text, table cells |
| `--text-base` | 16px | Default body text |
| `--text-lg` | 18px | Section headers |
| `--text-xl` | 20px | Page subtitles |
| `--text-2xl` | 24px | Page titles |
| `--text-3xl` | 30px | Hero titles |
| `--text-4xl` | 36px | Large headings |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Labels, emphasis |
| `--font-semibold` | 600 | Headers, buttons |
| `--font-bold` | 700 | Strong emphasis |

---

## Spacing

| Token | Size | Usage |
|-------|------|-------|
| `--space-1` | 4px | Tight gaps |
| `--space-2` | 8px | Icon gaps, inline spacing |
| `--space-3` | 12px | Form field gaps |
| `--space-4` | 16px | Card padding, section gaps |
| `--space-6` | 24px | Component spacing |
| `--space-8` | 32px | Section spacing |
| `--space-10` | 40px | Large gaps |
| `--space-12` | 48px | Page sections |
| `--space-16` | 64px | Major sections |

---

## Border Radius

| Token | Size | Usage |
|-------|------|-------|
| `--radius-sm` | 4px | Badges, small elements |
| `--radius-md` | 6px | Buttons, inputs |
| `--radius-lg` | 8px | Cards |
| `--radius-xl` | 12px | Modals |

---

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Cards, subtle elevation |
| `--shadow-md` | Dropdowns, popovers |
| `--shadow-lg` | Modals |

---

## Components

### Button Variants

| Variant | Usage | Style |
|---------|-------|-------|
| `primary` | Main CTAs | Solid primary blue, white text |
| `secondary` | Alternative actions | Outlined primary blue |
| `ghost` | Tertiary actions | Transparent, hover background |
| `danger` | Destructive actions | Solid red |

Button sizes: `sm`, `md`, `lg`

### Badge Variants

| Variant | Background | Text |
|---------|------------|------|
| `default` | `neutral-100` | `text-muted` |
| `success` | `success-bg` | `success` |
| `warning` | `warning-bg` | `warning` |
| `danger` | `danger-bg` | `danger` |
| `info` | `info-bg` | `info` |

**Review Status Badges**:
- `unreviewed`: Default (gray)
- `confirmed`: Success (green)
- `false_positive`: Default (gray)
- `needs_context`: Warning (yellow)
- `deferred`: Info (blue)

**Severity Badges**:
- High (7-10): Danger red
- Medium (4-6): Warning yellow
- Low (1-3): Success green

### Card

- Background: `--color-surface` (white)
- Border: `1px solid --color-neutral-200`
- Radius: `--radius-lg`
- Shadow: `--shadow-sm`
- Padding options: `none`, `sm`, `md` (default), `lg`

### Modal

- Overlay: `rgba(8, 27, 43, 0.6)` (dark navy)
- Modal background: white
- Radius: `--radius-xl`
- Max-width options: `sm` (28rem), `md` (32rem), `lg` (48rem), `xl` (64rem)
- Focus trap enabled
- Escape to close

### Input / Textarea

- Background: `--color-surface`
- Border: `1px solid --color-neutral-300`
- Focus: Ring with `--color-focus`
- Disabled: 50% opacity

### Select (Native)

Styled native select with same appearance as Input for consistency.

### SearchInput

Search input with debouncing, clear button, and loading state:

```tsx
import { SearchInput } from '@/components/ui';

<SearchInput
  value={search}
  onSearch={(value) => updateUrlParams({ search: value })}
  placeholder="Search regulations..."
  debounceMs={300}
  isLoading={isSearching}
  size="md"  // 'sm' | 'md'
/>
```

Features:
- Controlled value with debounced `onSearch` callback
- Non-debounced `onChange` for immediate updates
- Clear button appears when value is present
- Loading spinner state
- Search and clear icons from Lucide

### Alert

Component for displaying messages with different severity levels:

```tsx
import { Alert } from '@/components/ui';

<Alert variant="error">
  Failed to save changes. Please try again.
</Alert>

<Alert variant="warning" title="Unsaved Changes">
  You have unsaved changes that will be lost.
</Alert>

<Alert variant="success">
  Changes saved successfully!
</Alert>

<Alert variant="info" icon={<CustomIcon />}>
  Processing may take a few seconds.
</Alert>
```

| Variant | Background | Icon |
|---------|------------|------|
| `error` | `danger-bg` | XCircle |
| `warning` | `warning-bg` | AlertTriangle |
| `success` | `success-bg` | CheckCircle |
| `info` | `primary-bg` | Info |

### Tag

Component for displaying labels, matched phrases, keywords, etc.:

```tsx
import { Tag } from '@/components/ui';

<Tag>Label</Tag>
<Tag variant="danger" size="sm">shall comply</Tag>
<Tag variant="primary">keyword</Tag>
<Tag removable onRemove={() => handleRemove()}>tag</Tag>
```

| Variant | Style |
|---------|-------|
| `default` | Gray background |
| `primary` | Primary blue background |
| `danger` | Red background with border |
| `warning` | Yellow background with border |
| `success` | Green background with border |

Size options: `sm`, `md`

### LevelBadge

Badge for displaying hierarchy levels (Title, Part, Section, etc.):

```tsx
import { LevelBadge } from '@/components/ui';

<LevelBadge level="section" />
<LevelBadge level={document.hierarchyLevel} />
```

Renders uppercase text with neutral background: `[SECTION]`

### EmptyState

Component for when there's no data to display:

```tsx
import { EmptyState } from '@/components/ui';
import { Search, CheckCircle } from 'lucide-react';

// Basic usage
<EmptyState title="No results found" />

// With description and action
<EmptyState
  icon={Search}
  title="No red flags found"
  description="Try adjusting your filters or search terms"
  action={{ label: "Clear filters", onClick: handleClear }}
/>

// In a queue component
{items.length === 0 ? (
  <EmptyState
    icon={CheckCircle}
    title="All caught up!"
    description="No items need review"
  />
) : (
  <ItemList items={items} />
)}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `LucideIcon` | `FileSearch` | Icon to display |
| `title` | `string` | required | Primary message |
| `description` | `string` | - | Secondary descriptive text |
| `action` | `{ label: string; onClick: () => void }` | - | Optional action button |
| `className` | `string` | `''` | Additional CSS classes |

### CopyLinkButton

Button for copying deep links to specific items:

```tsx
import { CopyLinkButton } from '@/components/ui';

<CopyLinkButton anchor="flag-123" />
<CopyLinkButton anchor="compliance-456" size="md" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `anchor` | `string` | required | The anchor ID (without #) to append to current URL |
| `size` | `'sm' \| 'md'` | `'sm'` | Button size |
| `className` | `string` | `''` | Additional CSS classes |

Features:
- Link2 icon from Lucide, switches to Check icon after copy
- Copies full URL with hash to clipboard
- Shows "Copied!" tooltip feedback for 2 seconds
- Ghost-style button with hover states
- Uses `navigator.clipboard` API

---

## Layout Components

### Header

Two-tier structure:
1. **Tool bar** (thin, ~32px): Primary blue background, "Regulatory analysis and review tool" text
2. **Main header**: White background, app title with document icon

### Footer

Dark background (`--color-primary-stronger`) with:
- Brand section with document icon
- Link columns (Resources, Legal)
- Credit line for Recoding America Fund

### Container

Max-width wrapper with responsive padding:
- Sizes: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px)
- Default: `xl`

### PageHeader

Standardized page title area with:
- Title (text-2xl or text-3xl)
- Optional description
- Light background stripe

---

## Table Styling

- Clean white background
- Subtle horizontal dividers (`--color-neutral-200`)
- Header row: Primary blue background, white text, uppercase labels
- Row hover: `--color-primary-faint`
- Sorted column: Arrow indicator
- Pagination: Bottom-aligned with Previous/Next buttons

---

## Focus States

All interactive elements have visible focus states:
- Ring: 2px solid `--color-focus`
- Offset: 2px
- WCAG 2.1 compliant

---

## Transitions

| Token | Duration | Usage |
|-------|----------|-------|
| `--transition-fast` | 150ms | Hover states |
| `--transition-normal` | 200ms | General transitions |
| `--transition-slow` | 300ms | Modal animations |

---

## Review Mode Components

The Review Mode provides a dedicated interface for efficiently triaging red flags identified by analysis.

### ReviewQueue

Main container component that orchestrates the review interface:
- Manages local state for optimistic updates
- Handles pagination navigation
- Coordinates keyboard navigation focus
- Integrates all review sub-components

```tsx
import { ReviewQueue } from '@/components/review';

<ReviewQueue
  initialFlags={flags}
  pagination={{ page, pageSize, total, totalPages }}
  statusCounts={counts}
  categories={categories}
  currentFilters={{ status, severity, category }}
  sortBy="severity"
  sortOrder="desc"
/>
```

### ReviewCard

Individual flag card with embedded review form:
- Displays flag category, severity badge, complexity badge
- Shows parent regulation title and NYCRR citation
- Full explanation text (not truncated)
- Matched phrases as tags
- Always-visible review form (status, priority, impact type, reviewer, notes)
- Supports keyboard navigation focus state

```tsx
import { ReviewCard } from '@/components/review';

<ReviewCard
  flag={flag}
  onUpdated={handleFlagUpdated}
  onViewRegulation={handleViewRegulation}
  isFocused={index === focusedIndex}
/>
```

### ReviewFilters

Filter bar with URL-based state (same pattern as DataTable):
- Status dropdown: Unreviewed, Confirmed, False Positive, Needs Context, Deferred, All
- Severity dropdown: High (7-10), Medium (4-6), Low (1-3), All
- Category dropdown: Dynamic list from data
- Sort by: Severity, Category, Last Reviewed
- Sort order toggle

```tsx
import { ReviewFilters } from '@/components/review';

<ReviewFilters
  categories={categories}
  currentFilters={{ status: 'unreviewed', severity: 'high' }}
  sortBy="severity"
  sortOrder="desc"
/>
```

### ReviewProgress

Progress indicator showing review status:
- Progress bar with percentage
- Breakdown by status (unreviewed, confirmed, false_positive, needs_context, deferred)
- Updates optimistically as reviews are saved

```tsx
import { ReviewProgress } from '@/components/review';

<ReviewProgress counts={statusCounts} />
```

### ReviewKeyboardNav

Keyboard shortcut handler:
- `j` / `↓`: Next flag
- `k` / `↑`: Previous flag
- `n`: Next unreviewed flag
- `v`: View regulation
- `?`: Show keyboard shortcuts help modal

```tsx
import { ReviewKeyboardNav } from '@/components/review';

<ReviewKeyboardNav
  onNavigate={handleNavigate}
  onNextUnreviewed={handleNextUnreviewed}
  onViewRegulation={handleViewRegulation}
/>
```

### RegulationModal

Modal overlay for viewing regulation context without leaving review flow:
- Loads regulation by ID on demand
- Shows metadata, summary, and regulation text
- Link to full page view

```tsx
import { RegulationModal } from '@/components/review';

<RegulationModal
  regulationId={selectedId}
  onClose={() => setSelectedId(null)}
/>
```

### ReviewModeSwitcher

Compact two-button toggle for switching between Review Mode and Developer Mode:
- Positioned above the tab bar with bottom margin for visual separation
- Uses `inline-flex` to maintain compact width
- Persists mode in URL params (`?mode=developer`)

```tsx
import { ReviewModeSwitcher } from '@/components/review';

<ReviewModeSwitcher mode={mode} />
```

### ReviewTypeTabs

Tab bar for switching between content types. Adapts based on mode:
- **Review Mode**: Red Flags, Compliance Issues, Needs More Info
- **Developer Mode**: All Reviewed Items, Needs More Info

```tsx
import { ReviewTypeTabs } from '@/components/review';

<ReviewTypeTabs
  activeType={reviewType}
  counts={{ flags: 100, compliance: 50, needs_info: 5 }}
  mode={mode}
/>
```

---

## Developer Mode Components

Developer Mode provides a second layer for tracking implementation status of reviewed items.

### DeveloperQueue

Combined queue showing both red flags and compliance issues that have been reviewed:
- Manages local state for optimistic updates
- Handles pagination and keyboard navigation
- Shows developer-specific progress and filters

```tsx
import { DeveloperQueue } from '@/components/review';

<DeveloperQueue
  initialItems={items}
  pagination={{ page, pageSize, total, totalPages }}
  statusCounts={developerStatusCounts}
  currentDeveloperStatus="unresolved"
  currentDeveloperAssigned="Michael"
  sortBy="reviewedAt"
  sortOrder="desc"
/>
```

### DeveloperCard

Individual item card with developer tracking form:
- Shows item type badge (Red Flag or Compliance Issue)
- Developer status dropdown: Unresolved, Resolved, Pending, Backlogged, Need More Info
- Developer assignment: Michael or Abigail
- Resolution type (when resolved): Implemented or Not Implemented
- Notes and question fields

```tsx
import { DeveloperCard } from '@/components/review';

<DeveloperCard
  item={developerItem}
  onUpdated={handleItemUpdated}
  onViewRegulation={handleViewRegulation}
  isFocused={index === focusedIndex}
/>
```

### DeveloperFilters

Filter bar for developer view:
- Status: All, Unresolved, Resolved, Pending, Backlogged, Need More Info
- Developer: All, Michael, Abigail
- Sort by: Review Date, Developer Checked Date

```tsx
import { DeveloperFilters } from '@/components/review';

<DeveloperFilters
  currentStatus="unresolved"
  currentDeveloper="Michael"
  sortBy="reviewedAt"
  sortOrder="desc"
/>
```

### DeveloperProgress

Progress indicator showing developer status breakdown:
- Progress bar with resolved percentage
- Counts by status: Unresolved, Pending, Backlogged, Need More Info, Resolved

```tsx
import { DeveloperProgress } from '@/components/review';

<DeveloperProgress counts={developerStatusCounts} />
```

### NeedMoreInfoQueue

Queue for items where developers have requested additional information:
- Shows items with `need_more_info` developer status
- Prioritizes current reviewer's items at top (if reviewer name set)
- Allows reviewers to respond with updated notes

```tsx
import { NeedMoreInfoQueue } from '@/components/review';

<NeedMoreInfoQueue
  initialItems={needsInfoItems}
  pagination={{ page, pageSize, total, totalPages }}
  counts={needsInfoCounts}
  reviewerName="Test Reviewer"
/>
```

### NeedMoreInfoCard

Card for displaying developer questions and allowing reviewer responses:
- Shows developer's question prominently
- Highlights if current reviewer owns the item
- Form for updating reviewer notes

```tsx
import { NeedMoreInfoCard } from '@/components/review';

<NeedMoreInfoCard
  item={needsInfoItem}
  isOwner={true}
  onUpdated={handleItemUpdated}
  onViewRegulation={handleViewRegulation}
  isFocused={index === focusedIndex}
/>
```

---

## Error Handling Pattern

Server actions use the `ActionResult<T>` type for consistent error handling that is **obvious, not silent**.

### ActionResult Type

```tsx
import { type ActionResult, success, failure, getErrorMessage } from '@/lib/actions/types';

// Success result
return success(data);

// Failure result
return failure('Failed to load data');

// In try/catch
try {
  const result = await someOperation();
  return success(result);
} catch (error) {
  console.error('[functionName]', error);
  return failure(getErrorMessage(error));
}
```

### Server Action Pattern

```tsx
// lib/actions/example.ts
'use server';

import { type ActionResult, success, failure, getErrorMessage } from './types';

export async function getItems(): Promise<ActionResult<Item[]>> {
  try {
    const items = await repo.getAll();
    return success(items);
  } catch (error) {
    console.error('[getItems]', error);
    return failure(getErrorMessage(error));
  }
}
```

### Consumer Pattern

```tsx
// In component
const result = await getItems();

if (!result.success) {
  // Display error to user - NEVER silently fail
  return <Alert variant="error">{result.error}</Alert>;
}

// Use the data
const items = result.data;
```

### Key Principles

1. **Visible errors**: Always display errors to users with Alert component
2. **Logged errors**: Console.error with function name for debugging
3. **Typed returns**: ActionResult union type prevents accessing data without checking success
4. **No silent failures**: Every action returns success or failure, never throws to consumers

---

## Constants and Helpers

Centralized constants in `types/regulation.ts`:

### Complexity Mapping

```tsx
import { getComplexityVariant, COMPLEXITY_LEVELS } from '@/types/regulation';

// Maps complexity to Badge variant
const variant = getComplexityVariant(complexity);
// 'HIGH' → 'danger'
// 'MEDIUM' | 'MEDIUM-HIGH' → 'warning'
// 'LOW' or other → 'success'

<Badge variant={getComplexityVariant(flag.complexity)}>
  {flag.complexity}
</Badge>
```

### Severity Thresholds

```tsx
import { SEVERITY_THRESHOLDS, getSeverityVariant } from '@/types/regulation';

// SEVERITY_THRESHOLDS = { HIGH: 7, MEDIUM: 4, LOW: 1 }
// getSeverityVariant maps severity to Badge variant:
// severity >= 7 → 'danger'
// severity >= 4 → 'warning'
// severity >= 1 → 'success'
// else → 'default'
```

### Available Constants

| Constant | Usage |
|----------|-------|
| `REVIEW_STATUSES` | Dropdown options for review status |
| `DEVELOPER_STATUSES` | Dropdown options for developer status |
| `PRIORITY_OPTIONS` | Priority 1-5 dropdown options |
| `IMPACT_TYPES` | Impact type dropdown options |
| `COMPLIANCE_ISSUE_TYPES` | Compliance issue type options |
| `ISSUE_TYPE_LABELS` | Display labels for issue types |
| `RESOLUTION_TYPES` | Implemented / Not Implemented |
| `DEVELOPERS` | Michael / Abigail |
| `REVIEW_TYPES` | flags / compliance / needs_info |
| `COMPLEXITY_LEVELS` | LOW / MEDIUM / MEDIUM-HIGH / HIGH |
| `SEVERITY_THRESHOLDS` | HIGH: 7, MEDIUM: 4, LOW: 1 |

---

## URL Query Params

The app uses `nuqs` for type-safe URL query parameter management.

### Setup

NuqsAdapter is configured in the root layout:

```tsx
// app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";

<body>
  <NuqsAdapter>
    {children}
  </NuqsAdapter>
</body>
```

### Available Parsers

```tsx
import {
  pageParser,
  pageSizeParser,
  sortOrderParser,
  reviewStatusParser,
  developerStatusParser,
  severityParser,
  reviewTypeParser,
  reviewModeParser,
  categoryParser,
  searchParser,
} from '@/lib/url/parsers';
```

### Query String Helpers

```tsx
import { createQueryString, mergeQueryParams } from '@/lib/url/parsers';

// Create query string, omitting null/undefined/'all' values
const qs = createQueryString({ page: 1, status: 'unreviewed', category: null });
// → "page=1&status=unreviewed"

// Merge into existing params, resetting page to 1
const newQs = mergeQueryParams(searchParams, { status: 'confirmed' });
```

---

## Resizable Panels

### ResizableDivider

Draggable divider for resizing adjacent panels:

```tsx
import { ResizableDivider } from '@/components/ui/ResizableDivider';

<div className="flex">
  <div style={{ width: panelWidth }}>Left Panel</div>
  <ResizableDivider
    onResize={(delta) => setPanelWidth(w => w + delta)}
    onResizeEnd={() => localStorage.setItem('width', panelWidth)}
    onReset={() => setPanelWidth(400)}
  />
  <div className="flex-1">Right Panel</div>
</div>
```

| Prop | Type | Description |
|------|------|-------------|
| `onResize` | `(delta: number) => void` | Called during drag with pixel delta |
| `onResizeEnd` | `() => void` | Called when drag ends (save to storage) |
| `onReset` | `() => void` | Called on double-click (reset to default) |
| `orientation` | `'vertical' \| 'horizontal'` | Divider direction (default: `'vertical'`) |

Features:
- 4px hit area with 1px visible line
- `col-resize` cursor on hover
- Prevents text selection during drag
- Double-click to reset to default
- Uses pointer events for touch/mouse support
- Accessible: `role="separator"` with `aria-orientation`

**Browse View Integration**: The browse page uses this for resizable tree/detail panels:
- Default width: 400px
- Min width: 200px
- Max width: 60% of container
- Persists to localStorage (`browse-panel-width`)
- Hidden on mobile (uses drawer pattern instead)

---

## Shared Regulation Components

Reusable components for displaying regulation details across DetailModal, DetailPanel, and the regulation page.

### RegulationHierarchyDetails

Displays hierarchy details (level, title, part, section):

```tsx
import { RegulationHierarchyDetails } from '@/components/regulations';

// Basic usage - level, title, part, section
<RegulationHierarchyDetails regulation={regulation} />

// Show all fields including parent ID and path
<RegulationHierarchyDetails regulation={regulation} showAllFields />
```

### RegulationMetadata

Metadata grid (source, flags, severity, complexity, etc.):

```tsx
import { RegulationMetadata } from '@/components/regulations';

// Full grid for regulation page
<RegulationMetadata regulation={regulation} layout="grid" />

// Compact layout for modals
<RegulationMetadata regulation={regulation} layout="compact" />
```

### RegulationSummary

Summary section with info styling:

```tsx
import { RegulationSummary } from '@/components/regulations';

<RegulationSummary summary={regulation.summary} />
<RegulationSummary summary={regulation.summary} showHeading={false} />
```

### RegulationContent

Content display with optional truncation:

```tsx
import { RegulationContent } from '@/components/regulations';

// Full content in modal
<RegulationContent content={regulation.content} maxHeight="16rem" />

// Truncated preview
<RegulationContent content={regulation.content} truncateAt={500} heading="Content Preview" />
```

### RegulationQuickStats

Inline badges for quick overview:

```tsx
import { RegulationQuickStats } from '@/components/regulations';

<RegulationQuickStats regulation={document} />
```

---

## Shared Review Form Components

### ReviewForm

Generic review form used by RedFlagReviewForm and ComplianceIssueReviewForm:

```tsx
import { ReviewForm } from '@/components/review';

<ReviewForm
  itemType="red_flag"  // or "compliance_issue"
  item={flag}
  onUpdated={handleUpdated}
  onSubmit={updateRedFlagReview}
/>
```

### useReviewForm Hook

Shared state management for review forms:

```tsx
import { useReviewForm } from '@/hooks';

const { formData, updateField, isEditing, setIsEditing, isPending, error, handleSubmit } =
  useReviewForm({
    initialData: item,
    onSubmit: updateRedFlagReview,
    onUpdated: handleUpdated,
  });
```

---

## Shared Card Components

Located in `components/review/shared/`:

### CardWrapper

Focus-aware card wrapper:

```tsx
import { CardWrapper } from '@/components/review/shared';

<CardWrapper id={`flag-${flag.id}`} isFocused={isFocused} ref={ref}>
  {children}
</CardWrapper>
```

### RegulationContext

Regulation citation and title display:

```tsx
import { RegulationContext } from '@/components/review/shared';

<RegulationContext regulation={flag.regulation} className="mb-4" />
```

### CardFormError

Form error message:

```tsx
import { CardFormError } from '@/components/review/shared';

<CardFormError error={error} />
```

### CardActions

Submit and View Regulation buttons:

```tsx
import { CardActions } from '@/components/review/shared';

<CardActions
  onViewRegulation={() => handleViewRegulation(id)}
  isPending={isPending}
  submitLabel="Save Review"
/>
```

---

## Shared Queue Components

### QueuePagination

Pagination controls:

```tsx
import { QueuePagination } from '@/components/review/shared';

<QueuePagination pagination={pagination} onPageChange={goToPage} />
```

### QueueResultsInfo

"Showing X-Y of Z items" display:

```tsx
import { QueueResultsInfo } from '@/components/review/shared';

<QueueResultsInfo
  pagination={pagination}
  currentCount={items.length}
  itemLabel="flags"
  showKeyboardHint
/>
```

### QueueEmptyState

Empty state for queues:

```tsx
import { QueueEmptyState } from '@/components/review/shared';

<QueueEmptyState
  title="No flags found"
  description="Try adjusting your filters."
/>
```

### useQueueNavigation Hook

Keyboard navigation for queues (j/k navigation, focus management):

```tsx
import { useQueueNavigation } from '@/hooks';

const { focusedIndex, setCardRef, handleKeyDown, currentItem } = useQueueNavigation({
  items: flags,
  getItemId: (f) => `flag-${f.id}`,
  onViewRegulation: (f) => setSelectedId(f.regulation.id),
  findNextUnreviewed: (idx) => flags.findIndex((f, i) => i > idx && !f.reviewStatus),
});

useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleKeyDown]);
```

---

## Files Structure

```
apps/web/src/
├── styles/
│   └── tokens.css          # Design token definitions
├── app/
│   ├── globals.css         # Base styles, imports tokens
│   ├── layout.tsx          # Root layout with Header/Footer
│   ├── page.tsx            # Home dashboard page
│   └── [state]/
│       ├── page.tsx        # State table view
│       ├── browse/
│       │   └── page.tsx    # Browse hierarchy page
│       └── review/
│           └── page.tsx    # Review mode page
├── hooks/
│   ├── useMediaQuery.ts    # SSR-safe media query hook
│   ├── useResponsive.ts    # Breakpoint detection
│   ├── useStateFromPath.ts # Extract state (ny/nj) from URL path
│   ├── useReviewerName.ts  # Persist reviewer name in localStorage
│   ├── useDeepLink.ts      # Deep link navigation for review items
│   └── index.ts
├── components/
│   ├── ui/                 # Reusable UI primitives
│   │   ├── Alert.tsx       # Error/warning/success/info messages
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── CopyLinkButton.tsx # Copy deep link to clipboard
│   │   ├── Drawer.tsx      # Mobile-friendly slide-in panel
│   │   ├── Input.tsx
│   │   ├── LevelBadge.tsx  # Hierarchy level badges
│   │   ├── Modal.tsx       # Radix Dialog wrapper
│   │   ├── ResizableDivider.tsx # Draggable panel divider
│   │   ├── SearchInput.tsx # Search with debounce, clear, loading
│   │   ├── Select.tsx      # Radix Select wrapper
│   │   ├── Tag.tsx         # Labels, keywords, matched phrases
│   │   ├── Textarea.tsx
│   │   └── index.ts
│   ├── layout/             # Layout components
│   │   ├── Header.tsx      # Responsive with mobile menu
│   │   ├── Footer.tsx
│   │   ├── Container.tsx
│   │   ├── PageHeader.tsx
│   │   ├── MobileNav.tsx   # Mobile navigation drawer
│   │   └── index.ts
│   ├── home/               # Home dashboard components
│   │   ├── DashboardStats.tsx
│   │   ├── StateCard.tsx
│   │   ├── QuickLinks.tsx
│   │   └── index.ts
│   ├── browse/             # Browse hierarchy components
│   │   ├── BrowseClient.tsx    # Main responsive container
│   │   ├── HierarchyTree.tsx
│   │   ├── DetailPanel.tsx     # Supports fullScreen mode
│   │   └── index.ts
│   └── review/             # Review mode components
│       ├── ReviewQueue.tsx
│       ├── ReviewCard.tsx
│       ├── ReviewFilters.tsx
│       ├── ReviewProgress.tsx
│       ├── ReviewKeyboardNav.tsx
│       ├── RegulationModal.tsx
│       └── index.ts
├── lib/
│   ├── actions/
│   │   ├── types.ts        # ActionResult type and helpers
│   │   ├── dashboard.ts    # Dashboard stats server actions
│   │   ├── hierarchy.ts    # Hierarchy navigation
│   │   ├── regulations.ts
│   │   ├── red-flags.ts
│   │   ├── compliance-issues.ts
│   │   ├── developer.ts    # Developer mode actions
│   │   └── document-notes.ts
│   ├── url/
│   │   ├── parsers.ts      # nuqs query param parsers
│   │   └── index.ts
│   ├── constants/
│   │   └── hierarchy.ts    # Hierarchy level labels
│   ├── format.ts           # Shared formatting utilities
│   └── formatters/
│       └── nycrr.ts        # NYCRR citation formatting
├── types/
│   └── regulation.ts       # Constants, helpers, types
└── tailwind.config.ts      # Extended Tailwind theme
```

---

## Dependencies

- **Radix UI**: Accessible primitives
  - `@radix-ui/react-dialog` (Modal)
  - `@radix-ui/react-select` (Select)
- **TanStack Table**: Data table functionality
- **Google Fonts**: Inter, JetBrains Mono

---

## Accessibility Considerations

1. **Color contrast**: All text meets WCAG AA standards
2. **Focus indicators**: Visible on all interactive elements
3. **Keyboard navigation**: Full support for tab, arrow keys, escape
4. **Screen readers**: Proper ARIA labels and roles
5. **Motion**: Respects `prefers-reduced-motion`
6. **Focus trapping**: Modal traps focus appropriately

---

## Component Guidelines

### When Adding New Components

1. **Check existing components first**: Reuse existing UI primitives from `components/ui/`
2. **Use design tokens**: Always use CSS custom properties, never hardcoded colors
3. **Keep components atomic**: Single responsibility, composable
4. **Update this guide**: Document new components and their usage
5. **Follow naming conventions**: PascalCase for components, camelCase for props

### DRY Principles

- Extract repeated patterns into reusable components
- Use composition over duplication
- Share common styles through design tokens
- Create utility components for common layouts

---

## Mobile Responsive Patterns

### Breakpoints

The application uses a mobile-first approach with the following breakpoints:

| Breakpoint | Min Width | Tailwind Prefix | Usage |
|------------|-----------|-----------------|-------|
| Mobile | 0px | (default) | Single column, stacked layouts |
| Tablet | 768px | `md:` | Side-by-side layouts, wider forms |
| Desktop | 1024px | `lg:` | Full multi-column layouts |

### useResponsive Hook

SSR-safe hook for detecting viewport size:

```tsx
import { useResponsive, useMediaQuery } from '@/hooks';

function MyComponent() {
  const { isMobile, isTablet, isDesktop, isMobileOrTablet, isTabletOrDesktop } = useResponsive();

  // Or use custom query
  const isLargeScreen = useMediaQuery('(min-width: 1280px)');

  return isMobile ? <MobileView /> : <DesktopView />;
}
```

**Note**: Initial render returns `false` to avoid hydration mismatch. Use conditional rendering carefully.

### Drawer Component

Mobile-friendly slide-in panel based on Radix Dialog:

```tsx
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui';

<Drawer open={isOpen} onOpenChange={setIsOpen}>
  <DrawerContent side="right" size="full">
    <DrawerHeader>
      <DrawerTitle>Panel Title</DrawerTitle>
      <DrawerClose />
    </DrawerHeader>
    <DrawerBody>
      {/* Content */}
    </DrawerBody>
  </DrawerContent>
</Drawer>
```

| Prop | Values | Default | Description |
|------|--------|---------|-------------|
| `side` | `left`, `right`, `bottom` | `right` | Slide-in direction |
| `size` | `sm`, `md`, `lg`, `full` | `md` | Panel width/height |

### Mobile Navigation

The Header component includes responsive navigation:

- **Desktop**: Horizontal nav links visible (`hidden md:flex`)
- **Mobile**: Hamburger menu button (`md:hidden`) opens MobileNav drawer

```tsx
// MobileNav includes:
// - Full-height right-side drawer
// - State selector (NY/NJ toggle)
// - Large tap-target nav links (min 44px)
// - Close button
```

### Browse View Pattern

The Browse page uses a drawer pattern for mobile and resizable panels on desktop:

- **Desktop**: Side-by-side with resizable divider (default 400px tree, flex detail panel)
- **Mobile**: Tree full-width, detail panel slides in as drawer when item selected

```tsx
<div ref={containerRef} className="flex flex-col lg:flex-row gap-4 lg:gap-0">
  {/* Tree - resizable width on desktop */}
  <div style={isMobile ? undefined : { width: panelWidth }}>
    <Card className="h-[50vh] lg:h-[calc(100vh-16rem)]">
      <HierarchyTree />
    </Card>
  </div>

  {/* Resizable divider - desktop only */}
  {!isMobile && (
    <ResizableDivider
      onResize={handlePanelResize}
      onResizeEnd={handlePanelResizeEnd}
      onReset={handlePanelReset}
    />
  )}

  {/* Detail - drawer on mobile, side panel on desktop */}
  {isMobile ? (
    <Drawer open={!!selectedId}>
      <DetailPanel fullScreen />
    </Drawer>
  ) : (
    <div className="flex-1"><DetailPanel /></div>
  )}
</div>
```

Panel width persists to localStorage and respects min/max constraints.

### Touch Targets

All interactive elements should have a minimum touch target of 44x44px:

```tsx
<button className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
  <Icon className="w-5 h-5" />
</button>
```

### Responsive Grid Patterns

Common responsive grid patterns:

```tsx
// 1-2-4 column progression
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// 1-2 column for cards
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// 1-3 column for action cards
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
```

---

## Home Page Components

### DashboardStats

Grid of stat cards showing aggregate metrics:

```tsx
import { DashboardStats } from '@/components/home';

<DashboardStats stats={{
  totalDocuments: 1000,
  analyzedDocuments: 500,
  documentsWithFlags: 100,
  totalFlags: 250,
  flagsBySeverity: { high: 50, medium: 100, low: 100 },
  unreviewedFlags: 200,
}} />
```

Displays 2 columns on mobile, 4 columns on desktop.

### StateCard

Clickable card for state selection:

```tsx
import { StateCard } from '@/components/home';

<StateCard state="ny" stats={nyStats} />
<StateCard state="nj" stats={njStats} />
```

Features:
- State abbreviation badge with accent color
- Document count and flag stats
- Hover state with shadow elevation

### QuickLinks

Grid of quick action cards:

```tsx
import { QuickLinks } from '@/components/home';

<QuickLinks state="ny" />
```

Links to:
- Browse Hierarchy
- Review Queue
- Table View

---

## Usage Examples

### Button Usage

```tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="md">Submit</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost" size="sm" onClick={handleEdit}>Edit</Button>
<Button variant="danger" isLoading={isPending}>Delete</Button>
```

### Badge Usage

```tsx
import { Badge, SeverityBadge, ReviewStatusBadge } from '@/components/ui/Badge';

<Badge variant="success">Active</Badge>
<SeverityBadge severity={8} />  // Shows "HIGH" in red
<ReviewStatusBadge status="confirmed" />  // Shows "Confirmed" in green
```

### Modal Usage

```tsx
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose,
} from '@/components/ui/Modal';

<Modal open={isOpen} onOpenChange={setIsOpen}>
  <ModalContent size="lg">
    <ModalHeader>
      <ModalTitle>Edit Item</ModalTitle>
      <ModalClose />
    </ModalHeader>
    <ModalBody>
      {/* Content */}
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost">Cancel</Button>
      <Button variant="primary">Save</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### Using Design Tokens

```tsx
// In Tailwind classes
<div className="bg-[var(--color-primary)] text-white">
  Primary background
</div>

<span className="text-[var(--color-text-secondary)]">
  Secondary text
</span>

// In CSS
.custom-element {
  background: var(--color-surface);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
```
