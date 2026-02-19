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

### OutcomeBadges

Canonical component for compliance issue outcome display. Use this instead of inline badge logic in any card showing compliance issue outcomes.

```tsx
import { OutcomeBadges } from '@/components/issues';

<OutcomeBadges
  analysis={issue.analysis}
  requirementFound={issue.requirementFound}
  requiredByStatute={issue.requiredByStatute}
  severity={issue.severity}
  originalSeverity={issue.originalSeverity}
  showTierBadge
  showFinalClassification
  showFederalMandate
  showEasyCleanup
  showSeverity
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `analysis` | `TierAnalysis \| null` | required | Pipeline analysis data |
| `requirementFound` | `boolean \| null` | required | LLM confirmed/rejected |
| `requiredByStatute` | `boolean \| null` | required | From statute badge |
| `severity` | `number \| null` | required | Current severity |
| `originalSeverity` | `number \| null` | required | Original severity (shows override hint when different) |
| `showTierBadge` | `boolean` | `true` | Show tier completion badge |
| `showFinalClassification` | `boolean` | `true` | Show terminal classification (burdensome/justified/etc.) |
| `showFederalMandate` | `boolean` | `true` | Show federal mandate badge |
| `showEasyCleanup` | `boolean` | `true` | Show easy cleanup badge |
| `showSeverity` | `boolean` | `true` | Show severity badge |

**Badge rendering order**: Final Classification, LLM Confirmed/Rejected, From Statute, Severity (with override), Tier Badge, Federal Mandate, Easy Cleanup.

**Used by**: Review Card Header, ComplianceIssueDisplayCard, Developer Card ComplianceIssueContent.

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

### SectionTypeBadge

Badge for displaying AI-generated section types:

```tsx
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';

<SectionTypeBadge type="definitions" />
<SectionTypeBadge type="requirements" compact />
<SectionTypeBadge type={document.sectionType} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string \| null` | - | Section type category |
| `compact` | `boolean` | `false` | Show abbreviated label |

Section type categories (13): `definitions`, `requirements`, `procedures`, `prohibitions`, `standards`, `eligibility`, `penalties`, `fees`, `forms`, `reporting`, `scope`, `exemptions`, `reserved`

Each type has a unique color scheme for quick visual identification.

### KeywordTags

Display array of keywords with overflow handling:

```tsx
import { KeywordTags } from '@/components/ui/KeywordTags';

<KeywordTags keywords={['licensing', 'fees', 'application']} />
<KeywordTags keywords={keywords} maxDisplay={2} size="sm" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `keywords` | `string[] \| null` | - | Array of keywords |
| `maxDisplay` | `number` | `3` | Max tags before "+N" |
| `size` | `'sm' \| 'md'` | `'sm'` | Tag size |

### MetadataIndicators

Icons for form references and external standards:

```tsx
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';

<MetadataIndicators hasForm hasIbr />
<MetadataIndicators hasForm={document.hasForm} hasIbr={document.hasIbr} size="md" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hasForm` | `boolean \| null` | - | Show form reference icon |
| `hasIbr` | `boolean \| null` | - | Show external standards icon |
| `size` | `'sm' \| 'md'` | `'sm'` | Icon size |

- Form reference: indigo FileText icon
- External standards (IBR): green ExternalLink icon

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

### Term Highlighting

Highlights defined terms in regulation text with clickable popover definitions.

**CSS Classes** (defined in `globals.css`):
```css
.term-highlight {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--color-info);
  text-underline-offset: 2px;
  cursor: pointer;
}
.term-highlight:hover {
  text-decoration-style: solid;
  background-color: var(--color-info-bg);
}
```

**Components**:

`useTermHighlighting` hook - finds term occurrences in content:
```tsx
import { useTermHighlighting } from '@/hooks';

const termMatches = useTermHighlighting(content, applicableDefinitions);
// Returns: TermMatch[] with { term, startOffset, endOffset, definition }
```

`DefinitionPopover` - shows definition on term click:
```tsx
import { DefinitionPopover } from '@/components/definitions';

<DefinitionPopover
  definition={selectedTerm.definition}
  term={selectedTerm.term}
  anchorRect={selectedTerm.rect}
  onClose={() => setSelectedTerm(null)}
  state="ny"
/>
```

Features:
- Dotted underline style (distinct from note highlights which use yellow background)
- Click to show definition popover (not hover)
- Popover shows: term, scope badge, definition text, "View source" link
- Keyboard accessible (Tab to focus, Enter/Space to open)
- Close on click outside or Escape key
- Notes take priority when highlighting overlaps

---

## Content Type Visual Language

A consistent visual vocabulary for distinguishing content types across the application — used on search results, review pages, pipeline views, and analytics.

### Primary Result Types

| Type | Icon | Badge Variant | Usage |
|------|------|--------------|-------|
| Regulation | `FileText` | `default` (gray) | Search result cards, browse views |
| Statute | `Scale` | `default` (gray) | Search result cards, statute browse |

### Commentary Hit Types

| Type | Icon | Badge Variant | Usage |
|------|------|--------------|-------|
| Analysis | `MessageSquare` | `default` | Commentary sidebar (search) |
| Definition | `BookOpen` | `default` | Commentary sidebar (search) |

### Classification (Analysis Outcome)

Always rendered as a `Badge`. Used in review pages (`OutcomeBadges`), pipeline views (`TierClassificationFlow`), search results, and analytics charts.

| Classification | Badge Variant | Color | Meaning |
|----------------|--------------|-------|---------|
| `burdensome` | `warning` | Orange | Regulation imposes unnecessary burden |
| `justified` | `success` | Green | Requirement is reasonable/necessary |
| `unrelated` | `default` | Gray | Not actually a compliance issue |

### Severity Display

Always rendered as a colored dot (8×8px `rounded-full`) + numeric score. Color thresholds from `SEVERITY_THRESHOLDS` in `lib/constants/values.ts`:

| Level | Threshold | Dot Color | CSS Variable |
|-------|-----------|-----------|-------------|
| High | `>= 7` | Red | `--color-danger` |
| Medium | `>= 4` | Orange | `--color-warning` |
| Low | `>= 1` | Green | `--color-success` |

Same pattern used by `SeverityBadge` on detail pages.

### Special Indicator Badges

Conditional badges shown alongside analysis metadata:

| Indicator | Badge Variant | When Shown |
|-----------|--------------|------------|
| Federal Mandate | `info` (blue) | `federal_mandate_found = true` |
| Easy Cleanup | `success` (green) | `easy_cleanup_category IS NOT NULL` |
| "X issues" | plain text | `issueCount > 0` on regulation search results |
| Not Analyzed | *(no badge)* | Regulation with 0 issues — clean card |

### Consistency

These mappings are canonical. Reuse them in any new page that displays classification, severity, or content type information. Existing usage:

- **Review pages**: `OutcomeBadges` renders classification + severity + federal mandate + easy cleanup
- **Pipeline tab**: `TierClassificationFlow` uses same classification colors
- **Analytics**: Chart colors match classification badge colors via `lib/constants/pipeline.ts`
- **Search page**: Result cards + commentary sidebar follow this vocabulary

---

## Shared Data Display Components

### StatCard + StatGrid

Display statistics in a consistent card format with icon and variant styling:

```tsx
import { StatCard, StatGrid } from '@/components/ui';
import { FileText, AlertTriangle, CheckCircle } from 'lucide-react';

// Grid layout for multiple stat cards
<StatGrid columns={4}>
  <StatCard
    label="Total Documents"
    value={1000}
    icon={FileText}
    variant="default"
  />
  <StatCard
    label="High Severity"
    value={50}
    icon={AlertTriangle}
    variant="danger"
  />
  <StatCard
    label="Reviewed"
    value={750}
    icon={CheckCircle}
    variant="success"
    subtitle="75% complete"
  />
</StatGrid>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Description of the stat |
| `value` | `number \| string` | required | The statistic value |
| `icon` | `LucideIcon` | required | Icon component |
| `variant` | `'default' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `'default'` | Color variant |
| `subtitle` | `string` | - | Optional subtitle text |
| `className` | `string` | `''` | Additional CSS classes |

**StatGrid Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `2 \| 3 \| 4` | `4` | Number of columns |
| `children` | `ReactNode` | required | StatCard components |
| `className` | `string` | `''` | Additional CSS classes |

### Pagination

Pagination controls with page numbers and optional item count:

```tsx
import { Pagination } from '@/components/ui';

<Pagination
  page={currentPage}
  totalPages={10}
  onPageChange={(page) => setPage(page)}
  total={100}
  pageSize={10}
  showItemCount
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `page` | `number` | required | Current page number |
| `totalPages` | `number` | required | Total number of pages |
| `onPageChange` | `(page: number) => void` | required | Callback when page changes |
| `total` | `number` | - | Total item count (for "Showing X-Y of Z") |
| `pageSize` | `number` | - | Items per page |
| `showItemCount` | `boolean` | `false` | Show "Showing X-Y of Z" text |
| `size` | `'sm' \| 'md'` | `'md'` | Button size |
| `className` | `string` | `''` | Additional CSS classes |

### ProgressCard

Card showing progress with a bar and status breakdown:

```tsx
import { ProgressCard } from '@/components/ui';

<ProgressCard
  title="Review Progress"
  completed={75}
  total={100}
  completedLabel="reviewed"
  barColor="primary"
  statuses={[
    { label: 'Unreviewed', count: 25, variant: 'neutral' },
    { label: 'Confirmed', count: 50, variant: 'success' },
    { label: 'Corrected', count: 15, variant: 'warning' },
    { label: 'False Positive', count: 10, variant: 'muted' },
  ]}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Card title |
| `completed` | `number` | required | Number of completed items |
| `total` | `number` | required | Total number of items |
| `completedLabel` | `string` | `'completed'` | Label for completed count |
| `barColor` | `'primary' \| 'success'` | `'primary'` | Progress bar color |
| `statuses` | `StatusItem[]` | required | Status breakdown |
| `className` | `string` | `''` | Additional CSS classes |

**StatusItem**:
```tsx
interface StatusItem {
  label: string;
  count: number;
  variant: 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'muted';
}
```

### FilterBar System

Composable filter bar with consistent layout, sort controls, and clear button:

```tsx
import { FilterBar, FilterField, SortControls, ClearFiltersButton } from '@/components/ui';
import { Select } from '@/components/ui';

<FilterBar
  variant="panel"  // 'default' | 'panel' (adds background)
  className="mb-4"
>
  <FilterField label="Status" htmlFor="status-filter">
    <Select id="status-filter" value={status} onChange={setStatus}>
      <option value="all">All</option>
      <option value="unreviewed">Unreviewed</option>
    </Select>
  </FilterField>

  <FilterField label="Severity" htmlFor="severity-filter">
    <Select id="severity-filter" value={severity} onChange={setSeverity}>
      <option value="all">All</option>
      <option value="high">High</option>
    </Select>
  </FilterField>

  <SortControls
    sortBy={sortBy}
    sortOrder={sortOrder}
    sortOptions={[
      { value: 'severity', label: 'Severity' },
      { value: 'createdAt', label: 'Date' },
    ]}
    onSortByChange={setSortBy}
    onSortOrderToggle={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
  />

  <ClearFiltersButton
    hasActiveFilters={hasActiveFilters}
    onClear={handleClearFilters}
  />
</FilterBar>
```

**FilterBar Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'panel'` | `'default'` | Visual variant (panel adds background) |
| `children` | `ReactNode` | required | Filter fields and controls |
| `className` | `string` | `''` | Additional CSS classes |

**FilterField Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Field label |
| `htmlFor` | `string` | required | ID of the associated input |
| `children` | `ReactNode` | required | Input element |
| `className` | `string` | `''` | Additional CSS classes |

**SortControls Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sortBy` | `string` | required | Current sort field |
| `sortOrder` | `'asc' \| 'desc'` | required | Current sort order |
| `sortOptions` | `Array<{ value: string; label: string }>` | required | Available sort options |
| `onSortByChange` | `(value: string) => void` | required | Sort field change handler |
| `onSortOrderToggle` | `() => void` | required | Sort order toggle handler |

**ClearFiltersButton Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hasActiveFilters` | `boolean` | required | Whether filters are active |
| `onClear` | `() => void` | required | Clear handler |

### SegmentedControl

Tab-like or toggle-like control for switching between options:

```tsx
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import { BarChart3, List, Table, LayoutGrid } from 'lucide-react';

// Filled variant (tab-like)
const TABS: SegmentedControlOption<'overview' | 'details'>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'details', label: 'Details', icon: List },
];

<SegmentedControl
  options={TABS}
  value={activeTab}
  onChange={setActiveTab}
  variant="filled"
/>

// Outlined variant (toggle-like)
const VIEW_OPTIONS: SegmentedControlOption<'table' | 'cards'>[] = [
  { value: 'table', label: 'Table', icon: Table },
  { value: 'cards', label: 'Cards', icon: LayoutGrid },
];

<SegmentedControl
  options={VIEW_OPTIONS}
  value={viewMode}
  onChange={setViewMode}
  variant="outlined"
  size="sm"
  role="radiogroup"
/>

// With badge counts
const REVIEW_TABS: SegmentedControlOption<'flags' | 'issues'>[] = [
  { value: 'flags', label: 'Red Flags', badge: 25, badgeVariant: 'danger' },
  { value: 'issues', label: 'Issues', badge: 10, badgeVariant: 'warning' },
];

<SegmentedControl options={REVIEW_TABS} value={type} onChange={setType} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `SegmentedControlOption<T>[]` | required | Available options |
| `value` | `T` | required | Currently selected value |
| `onChange` | `(value: T) => void` | required | Change handler |
| `variant` | `'filled' \| 'outlined'` | `'filled'` | Visual style |
| `size` | `'sm' \| 'md'` | `'md'` | Control size |
| `role` | `'tablist' \| 'radiogroup'` | `'tablist'` | ARIA role |
| `className` | `string` | `''` | Additional CSS classes |

**SegmentedControlOption**:
```tsx
interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: 'default' | 'danger' | 'warning' | 'info';
}
```

**Variant Differences**:
- `filled`: Gray background container, white active segment with shadow (tab-like)
- `outlined`: Border container, primary blue active segment (toggle-like)

### GlobalSearch

Global search bar component in the header (desktop only, mobile via nav drawer).

**Location:** `components/layout/GlobalSearch.tsx`

**Behavior:**
- Default state: Pill-shaped button with search icon, "Search {STATE} regulations...", and Cmd+K badge
- Shows the current state abbreviation (e.g., "NJ") so users know which state they're searching
- On click or Cmd+K/Ctrl+K: Inline text input with focus
- On Enter: Navigates to `/${state}/search?q=${query}`
- On Escape or empty blur: Collapses back to button
- Styling: `bg-neutral-100`, `border-neutral-200`, subtle hover states

### SearchResultCard

Card component for individual search results on the search results page.

**Location:** `components/search/SearchResultCard.tsx`

**Structure:**
- Type icon (FileText for regulations, Scale for statutes) + linked title + type badge
- Hierarchy breadcrumb (truncated)
- Snippet with `<mark>` highlights (sanitized via `sanitizeSnippet()`)
- Citation + SectionTypeBadge metadata chips
- **Analysis metadata row** (regulation results with `issueCount > 0` only):
  - Severity dot (8px, color per thresholds) + "X issues" count
  - "Y burdensome" Badge (`variant="warning"`) if burdensomeCount > 0
  - "Federal Mandate" Badge (`variant="info"`) if true
  - "Easy Cleanup" Badge (`variant="success"`) if easyCleanupCount > 0
- No analysis row for statute results or regulations with 0 issues

### CommentarySidebar

Collapsible sidebar showing flat, self-descriptive analysis and definition hit cards.

**Location:** `components/search/CommentarySidebar.tsx`

**Structure:**
- Toggle button with chevron + hit count
- Flat list of `CommentaryHitCard` components (not grouped by document)
- Each card contains:
  - **Badge row** (analysis only): Classification badge + severity dot/score
  - **Primary label**: Icon + "Analysis: {issueType} in {documentTitle}" or "Definition: {term}"
  - **Snippet**: `<mark>`-highlighted text from `ts_headline`
  - **Footer**: "View regulation" link (analysis) or citation (definition)
- Analysis cards link to `/{state}/pipeline/{docId}/{issueType}#matches`
- Definition cards link to `/{state}/regulations/{docId}?highlight={term}`
- Collapsed state: `w-10`, expanded: `w-80`
- Hidden on mobile (`hidden lg:block`)
- Respects active filters (classification, hasAnalysis) — filtered server-side

### SearchFilters

Filter bar for search results with dropdown selects.

**Location:** `components/search/SearchFilters.tsx`

**Filters:** Section type, hierarchy level, document type, analysis status ("Analyzed" / "Not analyzed"), classification ("Burdensome" / "Justified" / "Unrelated") — uses `Select` component. Analysis-related filters auto-exclude statutes from results.

### FullTextSearchLink

Inline link that navigates to the full-text search page, shown in table/browse/glossary views.

**Location:** `components/ui/FullTextSearchLink.tsx`

**Behavior:**
- Always visible (not conditional on current filter query)
- Shows "Full-text search" when no query, "Search full text" when query is active
- Optionally pre-fills the search query from the current filter
- Uses `Search` icon (w-3 h-3) inline with text

### ScrollToHash

Utility client component that scrolls to the URL hash fragment on mount.

**Location:** `components/ui/ScrollToHash.tsx`

**Usage:** Drop into any page that needs hash-based scroll targeting (e.g., `#matches` on pipeline detail pages). Uses `requestAnimationFrame` with 150ms delay to wait for content render.

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

### Navigation Helpers

Components for navigating long/content-heavy pages and sidebars. Located in `src/components/navigation/`.

#### `SidebarSectionIndex`

Compact pill-based jump nav pinned at the top of a sidebar's scroll container. Used on regulation and statute detail sidebars.

- **Props:** `sections: SectionConfig[]`, `children: ReactNode`
- **Behavior:** Sticky within sidebar, highlights active section via IntersectionObserver, hidden on mobile (`hidden lg:block`)
- **Active pill:** `bg-[var(--color-primary-weak)] text-[var(--color-primary)]`
- **When to use:** Two-column layouts where the sidebar has 3+ sections

#### `StickyPageSectionTabs`

Horizontal tab bar for navigating long single-column pages. Used on the pipeline analysis detail page.

- **Props:** `sections: SectionConfig[]`, `scrollOffset?: number` (default: 120)
- **Behavior:** Active tab highlighted with solid primary pill, roving tabindex keyboard navigation, horizontally scrollable on mobile
- **Active tab:** `bg-[var(--color-primary)] text-white`
- **When to use:** Single-column pages taller than ~3000px with distinct sections

#### `useActiveSection` hook

Shared IntersectionObserver hook used by both navigation components.

- **Signature:** `useActiveSection(sectionIds: string[], options?: { rootMargin?: string; threshold?: number }): string | null`
- **Returns:** The `id` of the topmost currently-intersecting section
- **Location:** `src/hooks/useActiveSection.ts`

#### `SectionConfig` type

```typescript
interface SectionConfig {
  id: string;      // DOM element id
  label: string;   // Display label
  count?: number;  // Optional count badge
}
```

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

Decomposed red flag review card (5 sub-components in `ReviewCard/` directory):

**Sub-components:**
- `Header` — Category label, severity/complexity/effort badges, review status
- `LLMAnalysisSection` — Blue box with "Why Flagged" explanation, text examples (quoted), implementation approach, effort estimate
- `RegulationActions` — View page button, Cornell link, regulation text viewer, hierarchy tree
- `ReviewForm` — Status, priority, impact, reviewer, justification/team notes, save button
- `SiblingSectionsView` (shared) — Lazy-loaded collapsible showing sibling sections under same parent

**Features:**
- Displays flag category, severity badge, complexity badge, effort estimate badge
- Shows parent regulation title and NYCRR citation with hierarchy breadcrumbs
- LLM Analysis blue box with explanation + text examples + implementation approach
- Matched phrases in collapsible "Technical Details" section
- Regulation actions (view page, Cornell link, text viewer, tree) in dedicated section above form
- Sibling sections view for regulatory area context
- Always-visible review form (status, priority, impact type, reviewer, notes)
- Supports keyboard navigation focus state

```tsx
import { ReviewCard } from '@/components/review';

<ReviewCard
  flag={flag}
  onUpdated={handleFlagUpdated}
  onViewRegulation={handleViewRegulation}
  isFocused={index === focusedIndex}
  state="ny"
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

## Review Queue Workflow Modes

The review interface supports two distinct workflow patterns for reviewing compliance issues:

### Filter Mode (Manual Queue)

**URL**: `/[state]/review?type=compliance&queueMode=filter&reviewStatus=unreviewed`

Filter mode provides a traditional paginated list that automatically refreshes:

- **Paginated list**: Shows items matching the current filter criteria (e.g., unreviewed items)
- **Auto-replacement**: When an item is reviewed and no longer matches the filter, it's removed and replaced with the next item from the queue
- **Count stays constant**: The visible count remains at page size (10) until the queue is exhausted
- **Sequential workflow**: Designed for working through a backlog methodically
- **Filter-aware updates**: Uses `statusFilter` option in `useQueue` hook to remove items that no longer match

```tsx
// In ComplianceReviewQueue.tsx
const [reviewStatus] = useQueryState('reviewStatus', reviewStatusParser);

const filterQueue = useQueue<ComplianceIssueWithContext, ComplianceIssueStatusCounts>({
  initialItems: filterProps.initialIssues,
  initialCounts: statusCounts,
  getItemId: (i) => i.id,
  getItemStatus: (i) => i.reviewStatus || 'unreviewed',
  defaultStatus: 'unreviewed',
  getRegulationId: (i) => i.regulation.id,
  statusFilter: reviewStatus || 'unreviewed',  // Items removed when status doesn't match
});
```

### Smart Suggestions Mode (Batch Queue)

**URL**: `/[state]/review?type=compliance&queueMode=suggestion`

Smart suggestions mode provides focused batch review:

- **Batch-based**: Loads discrete batches of items (configurable: 2-5 items)
- **Items stay visible**: Reviewed items remain visible in the current batch
- **Explicit next batch**: User manually requests the next batch when ready
- **Grouped suggestions**: Can group by issue type, section, or pattern for focused review
- **Preserves context**: See related items together for consistent decisions

```tsx
// In ComplianceReviewQueue.tsx (suggestion mode)
const suggestionQueue = useSuggestionQueue({
  initialBatch: suggestionProps.initialBatch,
  initialCounts: statusCounts,
  batchSize: suggestionProps.batchSize,
  state: suggestionProps.state,
  groupingMode: suggestionProps.groupingMode,
});
```

### Choosing the Right Mode

| Use Case | Recommended Mode |
|----------|------------------|
| Processing a backlog of items | Filter Mode |
| Focused review of similar items | Smart Suggestions |
| Quick triage of many items | Filter Mode |
| Consistent decisions on related issues | Smart Suggestions |
| Mobile/tablet review | Filter Mode (simpler UI) |

### Implementation Details

Both modes use the `useQueue` hook but with different behaviors:

1. **Filter Mode**: Passes `statusFilter` option, causing items to be removed when their status changes
2. **Suggestion Mode**: Uses `useSuggestionQueue` which explicitly manages batch state and doesn't auto-remove items

The key code path in `useQueue.ts`:

```typescript
// In handleItemUpdated:
if (oldStatus !== newStatus) {
  // Update counts...

  // Remove item if it no longer matches the filter
  if (statusFilter && statusFilter !== 'all' && newStatus !== statusFilter) {
    return prevItems.filter((item) => getItemId(item) !== updatedId);
  }
}
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
import { SEVERITY_THRESHOLDS } from '@/types/regulation';
import { SeverityBadge } from '@/components/ui';

// SEVERITY_THRESHOLDS = { HIGH: 7, MEDIUM: 4, LOW: 1 }
// SeverityBadge maps severity to Badge variant internally:
// severity >= 7 → 'danger'
// severity >= 4 → 'warning'
// severity >= 1 → 'success'

<SeverityBadge severity={flag.severity} />
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

### Type-Safe Select → nuqs Bridge

Radix Select's `onValueChange` returns `string`, but nuqs setters expect narrow union types (e.g., `'high' | 'medium' | 'low'`). Use `typedValue` to bridge the gap without `as any`:

```tsx
import { typedValue } from '@/lib/url/type-helpers';
import type { SeverityValue } from '@/lib/url/parsers';

// Before (unsafe):
onValueChange={(value) => setFilters({ severity: value as any, page: 1 })}

// After (type-safe):
onValueChange={typedValue<SeverityValue>((value) => setFilters({ severity: value, page: 1 }))}
```

The cast is safe because the Select's `options` prop constrains the possible values at runtime.

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
│       ├── statutes/
│       │   └── page.tsx    # Browse statute hierarchy page
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
│   │   ├── RecentActivityCard.tsx
│   │   ├── TopIssuesChart.tsx
│   │   ├── StateCard.tsx
│   │   ├── QuickLinks.tsx
│   │   └── index.ts
│   ├── browse/             # Browse hierarchy components
│   │   ├── BrowseClient.tsx    # Main responsive container
│   │   ├── HierarchyTree.tsx
│   │   ├── DetailPanel.tsx     # Supports fullScreen mode
│   │   └── index.ts
│   ├── definitions/        # Definitions glossary components
│   │   ├── DefinitionCard.tsx      # Single definition display
│   │   ├── AggregatedTermCard.tsx  # Grouped term with expandable variants
│   │   ├── DefinitionsList.tsx     # Collapsible list for regulation pages
│   │   ├── GlossarySearch.tsx      # Search + A-Z filter bar
│   │   ├── GlossaryClient.tsx      # Main glossary page with view toggle
│   │   └── index.ts
│   ├── statutes/           # Statute components (links + browse)
│   │   ├── EnablingAuthorityCard.tsx    # Info card for enabling authority
│   │   ├── StatuteLinksList.tsx         # Collapsible grouped statute links
│   │   ├── StatuteBrowseClient.tsx      # Main browse page container
│   │   ├── StatuteHierarchyTree.tsx     # Tree rendering component
│   │   ├── StatuteTreeNode.tsx          # Individual tree node (memo)
│   │   ├── StatuteDetailPanel.tsx       # Detail panel with linked regs
│   │   ├── StatuteBrowseFilters.tsx     # Search + filter controls
│   │   └── index.ts
│   └── review/             # Review mode components
│       ├── ReviewQueue.tsx
│       ├── ReviewCard/          # Decomposed review card (5 sub-components)
│       │   ├── ReviewCard.tsx       # Main orchestrator
│       │   ├── Header.tsx           # Category + badges
│       │   ├── LLMAnalysisSection.tsx # Blue box: explanation + evidence + implementation
│       │   ├── RegulationActions.tsx # View page, Cornell link, text viewer, tree
│       │   ├── ReviewForm.tsx       # Review form with useReviewForm hook
│       │   ├── types.ts            # Shared prop types
│       │   └── index.ts
│       ├── ComplianceIssueCard/     # Decomposed compliance issue card
│       │   └── ... (similar pattern)
│       ├── shared/              # Shared review components
│       │   ├── CardWrapper.tsx
│       │   ├── HierarchyBreadcrumbsInline.tsx
│       │   ├── CornellLink.tsx
│       │   ├── RegulationTextViewer.tsx
│       │   ├── HierarchyTreeView.tsx
│       │   ├── HierarchyTreeNodeCompact.tsx
│       │   ├── SiblingSectionsView.tsx  # Lazy sibling sections display
│       │   └── index.ts
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
│   │   ├── definitions.ts  # Definitions glossary actions
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

Compact 4-card grid showing aggregate metrics with contextual subtitles:

```tsx
import { DashboardStats } from '@/components/home';

<DashboardStats stats={aggregateStats} />
```

Cards: Total Regulations, Analyzed (with % coverage), Compliance Issues (with unreviewed count), Red Flags (with unreviewed count). Displays 2 columns on mobile, 4 columns on desktop.

### RecentActivityCard

Shows activity counts from the last 7 days in a 2x2 grid:

```tsx
import { RecentActivityCard } from '@/components/home';

<RecentActivityCard activity={recentActivity} />
```

Metrics: Issues discovered, Issues reviewed, Flags reviewed, Documents analyzed. Shows "No recent activity" when all counts are zero. Data comes from `getRecentActivity()` server action.

### TopIssuesChart

Horizontal bar chart showing top 6 compliance issue types by count:

```tsx
import { TopIssuesChart } from '@/components/home';

<TopIssuesChart byType={aggregateStats.complianceIssues.byType} />
```

Uses `ChartContainer` + `ClientChart` + `HorizontalBarChart` from the charts system. Labels come from `ISSUE_TYPE_LABELS`. Returns null when no data.

### StateCard

Clickable card for state selection with progress bars:

```tsx
import { StateCard } from '@/components/home';

<StateCard state="ny" stats={nyStats} />
<StateCard state="nj" stats={njStats} />
```

Features:
- State abbreviation badge with accent color
- Two progress bars: "Analyzed X/Y" and "Reviewed X/Y"
- Danger badges for unreviewed flags/issues (only when > 0)
- Hover state with shadow elevation

### QuickLinks

Grid of quick action cards with optional contextual badges:

```tsx
import { QuickLinks } from '@/components/home';

<QuickLinks state="ny" stats={aggregateStats} />
```

Pass `stats` prop to show unreviewed count badge on the Review Queue card. Links to Browse Hierarchy, Review Queue, Analytics, Definitions Glossary, Table View.

---

## Statute Browse Components

Components for browsing the statute hierarchy tree and viewing statute details.

### StatuteBrowseClient

Main client component for the statute browse page. Manages tree state, search, and layout:

```tsx
import { StatuteBrowseClient } from '@/components/statutes';

<StatuteBrowseClient
  state={stateCode}
  initialRoots={roots}
/>
```

Features:
- Resizable tree + detail panel layout (same pattern as `BrowseClient`)
- Mobile drawer for detail panel, desktop side panel
- Lazy-loading children on node expansion
- URL state sync for selected node and expanded nodes
- Search with debounced server-side query
- Panel width persisted to localStorage (`statute-browse-panel-width`)

### StatuteTreeNode

Memo-wrapped tree node for statute hierarchy display:

- Citation in monospace font
- `hierarchyLevel` badge using `STATUTE_HIERARCHY_LEVEL_LABELS`
- Linked regulation count badge ("12 regs") in info color when > 0
- Enabling authority count badge in warning color when > 0
- Muted opacity for statutes without any linked regulations
- Folder icon for container levels (title, chapter, article, law, part), FileText for sections

### StatuteHierarchyTree

Renders the tree of `StatuteTreeNode` components with empty state handling.

### StatuteDetailPanel

Detail panel showing statute information when a node is selected:

- Header with citation and title
- Breadcrumb navigation via `getStatuteAncestorChain`
- Statute text via `RegulationContent` component
- Linked regulations grouped by link type (enabling_authority first)
- Each regulation link navigates to `/{state}/regulations/{regId}`

### StatuteBrowseFilters

Filter bar with URL state via `nuqs`:

- Search input with debounce
- "Has Links" dropdown (All / With Links / Without Links)
- Link type dropdown filter (All / Enabling Authority / Requirement / etc.)

---

## Definitions Components

Components for displaying regulatory definitions extracted from regulations.

### DefinitionCard

Displays a single definition with term, definition text, scope badge, quality indicator, and source link:

```tsx
import { DefinitionCard } from '@/components/definitions';

<DefinitionCard
  definition={definition}
  showSource={true}  // Show link to source regulation
  state="ny"
  compact={false}    // Use compact mode for lists
/>
```

Features:
- Term as heading with scope badge (e.g., "in this Part")
- Quality badge based on overlap score (High/Medium/Low)
- Expandable definition text for long definitions
- Link to source regulation with NYCRR citation

### AggregatedTermCard

Displays a grouped term with variant count badge and expandable list of all definitions:

```tsx
import { AggregatedTermCard } from '@/components/definitions';

<AggregatedTermCard
  term={aggregatedTerm}
  state="ny"
/>
```

Features:
- Term heading with variant count badge (e.g., "[87 variants]")
- Preview definition from highest quality source (overlap=1.0)
- Scope levels display showing distinct scopes (e.g., "Part, Chapter, Title")
- Lazy-loaded expansion to show all definitions on first click
- Uses `useTransition` for loading state during expansion
- Nested `DefinitionCard` components in compact mode for expanded view

Props:
| Prop | Type | Description |
|------|------|-------------|
| `term` | `AggregatedTerm` | Aggregated term with normalizedTerm, displayTerm, variantCount, previewDefinition, scopeLevels |
| `state` | `StateCode` | State code ('ny' or 'nj') for fetching definitions |

### DefinitionsList

Collapsible list of definitions for regulation detail pages:

```tsx
import { DefinitionsList } from '@/components/definitions';

<DefinitionsList
  definitions={definitions}
  state="ny"
  collapsible={true}
  initialCollapsed={false}
/>
```

Pattern follows `ComplianceIssuesList` with:
- Collapsible header showing count
- Alphabetically sorted definitions
- Expandable long definition text
- Scope badges and source locations

### GlossarySearch

Search input with A-Z letter filter bar:

```tsx
import { GlossarySearch } from '@/components/definitions';

<GlossarySearch
  search={search}
  onSearchChange={handleSearchChange}
  selectedLetter={selectedLetter}
  onLetterChange={handleLetterChange}
  alphabeticalIndex={alphabeticalIndex}
  isLoading={isPending}
/>
```

Features:
- Debounced search input using SearchInput component
- A-Z letter bar with counts from alphabeticalIndex
- "All" button to clear letter filter
- Disabled letters for empty counts
- Active filter summary

### GlossaryClient

Main client component for the glossary page with view toggle:

```tsx
import { GlossaryClient } from '@/components/definitions';

<GlossaryClient
  state={stateCode}
  initialData={{
    definitions,
    aggregatedTerms,  // Grouped terms for aggregated view
    total,
    totalPages,
    stats,
    alphabeticalIndex,
  }}
/>
```

Features:
- Stats header (total definitions, unique terms, average quality, scope types)
- **View toggle** (List/Grouped) for switching between flat and aggregated views
- Search and A-Z filter integration (works in both views)
- Paginated results (by definitions in List view, by unique terms in Grouped view)
- URL-based state for search, letter, page, and view (`?view=flat` or `?view=aggregated`)
- Links to source regulations

View Toggle Pattern:
```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-[var(--color-text-muted)]">View:</span>
  <div className="flex rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] overflow-hidden">
    <Button
      variant={params.view === 'flat' ? 'primary' : 'ghost'}
      size="sm"
      onClick={() => setParams({ view: 'flat', page: 1 })}
    >
      <List className="w-4 h-4 mr-1" />
      List
    </Button>
    <Button
      variant={params.view === 'aggregated' ? 'primary' : 'ghost'}
      size="sm"
      onClick={() => setParams({ view: 'aggregated', page: 1 })}
    >
      <Layers className="w-4 h-4 mr-1" />
      Grouped
    </Button>
  </div>
</div>
```

This pattern uses a segmented button group with:
- Border-separated buttons in a flex container
- Active state uses `primary` variant, inactive uses `ghost`
- View switch resets page to 1
- Uses `nuqs` for URL state persistence

---

## Statute Components

Components for displaying statute links on regulation detail pages and browse panels.

### EnablingAuthorityCard

Info-blue background card showing enabling authority statutes:

```tsx
import { EnablingAuthorityCard } from '@/components/statutes';

{enablingAuthority.length > 0 && (
  <EnablingAuthorityCard links={enablingAuthority} state="ny" />
)}
```

| Prop | Type | Description |
|------|------|-------------|
| `links` | `RegulationStatuteLinkWithStatute[]` | Enabling authority links |
| `state` | `string` | State code for constructing links |

Features:
- Info-blue background (`bg-[var(--color-info-bg)]`) with Scale icon
- Statute citations as links to `/{state}/statutes/{id}` when matched
- Plain text citation when unmatched
- Statute title and context snippet display
- Only render when links array has items

### StatuteLinksList

Collapsible card showing non-enabling-authority statute links grouped by type:

```tsx
import { StatuteLinksList } from '@/components/statutes';

{statuteLinks.length > 0 && (
  <Card className="p-4">
    <StatuteLinksList links={statuteLinks} state="ny" />
  </Card>
)}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `links` | `RegulationStatuteLinkWithStatute[]` | - | Non-enabling-authority links |
| `state` | `string` | - | State code for constructing links |
| `initialCollapsed` | `boolean` | `false` | Whether to start collapsed |

Features:
- Collapsible with chevron toggle
- Grouped by link type (requirement, definition, reference)
- Citation as link (if matched) or plain text (if unmatched)
- Match status badge using `MATCH_STATUS_LABELS`
- Context snippet display
- Follows `CrossReferenceList` pattern

### StatuteLinksSection (DetailPanel)

Compact display of statute links for the browse panel:

```tsx
import { StatuteLinksSection } from './StatuteLinksSection';

<StatuteLinksSection
  links={statuteLinks}
  state={state}
  documentId={document.id}
  currentUrl={currentUrl}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `links` | `RegulationStatuteLinkWithStatute[]` | All statute links |
| `state` | `string` | State code |
| `documentId` | `number` | Document ID for "view all" link |
| `currentUrl` | `string` | Current URL for back navigation |

Features:
- Shows first 3 links with "View all N statute links..." overflow
- Link type badge on each item
- Follows `CrossReferencesSection` pattern

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

---

## Data Visualization Components

The application includes D3-powered data visualization components for the Analytics page and Card Grid view.

### Chart Infrastructure

**D3 Integration Pattern**: D3 for math (layouts, scales, generators), React for DOM (JSX rendering). All chart components are client-only (`'use client'`).

#### Chart Hooks

```tsx
import { useChartDimensions } from '@/hooks/useChartDimensions';
import { useChartColors } from '@/hooks/useChartColors';

// Responsive dimensions with ResizeObserver
const { containerRef, dimensions } = useChartDimensions({
  aspectRatio: 16 / 9,
  minHeight: 200,
  maxHeight: 500,
  margin: { top: 20, right: 20, bottom: 40, left: 50 },
});

// D3 color scales with design tokens
const {
  severityScale,      // high/medium/low → danger/warning/success
  categoryScale,      // ordinal scale for categories
  getSeverityColor,   // (severity: number) => color
} = useChartColors();
```

#### ChartContainer

Responsive container with title, description, and optional actions:

```tsx
import { ChartContainer } from '@/components/charts';

<ChartContainer
  title="Severity Distribution"
  description="Breakdown of flags by severity level"
  aspectRatio={16 / 9}
  minHeight={200}
  actions={<Button size="sm">Export</Button>}
>
  {({ dimensions }) => (
    <svg width={dimensions.width} height={dimensions.height}>
      {/* Chart content */}
    </svg>
  )}
</ChartContainer>
```

#### ClientChart

SSR wrapper ensuring charts only render client-side:

```tsx
import { ClientChart } from '@/components/charts';

<ClientChart fallback={<ChartSkeleton />}>
  <PieChart data={data} />
</ClientChart>
```

### PieChart / SeverityDonutChart

```tsx
import { PieChart, SeverityDonutChart } from '@/components/charts';

// Generic pie chart
<PieChart
  data={[
    { label: 'Category A', value: 30 },
    { label: 'Category B', value: 70 },
  ]}
  width={300}
  height={300}
  innerRadius={0}  // 0 for pie, >0 for donut
/>

// Severity-specific donut with center stat
<SeverityDonutChart
  data={[
    { label: 'High', value: 50, severity: 'high' },
    { label: 'Medium', value: 100, severity: 'medium' },
    { label: 'Low', value: 200, severity: 'low' },
  ]}
  total={350}
  label="Total Flags"
/>
```

### BarChart / HorizontalBarChart

```tsx
import { BarChart, HorizontalBarChart } from '@/components/charts';

// Vertical bar chart
<BarChart
  data={[
    { label: 'Jan', value: 100 },
    { label: 'Feb', value: 150 },
  ]}
  width={400}
  height={300}
/>

// Horizontal bar chart (good for categories)
<HorizontalBarChart
  data={issueTypeCounts}
  width={400}
  height={300}
  showValues={true}
/>
```

### ChartTooltip

```tsx
import { ChartTooltip, useChartTooltip } from '@/components/charts';

const { tooltip, showTooltip, hideTooltip } = useChartTooltip();

<g
  onMouseEnter={(e) => showTooltip(e, { label: 'Item', value: 100 })}
  onMouseLeave={hideTooltip}
>
  {/* Chart element */}
</g>
<ChartTooltip {...tooltip} />
```

### ChartLegend

```tsx
import { ChartLegend, ChartLegendCompact, ChartLegendGradient } from '@/components/charts';

// Standard legend (vertical list)
<ChartLegend
  items={[
    { label: 'High', color: 'var(--color-danger)' },
    { label: 'Medium', color: 'var(--color-warning)' },
    { label: 'Low', color: 'var(--color-success)' },
  ]}
/>

// Compact inline legend
<ChartLegendCompact items={legendItems} />

// Gradient legend for continuous scales
<ChartLegendGradient
  startColor="var(--color-success)"
  endColor="var(--color-danger)"
  startLabel="Low"
  endLabel="High"
/>
```

---

## Analytics Page

The Analytics page (`/[state]/analytics`) provides data visualization dashboards for regulatory analysis.

### Tab Structure

URL-based tabs using `nuqs`:

```tsx
import { analyticsTabParser } from '@/lib/url/parsers';

// ?tab=overview | crossrefs | issues | keywords | definitions | statutes | pipeline
const [{ tab }, setParams] = useQueryStates({
  tab: analyticsTabParser,
});
```

### AnalyticsTabs

```tsx
import { AnalyticsTabs } from '@/components/analytics';

<AnalyticsTabs
  activeTab={tab}
  onChange={(newTab) => setParams({ tab: newTab })}
/>
```

### OverviewTab

Stats cards, severity donut chart, and review progress bar:

```tsx
import { OverviewTab } from '@/components/analytics';

<OverviewTab
  stats={dashboardStats}
  reviewProgress={reviewProgressData}
  severityDistribution={severityData}
/>
```

### HierarchyTab

Zoomable treemap with customizable size and color metrics:

```tsx
import { HierarchyTab } from '@/components/analytics';

<HierarchyTab
  data={hierarchyData}
  sizeMetric="flags"      // flags | documents | compliance
  colorMetric="severity"   // severity | reviewStatus | none
  depth={2}               // 1-3 levels deep
/>
```

### IssuesTab

Bar charts and heatmap for compliance issue analysis:

```tsx
import { IssuesTab } from '@/components/analytics';

<IssuesTab
  issueTypeCounts={countsByType}
  severityMatrix={severityByType}
/>
```

### KeywordsTab

Section type pie chart and top keywords bar chart:

```tsx
import { KeywordsTab } from '@/components/analytics';

<KeywordsTab
  sectionTypeStats={sectionStats}
  topKeywords={keywordsData}
/>
```

### StatutesTab

Statute link analytics with stat cards, link type bar chart, and match quality donut chart:

```tsx
import { StatutesTab } from '@/components/analytics';

<StatutesTab
  stats={statuteStats}
  state={stateCode}
/>
```

Props:
| Prop | Type | Description |
|------|------|-------------|
| `stats` | `StatuteLinkStats \| null` | Statute link statistics from `getStatuteStats()` |
| `state` | `StateCode` | State code (e.g., 'NY', 'NJ') |

Content:
- **Stat cards** (4): Total Statutes, Linked Statutes (with %), Total Links, Regulations with Links (with %)
- **Link Type Distribution**: Horizontal bar chart from `byLinkType` using `LINK_TYPE_LABELS`
- **Match Quality**: Donut chart from `byMatchStatus` using `MATCH_STATUS_LABELS` with color-coded statuses (matched=green, corrected=blue, unmatched=yellow, obsolete=red)
- **Link Type Details**: Grid of count cards for each link type

### PipelineTab

Inter-tier data flow visualization for the 3-tier compliance analysis pipeline:

```tsx
import { PipelineTab } from '@/components/analytics';

<PipelineTab
  state={stateCode}
  data={pipelineData}
/>
```

Props:
| Prop | Type | Description |
|------|------|-------------|
| `state` | `StateCode` | State code (e.g., 'NJ', 'NY') |
| `data` | `PipelineAnalyticsData \| null` | Pre-fetched pipeline analytics from `getPipelineAnalyticsData()` |

Client-side re-fetch: Uses `useEffect` to re-fetch when `pIssueType` filter changes (same pattern as `CrossReferencesTab`).

Sub-components (in `components/analytics/pipeline/`):

- **PipelineFilters** — `FilterBar` with `Select` for issue type using `ISSUE_TYPE_LABELS`
- **PipelineFunnel** — StatGrid (4 cards: Total Analyses, FP Rate, Escalation Rate, Classification Changes) + custom SVG funnel flow diagram
- **Tier1ContextPanel** — Context request distribution: StackedBarChart by issue type, HorizontalBarChart by context type, summary stat cards
- **TierTransitionPanel** — Classification change heatmap (annotated `AnnotatedHeatmapGrid` inside `ClassificationHeatmap`), trigger reason bar chart, confidence distribution histograms. Off-diagonal cells show the top trigger reason as a 9px annotation below the count.
- **Tier3EvidencePanel** — Evidence flag StackedBarChart, severity adjustment BarChart (color-coded), cleanup PieChart + StatCards

### HeatmapGrid (Chart)

D3-based heatmap for `components/charts/HeatmapGrid.tsx`:

```tsx
import { HeatmapGrid } from '@/components/charts';

<HeatmapGrid
  data={{ rows: ['A', 'B'], columns: ['X', 'Y'], cells: [...] }}
  width={500}
  height={300}
/>
```

Uses `HeatmapData`/`HeatmapCell` types from `lib/charts/types.ts`. Color scale via `useChartColors()` with `scaleSequential` + `interpolateRgbBasis`.

**ClassificationHeatmap** extends the plain heatmap with transition reason annotations. It accepts a `transitionReasons: TransitionReasonData | null` prop and builds a custom SVG (via the internal `AnnotatedHeatmapGrid` component) instead of using the generic `HeatmapGrid`. Off-diagonal cells (where tier2 != tier3 classification) display the top trigger reason in small text (9px, 70% opacity) below the count. Diagonal cells show only the count. The tooltip also shows the trigger reason when available.

---

## Card Grid View

Alternative to the DataTable for browsing regulations with a visual card layout.

### ViewToggle

Toggle between table and card grid views:

```tsx
import { ViewToggle } from '@/components/regulations';
import { viewModeParser } from '@/lib/url/parsers';

const [{ viewMode }, setParams] = useQueryStates({
  viewMode: viewModeParser,  // 'table' | 'cards'
});

<ViewToggle viewMode={viewMode} onChange={(mode) => setParams({ viewMode: mode })} />
```

### RegulationCard

Individual card for grid view:

```tsx
import { RegulationCard } from '@/components/regulations';

<RegulationCard
  regulation={regulation}
  onClick={() => setSelectedId(regulation.id)}
/>
```

Card displays:
- Title with hierarchy level badge
- Severity badge and flags count
- Section type badge, complexity, metadata indicators
- Summary excerpt (2-3 lines)
- Keywords (max 3)
- View Regulation link in footer

### RegulationCardGrid

Responsive grid (1/2/3 columns) with pagination:

```tsx
import { RegulationCardGrid } from '@/components/regulations';

<RegulationCardGrid
  data={regulations}
  pagination={{ page, pageSize, total, totalPages }}
  onCardClick={(reg) => setSelectedId(reg.id)}
  onPageChange={(page) => setParams({ page })}
/>
```

### FacetedFilters

Sidebar with multi-select filters for the card grid view:

```tsx
import { FacetedFilters } from '@/components/regulations';

<FacetedFilters
  severity={severityValues}           // string[] of selected severities
  sectionTypes={sectionTypeValues}    // string[] of selected types
  complexity={complexityValues}       // string[] of selected levels
  hasFlags={hasFlagsValue}           // 'true' | 'false' | null
  hasForm={hasFormValue}             // 'true' | null
  hasIbr={hasIbrValue}               // 'true' | null
  onSeverityChange={handleSeverityChange}
  onSectionTypesChange={handleSectionTypesChange}
  onComplexityChange={handleComplexityChange}
  onHasFlagsChange={handleHasFlagsChange}
  onHasFormChange={handleHasFormChange}
  onHasIbrChange={handleHasIbrChange}
  onClearAll={handleClearAll}
  // Mobile drawer mode
  isOpen={isFilterOpen}
  onClose={() => setIsFilterOpen(false)}
/>
```

Filter sections:
- **Severity**: High, Medium, Low, Not Analyzed (multi-select)
- **Flags**: Has Flags, No Flags (radio)
- **Section Type**: 13 categories (multi-select, collapsible)
- **Complexity**: LOW, MEDIUM, MEDIUM-HIGH, HIGH (multi-select)
- **Metadata**: Has Form, Has External Standards (radio)

### URL State for Faceted Filters

```tsx
import {
  facetedSeverityParser,
  facetedSectionTypesParser,
  facetedComplexityParser,
  parseCommaSeparated,
  serializeCommaSeparated,
} from '@/lib/url/parsers';

// Comma-separated values in URL
// ?fSeverity=high,medium&fSectionTypes=definitions,requirements

const severity = parseCommaSeparated(params.fSeverity);
const newValue = serializeCommaSeparated(updatedArray);
```

### ActiveFilterChips

Display active filters as removable pills:

```tsx
import { ActiveFilterChips } from '@/components/regulations';

<ActiveFilterChips
  filters={[
    { key: 'severity', label: 'Severity', value: 'High' },
    { key: 'sectionType', label: 'Type', value: 'Requirements' },
  ]}
  onRemove={(key, value) => handleRemoveFilter(key, value)}
  onClearAll={handleClearAll}
/>
```

### FilterSection

Collapsible filter group:

```tsx
import { FilterSection } from '@/components/regulations';

<FilterSection title="Severity" count={selectedCount} defaultExpanded>
  <FilterCheckboxGroup
    options={severityOptions}
    selected={selectedSeverities}
    onChange={handleChange}
  />
</FilterSection>
```

### FilterCheckboxGroup / FilterRadioGroup

```tsx
import { FilterCheckboxGroup, FilterRadioGroup } from '@/components/regulations';

// Multi-select checkboxes
<FilterCheckboxGroup
  options={[
    { value: 'high', label: 'High (7-10)', count: 50 },
    { value: 'medium', label: 'Medium (4-6)', count: 100 },
  ]}
  selected={selectedValues}
  onChange={(values) => setSelectedValues(values)}
  maxVisible={6}  // Show "N more" link if exceeded
/>

// Single-select radios
<FilterRadioGroup
  options={hasFormOptions}
  selected={selectedValue}
  onChange={(value) => setSelectedValue(value)}
  allowDeselect  // Click again to deselect
/>
```

---

## Pipeline Page Components

Components for the research pipeline list and detail pages.

### PriorityPicksBanner

Banner showing high-priority items between the summary stats grid and the tier distribution chart. Displays either "quick wins" (high severity + easy cleanup) or fallback to highest-severity burdensome items.

```tsx
import { PriorityPicksBanner } from '@/components/analysis';

<PriorityPicksBanner
  state={stateCode}
  items={priorityItems}
  totalQuickWins={totalCount}
  isQuickWinMode={true}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `state` | `StateCode` | State code for constructing links |
| `items` | `AnalysisListItem[]` | Priority items to display (max 5) |
| `totalQuickWins` | `number` | Total matching items for "View all N" link |
| `isQuickWinMode` | `boolean` | Whether showing quick wins or severity fallback |

Features:
- Compact clickable cards with severity circle, issue type badge, document title
- "View all N quick wins" link pre-sets table filters
- Renders nothing when items array is empty

### ExecutiveSummary

Card showing key findings from the analysis, placed immediately after the header card on pipeline detail pages. Content adapts based on `highestTierCompleted`:

```tsx
import { ExecutiveSummary } from '@/components/analysis';

<ExecutiveSummary analysis={analysis} />
```

| Prop | Type | Description |
|------|------|-------------|
| `analysis` | `FullAnalysisRecord` | Full analysis record with all tier data |

**Tier 3 complete**: One-line verdict, web search summary, key flags (Federal Mandate, State Discretion, Modernized Alternative, Superseded by Law), severity adjustment note.

**Tier 2 only**: Classification and severity with note about no web verification.

**Tier 1/0**: Status message about matches identified and awaiting classification.

### Visual Priority Indicators (AnalysisTable)

Table rows in the pipeline list have colored left borders based on priority:

- `border-l-4 border-l-[var(--color-danger)]` — high severity (>=7) + easy cleanup candidate (critical quick wins)
- `border-l-4 border-l-[var(--color-warning)]` — high severity (>=7) only
- No left border — everything else

### Pipeline Detail Page Section Order

1. Header Card (classification flow, final outcome)
2. **Executive Summary Card** (key findings at a glance)
3. Easy Cleanup Card (when flagged)
4. **Severity Progression** (Base -> Web Search -> Final)
5. Bookmark Notes Card (when bookmarked)
6. Regex Matches Section
7. Pipeline Timeline (tier-by-tier journey)
8. Metadata Footer

---

## IBR (Standards) Page

The IBR page at `/[state]/ibr` displays external standards (NFPA, ASTM, ICC, CFR) incorporated by reference into state regulations. It uses a two-tab layout (Overview, Browse) with `SegmentedControl` for tab switching. This is a read-only exploration page — no review workflow.

### Tab Structure

| Tab | Component | Description |
|-----|-----------|-------------|
| Overview | `IbrOverviewTab` | Analytics: stat cards, org chart, top standards |
| Browse | `IbrBrowseTab` | Filterable/sortable table with detail drawer |

### IbrOverviewTab

Top-level analytics view with four stat cards (Total IBRs, Source Organizations, Regulations Referenced, Extraction Coverage), a horizontal bar chart (`IbrOrgChart`) for source organization distribution, and a top-referenced standards table.

### IbrOrgChart

Horizontal bar chart using CSS-based bars (no chart library). Shows source organization names on the left, count-proportional bars, and count labels. Max 10 organizations displayed.

### IbrBrowseTab

Filter bar with source organization dropdown, sort-by selector, and search input. Uses `IbrTable` for display and `IbrDetailDrawer` for row detail. Pagination at bottom.

### IbrTable

Clickable table rows with columns: Standard, Organization, Version, Source Regulation (clickable link to `/[state]/regulations/[id]`). Selected row highlighted with primary-faint background. Regulation links use `stopPropagation` to avoid triggering row selection.

### IbrDetailDrawer

Right-side `Drawer` (500px) showing full IBR details: requirement quote (`RegulationContent`), context, term matched, source regulation link with prominent "View Regulation" button, and original source link.

### IbrClient

Client component managing tab state via `ibrParsers` (nuqs). Renders `IbrOverviewTab` or `IbrBrowseTab` based on active tab. Uses `SegmentedControl` with Library/List icons.

### Navigation Integration

IBR appears in the Explorer nav group after Statutes:
```typescript
{ key: 'ibr', label: 'Standards (IBR)', icon: Library, pathSuffix: '/ibr', groupId: 'explorer' }
```

### File Structure

```
components/ibr/
├── index.ts              # Barrel exports
├── IbrClient.tsx         # Tab switching client component
├── IbrOverviewTab.tsx    # Overview analytics
├── IbrOrgChart.tsx       # Horizontal bar chart
├── IbrBrowseTab.tsx      # Filter + table + drawer
├── IbrTable.tsx          # Clickable data table
└── IbrDetailDrawer.tsx   # Right-side detail drawer
```

---

## Entity Type Visual System

The app has 9 core data entity types. Each has a distinct visual identity (icon + color palette) defined once in `src/lib/constants/entity-types.ts` and applied everywhere via the `EntityTypeIndicator` component.

### Design Principle

Entity types communicate **what** something is. Status/severity badges (SeverityBadge, ReviewStatusBadge, SectionTypeBadge) communicate **how** it's doing. These are separate concerns with separate color systems:

- **Entity types**: Tailwind `-50` backgrounds, `-600` icon colors, `-300` borders
- **SectionTypeBadge**: Tailwind `-100` backgrounds, `-800` text
- **Semantic status**: CSS custom properties (`--color-danger`, `--color-warning`, etc.)

### Entity Type Mapping

| Entity Type | Icon | Icon Color | Background | Border |
|---|---|---|---|---|
| Regulatory Document | `FileText` | `text-slate-600` | `bg-slate-50` | `border-slate-300` |
| Statute | `Scale` | `text-violet-600` | `bg-violet-50` | `border-violet-300` |
| Compliance Issue | `ClipboardList` | `text-amber-600` | `bg-amber-50` | `border-amber-300` |
| Red Flag | `AlertTriangle` | `text-rose-600` | `bg-rose-50` | `border-rose-300` |
| Definition | `BookOpen` | `text-sky-600` | `bg-sky-50` | `border-sky-300` |
| Cross-Reference | `Link2` | `text-indigo-600` | `bg-indigo-50` | `border-indigo-300` |
| IBR/Standard | `Library` | `text-emerald-600` | `bg-emerald-50` | `border-emerald-300` |
| Note | `MessageSquare` | `text-stone-600` | `bg-stone-50` | `border-stone-300` |
| Bookmark | `Star` | `text-yellow-600` | `bg-yellow-50` | `border-yellow-300` |

### Canonical Source

```
src/lib/constants/entity-types.ts    # ENTITY_TYPES record, EntityType union, helpers
src/components/ui/EntityTypeIndicator.tsx  # Reusable display component
```

Always import entity icons via `getEntityIcon()` or `getEntityConfig()` from `entity-types.ts` rather than importing Lucide icons directly. This ensures icon changes propagate everywhere.

### EntityTypeIndicator Component

```tsx
import { EntityTypeIndicator } from '@/components/ui';

// Icon only (default) — section headers
<EntityTypeIndicator type="red_flag" size="sm" />

// Icon + label — for headers needing text
<EntityTypeIndicator type="definition" size="md" showLabel />

// Pill with background — for filter chips, tabs
<EntityTypeIndicator type="compliance_issue" showLabel showBackground />

// With count badge
<EntityTypeIndicator type="cross_reference" size="sm" count={12} />
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `EntityType` | required | Which entity type |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Icon size (14/16/20px) |
| `showLabel` | `boolean` | `false` | Show label text |
| `showBackground` | `boolean` | `false` | Render tinted background pill |
| `count` | `number` | — | Optional count badge |
| `className` | `string` | — | Additional CSS classes |

### Usage Guidelines

- **Section headers**: Use `EntityTypeIndicator` with just `type` and `size` props, alongside existing `<h3>` text
- **Navigation**: Nav items that map to entity types (Statutes, Glossary, IBR, Bookmarks) import icons from `entity-types.ts`; view/action nav items (Browse, Table View, Pipeline) keep their own icons
- **RedFlagCard left-border**: The `border-l-4 border-[var(--color-danger)]` on red flag cards communicates severity (a status concern), not entity type — keep it separate
- **Cross-reference direction**: Both outgoing and incoming cross-references use the same `Link2` + indigo. The section title ("Cross-References" vs "Cited By") communicates direction
