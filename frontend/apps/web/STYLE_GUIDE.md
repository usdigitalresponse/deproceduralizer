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
| `--color-text-inverse` | `#ffffff` | Text on dark backgrounds |
| `--color-link` | `#004dd1` | Links |
| `--color-link-hover` | `#003ba1` | Link hover states |

### Surface Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-surface` | `#ffffff` | Default surface (cards, panels) |
| `--color-surface-raised` | `#f6f6f6` | Raised surface (hover rows, sidebars) |
| `--color-background` | `#f7fafd` | Page background |

### Focus Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--color-focus` | `#004dd1` | Focus outline color |
| `--color-focus-ring` | `rgba(0, 77, 209, 0.4)` | Focus ring glow |

### State-Specific Accent Colors

Each jurisdiction has a unique accent, background, and border color for visual differentiation:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-state-ny-accent` | `#1e40af` | New York accent |
| `--color-state-ny-bg` | `rgba(30, 64, 175, 0.05)` | New York background tint |
| `--color-state-ny-border` | `rgba(30, 64, 175, 0.15)` | New York border tint |
| `--color-state-nj-accent` | `#b45309` | New Jersey accent |
| `--color-state-nj-bg` | `rgba(180, 83, 9, 0.05)` | New Jersey background tint |
| `--color-state-nj-border` | `rgba(180, 83, 9, 0.15)` | New Jersey border tint |
| `--color-state-nyc-accent` | `#059669` | New York City accent |
| `--color-state-nyc-bg` | `rgba(5, 150, 105, 0.05)` | New York City background tint |
| `--color-state-nyc-border` | `rgba(5, 150, 105, 0.15)` | New York City border tint |

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

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-none` | 1 | Badges, icons |
| `--leading-tight` | 1.25 | Headings |
| `--leading-snug` | 1.375 | Subheadings |
| `--leading-normal` | 1.5 | Body text (default) |
| `--leading-relaxed` | 1.625 | Long-form content |
| `--leading-loose` | 2 | Spacious text blocks |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | -0.025em | Headings, large text |
| `--tracking-normal` | 0 | Body text (default) |
| `--tracking-wide` | 0.025em | Uppercase labels, small caps |

---

## Spacing

| Token | Size | Usage |
|-------|------|-------|
| `--space-0` | 0 | No spacing |
| `--space-1` | 4px | Tight gaps |
| `--space-2` | 8px | Icon gaps, inline spacing |
| `--space-3` | 12px | Form field gaps |
| `--space-4` | 16px | Card padding, section gaps |
| `--space-5` | 20px | Intermediate spacing |
| `--space-6` | 24px | Component spacing |
| `--space-8` | 32px | Section spacing |
| `--space-10` | 40px | Large gaps |
| `--space-12` | 48px | Page sections |
| `--space-16` | 64px | Major sections |
| `--space-20` | 80px | Large page sections |
| `--space-24` | 96px | Hero/banner spacing |

---

## Border Radius

| Token | Size | Usage |
|-------|------|-------|
| `--radius-none` | 0 | No rounding |
| `--radius-sm` | 4px | Badges, small elements |
| `--radius-md` | 6px | Buttons, inputs |
| `--radius-lg` | 8px | Cards |
| `--radius-xl` | 12px | Modals |
| `--radius-2xl` | 16px | Large containers |
| `--radius-full` | 9999px | Pills, avatars |

### Border Widths

| Token | Size | Usage |
|-------|------|-------|
| `--border-width-1` | 1px | Default borders |
| `--border-width-2` | 2px | Emphasis borders, focus rings |
| `--border-width-4` | 4px | Strong emphasis, left accent borders |

---

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Cards, subtle elevation |
| `--shadow-md` | Dropdowns, popovers |
| `--shadow-lg` | Modals |
| `--shadow-xl` | Elevated overlays, large dropdowns |

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 0 | Default stacking |
| `--z-dropdown` | 10 | Dropdown menus |
| `--z-sticky` | 20 | Sticky headers, context bars |
| `--z-fixed` | 30 | Fixed position elements |
| `--z-modal-backdrop` | 40 | Modal backdrop overlay |
| `--z-modal` | 50 | Modal dialogs |
| `--z-tooltip` | 60 | Tooltips, popovers |

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

### Card Spacing Standards

Two valid tiers:

| Tier | Usage | Padding | Header Spacing | Example |
|------|-------|---------|----------------|---------|
| Full | Review cards, detail views | `Card padding="md"` (p-6) | `mb-4` | ComplianceIssueCard, BarrierCard |
| Compact | Search results, list items | `Card padding="sm"` (p-4) | `mb-2` | SearchResultCard, ComplianceIssueDisplayCard |

### Collapsible Details Styling

All `<details>` content blocks use this container pattern:
```
p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]
```

### Badge Typography

- All badges: `text-xs` (12px). Never use `text-[10px]`.
- Badge container gaps: `gap-2` everywhere.

### MarkdownTable

Renders a markdown pipe-delimited table string as a styled HTML `<table>`. Used by `AnnotatableContent` to display tables embedded in regulation text.

```tsx
import { MarkdownTable } from '@/components/ui/MarkdownTable';

<MarkdownTable markdown={`| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |`} />
```

- Header row: `bg-[--color-neutral-100]`, `font-semibold`
- Borders: `1px solid --color-neutral-200`
- Alternating row stripes: white / `--color-neutral-50`
- Font size: `text-xs` (matches regulation text mono style)
- Horizontal scroll on overflow (`overflow-x-auto`)

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

### MultiSelect

Multi-value selection with chips and checkboxes.

```tsx
import { MultiSelect } from '@/components/ui';

<MultiSelect
  label="Issue Type"
  options={issueTypeOptions}
  value={selectedTypes}
  onChange={setSelectedTypes}
  placeholder="All Issue Types"
/>
```

**Behavior:**
- Trigger shows selected items as chips (max 2, then "+N more")
- Empty selection = placeholder text (acts as "All")
- Dropdown stays open after selection
- "Clear all" link when items selected
- Optional `count` field on options: renders right-aligned, non-truncating count next to the label (uses `tabular-nums` for digit alignment)
- `searchable` prop (default `false`): renders a text input at the top of the dropdown for client-side filtering of options. Use when option list is large (20+ items).

**URL State:**
- Comma-separated values: `?issueType=wet_signature,in_person`
- Backward compatible with single values
- Use `parseCommaSeparated()` / `serializeCommaSeparated()` from `parsers.ts`

**Accessibility:** `role="listbox"`, `aria-multiselectable="true"`, keyboard navigation

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
<SectionTypeBadge type={document.sectionType} tagField="guid_section_type" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string \| null` | - | Section type category |
| `compact` | `boolean` | `false` | Show abbreviated label |
| `tagField` | `string` | - | When provided, wraps badge with ClickableTag |

Section type categories (15): `definitions`, `requirements`, `procedures`, `prohibitions`, `standards`, `eligibility`, `penalties`, `fees`, `forms`, `reporting`, `purpose`, `scope`, `exemptions`, `reserved`, `other`

Each type has a unique color scheme for quick visual identification.

### KeywordTags

Display array of keywords with overflow handling:

```tsx
import { KeywordTags } from '@/components/ui/KeywordTags';

<KeywordTags keywords={['licensing', 'fees', 'application']} />
<KeywordTags keywords={keywords} maxDisplay={2} size="sm" tagField="guid_keywords" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `keywords` | `string[] \| null` | - | Array of keywords |
| `maxDisplay` | `number` | `3` | Max tags before "+N" |
| `size` | `'sm' \| 'md'` | `'sm'` | Tag size |
| `tagField` | `string` | - | When provided, each keyword becomes clickable via ClickableTag |

### MetadataIndicators

Icons for form references and external standards:

```tsx
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';

<MetadataIndicators hasForm hasIbr />
<MetadataIndicators hasForm={document.hasForm} hasIbr={document.hasIbr} size="md" tagFieldPrefix="guid" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hasForm` | `boolean \| null` | - | Show form reference icon |
| `hasIbr` | `boolean \| null` | - | Show external standards icon |
| `size` | `'sm' \| 'md'` | `'sm'` | Icon size |
| `tagFieldPrefix` | `string` | - | When provided, wraps indicators with ClickableTag (e.g., `guid` -> `guid_has_form`) |

- Form reference: indigo FileText icon
- External standards (IBR): green ExternalLink icon

### ClickableTag

Wrapper that makes any tag clickable, opening the TagDrawer:

```tsx
import { ClickableTag } from '@/components/tags/ClickableTag';

<ClickableTag field="barrier_category" value={issue.category}>
  <Badge variant="info">{categoryLabel}</Badge>
</ClickableTag>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `field` | `string` | - | Tag field key (from TAG_FIELDS registry) |
| `value` | `string` | - | Tag value to explore |
| `contextDocumentId` | `number` | - | Optional document ID for context counts |
| `children` | `ReactNode` | - | Content to wrap |
| `className` | `string` | - | Additional CSS classes |

Renders as a `<button>` with hover ring effect. Requires `TagDrawerProvider` in the component tree (provided in `[state]/layout.tsx`).

### TagBadge

Pill badge for displaying tag values with domain-based colors:

```tsx
import { TagBadge } from '@/components/tags/TagBadge';

<TagBadge value="existing_providers" domain="guidance" />
<TagBadge value="fine" domain="fines" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Raw tag value (underscores replaced, title-cased) |
| `domain` | `TagDomain` | - | Optional domain for color styling |
| `className` | `string` | - | Additional CSS classes |

Domain colors from `TAG_DOMAIN_COLORS`: regulation (indigo), guidance (amber), fines (rose), compliance (emerald), barrier (violet).

### TagDrawer

Slide-in drawer that opens when any ClickableTag is clicked:

```tsx
// Automatically included via [state]/layout.tsx — no manual usage needed.
// Uses useTagDrawer() context for state management.
```

Shows: tag value, field label, total occurrences, cross-domain counts (expandable with sample links), similar tags (clickable pills), and "Explore in Tags Analytics" link.

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
  title="No issues found"
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

### BookmarkButton

Toggle button for bookmarking/starring items. Uses warning (gold) color when active.

```tsx
import { BookmarkButton } from '@/components/ui';

<BookmarkButton
  isBookmarked={isBookmarked}
  onToggle={handleToggle}
  size="md"
  showLabel
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isBookmarked` | `boolean` | required | Current bookmark state |
| `onToggle` | `() => void` | required | Toggle callback |
| `size` | `'sm' \| 'md'` | `'sm'` | Button size (`sm`: 16px icon, `md`: 20px icon) |
| `showLabel` | `boolean` | `false` | Show "Bookmarked"/"Bookmark" text label |
| `isLoading` | `boolean` | `false` | Show spinner during toggle |

Uses Star icon from Lucide (filled when bookmarked). Prevents event propagation. Extends standard `ButtonHTMLAttributes`.

### SearchableContent

Content display with inline search highlighting and match navigation.

```tsx
import { SearchableContent } from '@/components/ui';

<SearchableContent
  content={document.text}
  maxHeight="16rem"
  placeholder="Search in text..."
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | required | Text content to display and search |
| `placeholder` | `string` | `'Search in text...'` | Search input placeholder |
| `defaultExpanded` | `boolean` | `false` | Start with search bar visible |
| `maxHeight` | `string` | `'16rem'` | Max height of content area |
| `initialValue` | `string` | — | Pre-fill search and auto-expand |
| `onSearchChange` | `(query: string) => void` | — | Callback on search input change |
| `children` | `ReactNode` | — | Custom content (skips built-in highlighting) |

Features:
- Real-time search highlighting (current match: warning yellow, other matches: light yellow)
- Match navigation: previous/next buttons, match counter ("1/5 matches")
- Keyboard shortcuts: Enter (next), Shift+Enter (previous), Escape (close)
- Scroll-into-view for current match

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
| Federal Mandate | `danger` (red) | `federalMandateFound = true` |
| Easy Fix | `success` (green) | `easyCleanupCandidate = true` AND `cleanupEffort = 'trivial'` |
| Fixable | `success` (green) | `easyCleanupCandidate = true` AND `cleanupEffort ≠ 'trivial'` |
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
const REVIEW_TABS: SegmentedControlOption<'compliance' | 'barriers'>[] = [
  { value: 'compliance', label: 'Compliance Issues', badge: 25, badgeVariant: 'warning' },
  { value: 'barriers', label: 'Barriers', badge: 10, badgeVariant: 'info' },
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

Used on all interior pages. **Not** used on the home page (see `HomeHero` below).

### HomeHero

Data-forward hero component used **only** on the home page (`app/page.tsx`). Replaces `PageHeader`, `DashboardStats`, and `PipelineHeroBanner` to avoid redundant sections.

Structure:
- Eyebrow label ("REGULATORY ANALYSIS DASHBOARD") instead of a large title
- Four large stat numbers in a 2x2 → 4-column grid (regulations scanned, guidance documents, issues found, awaiting review)
- Action bar with Pipeline + Burden Index links and jurisdiction pills

Located at `components/home/HomeHero.tsx`. Server component — receives `stats`, `stateStats`, and `guidanceTotal` as props.

### StateContextBar

Displays the current jurisdiction with a dropdown to switch between available states. Sits below the main header.

```tsx
import { StateContextBar } from '@/components/layout/StateContextBar';

<StateContextBar state="NY" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `jurisdiction` | `JurisdictionCode` | required | Current jurisdiction (`NY`, `NJ`, `NYC`) |

Uses state-specific accent colors (`--color-state-{code}-accent`, `--color-state-{code}-bg`). Persists selection to localStorage and maintains query parameters when switching.

### NavDropdown

Navigation dropdown for grouping related nav links under a single button.

```tsx
import { NavDropdown } from '@/components/layout/NavDropdown';

<NavDropdown
  label="Review"
  icon={ClipboardCheck}
  items={[
    { key: 'compliance', label: 'Compliance Issues', href: '/review/compliance', isActive: true },
    { key: 'barriers', label: 'Barriers', href: '/review/barriers', isActive: false },
  ]}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Button label (hidden on small screens) |
| `icon` | `LucideIcon` | required | Button icon |
| `items` | `NavDropdownItem[]` | required | Array of `{ key, label, href, isActive, icon? }` |

Highlights button when any child item is active. Closes on outside click. Uses Next.js `Link` for client-side navigation.

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

## Review Components

The Review page provides a dedicated interface for efficiently triaging compliance issues identified by analysis.

### ReviewQueue

Main container component that orchestrates the review interface:
- Manages local state for optimistic updates
- Handles pagination navigation
- Coordinates keyboard navigation focus
- Integrates all review sub-components

```tsx
import { ReviewQueue } from '@/components/review';

<ReviewQueue
  initialItems={items}
  pagination={{ page, pageSize, total, totalPages }}
  statusCounts={counts}
  categories={categories}
  currentFilters={{ status, severity, category }}
  sortBy="severity"
  sortOrder="desc"
/>
```

### ReviewCard

Decomposed review card (5 sub-components in `ReviewCard/` directory):

**Sub-components:**
- `Header` — Category label, severity/complexity/effort badges, review status
- `LLMAnalysisSection` — Blue box with "Why Flagged" explanation, text examples (quoted), implementation approach, effort estimate
- `RegulationActions` — View page button, Cornell link, regulation text viewer, hierarchy tree
- `ReviewForm` — Status, priority, impact, reviewer, justification/team notes, save button
- `SiblingSectionsView` (shared) — Lazy-loaded collapsible showing sibling sections under same parent

**Features:**
- Displays issue category, severity badge, complexity badge, effort estimate badge
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
- `j` / `↓`: Next item
- `k` / `↑`: Previous item
- `n`: Next unreviewed item
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

Compact two-button toggle for switching between Review and Developer Mode:
- Positioned above the tab bar with bottom margin for visual separation
- Uses `inline-flex` to maintain compact width
- Persists mode in URL params (`?mode=developer`)

```tsx
import { ReviewModeSwitcher } from '@/components/review';

<ReviewModeSwitcher mode={mode} />
```

### ReviewTypeTabs

Tab bar for switching between content types. Adapts based on mode:
- **Review**: Compliance Issues, Barrier, Definitions, Needs More Info
- **Developer Mode**: All Reviewed Items, Needs More Info

```tsx
import { ReviewTypeTabs } from '@/components/review';

<ReviewTypeTabs
  activeType={reviewType}
  counts={{ compliance: 50, barrier: 30, definitions: 20, needs_info: 5 }}
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

Combined queue showing compliance issues that have been reviewed:
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
- Shows item type badge (Compliance Issue)
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

## Compliance Issue Review Components

Full decomposition of the compliance issue review workflow — dual-mode queue with smart suggestions and comprehensive analysis cards.

### ComplianceReviewQueue

Master container for compliance issue review. Supports two modes via a union type:

```tsx
import { ComplianceReviewQueue } from '@/components/review';

// Filter mode (manual browsing with pagination)
<ComplianceReviewQueue
  mode="filter"
  initialIssues={issues}
  pagination={pagination}
  statusCounts={statusCounts}
  issueTypes={issueTypes}
/>

// Suggestion mode (smart grouping with batch navigation)
<ComplianceReviewQueue
  mode="suggestion"
  initialBatch={batch}
  fetchBatch={fetchBatch}
  statusCounts={statusCounts}
  issueTypes={issueTypes}
/>
```

| Prop (shared) | Type | Description |
|------|------|-------------|
| `statusCounts` | `ComplianceIssueStatusCounts` | Review status breakdown for progress bar |
| `issueTypes` | `string[]` | Available issue types for filtering |
| `compact` | `boolean?` | Compact card rendering |

**Filter mode** adds `initialIssues` and `pagination`. **Suggestion mode** adds `initialBatch` and `fetchBatch` callback.

Features: keyboard navigation (j/k), deep linking, URL state persistence, regulation modal sidebar, dual hook system (`useQueue` + `useSuggestionQueue`).

### ComplianceQueueModeSwitcher

SegmentedControl toggle between "Manual Filters" and "Smart Suggestions" modes.

| Prop | Type | Description |
|------|------|-------------|
| `mode` | `QueueModeValue` | Current queue mode |

Clears mode-specific URL parameters when switching.

### ComplianceFilters

FilterBar for filter mode with filters for: Status, Issue Type, Severity, Source (statute), LLM (requirement found), Tier, Federal Mandate, Analysis presence. Includes sort controls. Uses `nuqs` URL state.

| Prop | Type | Description |
|------|------|-------------|
| `issueTypes` | `string[]` | Available issue types |
| `className` | `string?` | Additional CSS classes |

### SuggestionModeControls

Info panel and controls for suggestion mode. Shows current grouping strategy, focus group, remaining items, and batch size controls.

| Prop | Type | Description |
|------|------|-------------|
| `groupingMode` | `'issue_type' \| 'section' \| 'combined'` | Current grouping strategy |
| `focus` | `{ issueType?, section?, pattern? }` | Current focus group |
| `remainingInFocus` | `number` | Items remaining in current group |
| `totalUnreviewed` | `number` | Total unreviewed items |
| `batchSize` | `1 \| 3 \| 5 \| 10` | Items per batch |
| `onSkipToNextMode` | `() => void` | Skip to next grouping mode |
| `onClearHistory` | `() => void` | Reset suggestion history |
| `onBatchSizeChange` | `(size) => void` | Change batch size |

### ComplianceIssueCard

Comprehensive card for a single compliance issue with full analysis details. ForwardRef component.

```tsx
import { ComplianceIssueCard } from '@/components/review/ComplianceIssueCard';

<ComplianceIssueCard
  issue={issue}
  onUpdated={handleUpdated}
  onViewRegulation={handleViewRegulation}
  isFocused={isFocused}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `issue` | `ComplianceIssueWithAnalysis` | Issue with joined analysis data |
| `onUpdated` | `(updated) => void` | Callback after review update |
| `onViewRegulation` | `(regulationId: number) => void` | Open regulation modal |
| `isFocused` | `boolean?` | Keyboard focus highlight |

#### Sub-components (in `ComplianceIssueCard/`)

| Component | Purpose |
|-----------|---------|
| `Header` | Issue type badge (links to /prompts), OutcomeBadges, review status |
| `TierClassificationSection` | 3-tier pipeline progression visualization (Tier 1→2→3) |
| `SummaryContext` | Regulation summary, section type badge, metadata indicators, hierarchy breadcrumbs |
| `LLMAnalysisSection` | Decision rationale, verbatim supporting text, cited statute |
| `EvidenceSection` | Expandable research evidence (web search results, document quotes) |
| `AnalysisDetailsSection` | Expandable steelman arguments (For/Against), web research summary, analysis metadata |
| `TechnicalDetailsSection` | Expandable regex match pattern display |
| `ReviewForm` | Inline review form: status, justification, reviewer, severity override, impact type |

### ComplianceDeveloperQueue

Developer mode queue for reviewed compliance issues. Shows developer assignment, resolution tracking, and developer notes.

| Prop | Type | Description |
|------|------|-------------|
| `initialItems` | `ComplianceIssueWithAnalysis[]` | Pre-loaded items |
| `pagination` | `PaginationInfo` | Page info |
| `statusCounts` | `CombinedDeveloperStatusCounts` | Developer status breakdown |
| `issueTypes` | `string[]` | Available issue types |

Uses `DeveloperCard` component and generic queue hook. Includes excluded sections list and progress bar.

### ComplianceDeveloperFilters

FilterBar for compliance developer mode: Dev Status, Developer, Severity, Review Status, Issue Type. Includes sort controls.

| Prop | Type | Description |
|------|------|-------------|
| `issueTypes` | `string[]` | Available issue types |
| `className` | `string?` | Additional CSS classes |

---

## Definitions Review Workflow

Complete workflow for reviewing AI-extracted regulatory definitions.

### DefinitionsReviewQueue

Main review queue container. Manages pagination, filtering, keyboard navigation (j/k, x to select), bulk selection, and progress tracking.

```tsx
import { DefinitionsReviewQueue } from '@/components/review/definitions';

<DefinitionsReviewQueue state="NY" />
```

| Prop | Type | Description |
|------|------|-------------|
| `jurisdiction` | `JurisdictionCode` | Jurisdiction (`NY`, `NJ`, `NYC`) |

Features: keyboard shortcuts with help modal, bulk actions bar, integration with RegulationModal.

### DefinitionReviewCard

Two-column card for reviewing a single definition. Left: original extracted values (read-only). Right: editable fields for corrections. ForwardRef component.

```tsx
<DefinitionReviewCard
  definition={definition}
  onUpdated={handleUpdated}
  onViewRegulation={handleViewRegulation}
  state="NY"
  isFocused={isFocused}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `definition` | `DefinitionWithContext` | Definition with regulation context |
| `onUpdated` | `(updated) => void` | Callback after update |
| `onReviewComplete` | `(id, status) => void?` | Callback on confirm/reject/false positive |
| `onViewRegulation` | `(regulationId: number) => void` | Open regulation modal |
| `jurisdiction` | `JurisdictionCode` | Jurisdiction |
| `isFocused` | `boolean?` | Keyboard focus highlight |
| `isSelected` | `boolean?` | Bulk selection checkbox state |
| `onSelectionChange` | `(id, selected) => void?` | Selection change callback |

#### Sub-components (in `DefinitionReviewCard/`)

| Component | Purpose |
|-----------|---------|
| `Header` | Citation, selection checkbox, definition term |
| `SummaryContext` | Regulation context display |
| `OriginalColumn` | Read-only extracted values |
| `EditableColumn` | Correction form (term, definition, scope, type, cross-ref) |
| `MetadataSection` | Expandable metadata |
| `ReviewNotesSection` | Reviewer name and notes |
| `ActionButtons` | Confirm, Save Corrections, Mark False Positive |

### DefinitionsProgress

Progress card showing review completion with status breakdown.

| Prop | Type | Description |
|------|------|-------------|
| `counts` | `{ unreviewed, confirmed, corrected, falsePositive, total }` | Status counts |
| `className` | `string?` | Additional CSS classes |

### BulkActionBar (shared)

Sticky bottom bar (`position: sticky; bottom: 0`) for bulk operations across tables. Dark background (`--color-neutral-800`) with white text. Appears when 1+ rows are selected.

| Prop | Type | Description |
|------|------|-------------|
| `selectedCount` | `number` | Number of selected items |
| `onMarkAll` | `() => void` | Bookmark all unbookmarked selected items |
| `onAssignMarker` | `(markerGroupId: number) => void` | Assign marker to all bookmarked selected items |
| `onCreateAndAssign` | `(name: string) => void?` | Create new category and assign to selected bookmarked items |
| `onUnmarkAll` | `() => void?` | Remove bookmarks from all selected bookmarked items (danger variant) |
| `onClear` | `() => void` | Clear selection |
| `availableGroups` | `MarkerGroup[]` | Marker groups for category picker dropdown |
| `isProcessing` | `boolean?` | Disables buttons during async operations |
| `totalMatchingCount` | `number?` | Total items matching filter across all pages |
| `onSelectAllMatching` | `() => void?` | Called when "Select all X matching items" banner is clicked |

Used by `FinesTable` and `AnalysisTable`. The "Assign Category" dropdown opens upward (above the bar) using `bottom-full` and includes an inline text input + Plus button at the bottom for creating new categories (same pattern as `MarkerPicker.onCreateCustom`). When `onUnmarkAll` is provided, an "Unmark All" button with danger styling appears. When all visible rows are selected and `totalMatchingCount > selectedCount`, a "Select all X matching items" banner appears above the action bar. Paired with `useBulkSelection` hook from `@/hooks/useBulkSelection`.

### BulkActionsBar (definitions)

Floating bottom bar for batch operations on selected definitions.

| Prop | Type | Description |
|------|------|-------------|
| `selectedIds` | `number[]` | Currently selected definition IDs |
| `totalItems` | `number` | Total items in queue |
| `onSelectAll` | `() => void` | Select all callback |
| `onClearSelection` | `() => void` | Clear selection callback |
| `onBulkComplete` | `() => void` | Refresh after bulk action |

Includes "Confirm Selected" and "Mark as False Positive" buttons with confirmation dialog. Saves reviewer name to localStorage.

### ScopeDocumentTypeahead

Autocomplete input for selecting definition scope documents.

| Prop | Type | Description |
|------|------|-------------|
| `jurisdiction` | `JurisdictionCode` | Jurisdiction |
| `value` | `number \| null` | Selected document ID |
| `onChange` | `(docId: number \| null) => void` | Selection callback |
| `sourceDocumentId` | `number \| null` | For loading ancestor suggestions |
| `placeholder` | `string?` | Input placeholder |

Shows ancestors when empty, search results when typing. Supports manual ID entry. Debounced search.

### DefinitionsDeveloperQueue

Developer mode queue for reviewed definitions. Same pattern as DefinitionsReviewQueue but for post-review developer work.

| Prop | Type | Description |
|------|------|-------------|
| `jurisdiction` | `JurisdictionCode` | Jurisdiction |

### DefinitionDeveloperCard

Card for developer assignment with: developer selection, status tracking (unresolved/pending/backlogged/need_more_info/resolved), resolution type and comments, developer notes.

| Prop | Type | Description |
|------|------|-------------|
| `definition` | `DefinitionWithContext` | Definition with context |
| `jurisdiction` | `JurisdictionCode` | Jurisdiction |
| `onUpdated` | `(updated) => void` | Update callback |
| `onViewRegulation` | `(regulationId: number) => void` | Open regulation modal |
| `isFocused` | `boolean?` | Keyboard focus highlight |

---

## Barrier Pipeline Composer

Interactive prompt viewer for the Barrier pipeline. Located on `/prompts` page. User searches for a regulatory section and sees the fully assembled 3-layer prompt with real DB context.

### BarrierPipelineComposer

Parent orchestrator — header card with `DocumentSearchSelector`, 2-column layout (viewer + context panel), and token breakdown.

```tsx
import { BarrierPipelineComposer } from '@/components/prompts';

<BarrierPipelineComposer />
```

### DocumentSearchSelector

Debounced search typeahead for regulatory sections. Includes jurisdiction toggle (NY/NJ/NYC) and displays selected document.

### BarrierComposedPromptViewer

3-layer prompt viewer using shared `LayerSection` component. Layers: System (cached globally), Batch Context (cached per subchapter), Template (unique per section). Color-coded with legend.

### DocumentContextPanel

Metadata sidebar showing ancestor chain (indented tree), sibling count, definition count, and cross-reference count.

### BarrierTokenBreakdown

3-segment stacked bar with cache savings estimate. Similar to V5 `TokenBreakdown` but with 3 segments instead of 4.

### Shared: LayerSection

Extracted to `components/prompts/shared/LayerSection.tsx`. Collapsible section with copy button, placeholder highlighting, token/line counts. Used by V5 `ComposedPromptViewer`, `BarrierComposedPromptViewer`, and `FinesComposedPromptViewer`.

---

## Fines Pipeline Composer

Interactive prompt viewer for the fines extraction pipeline. Located on `/prompts?tab=fines` page. User searches for a regulatory section and sees the fully assembled 2-layer prompt with document metadata and regulation context.

### FinesPipelineComposer

Parent orchestrator — header card reusing `DocumentSearchSelector` from Barrier, 2-column layout (viewer + context panel), and token breakdown.

```tsx
import { FinesPipelineComposer } from '@/components/prompts';

<FinesPipelineComposer />
```

### FinesComposedPromptViewer

2-layer prompt viewer using shared `LayerSection` component. Layers: System (cached globally), Template (unique per document). Color-coded with legend.

### FinesContextPanel

Right sidebar showing document metadata: source type (regulation/guidance), responsible agency, NYCRR title, content length, windowing status, and matched regex patterns.

### FinesTokenBreakdown

Stacked bar chart showing token distribution between system and template layers, with cache savings estimate.

---

## Barrier Pipeline Components

Components for viewing barrier framework analysis results — 18-category implementation complexity assessment.

### BarrierQueue

Paginated, filterable queue of Barrier implementation issues.

```tsx
import { BarrierQueue } from '@/components/review';

<BarrierQueue state="NY" mode="review" />
```

| Prop | Type | Description |
|------|------|-------------|
| `jurisdiction` | `JurisdictionCode` | Jurisdiction |
| `mode` | `'review' \| 'developer'?` | Queue mode |

Filters: status (unreviewed, confirmed, rejected variants, needs_context, deferred), severity, category. Sort by severity, confidence, category, reviewedAt. Progress bar with status counts.

### BarrierCard

Card displaying a single Barrier implementation issue.

| Prop | Type | Description |
|------|------|-------------|
| `issue` | `BarrierIssueData` | Barrier issue with analysis |
| `state` | `string?` | Jurisdiction |

Displays: category badge, severity/complexity indicators, confidence score, regulation summary with metadata (sectionType, hasForm, hasIbr), hierarchy breadcrumbs, explanation, text examples, implementation approach, effort estimate, matched phrases (expandable), and regulation link.

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
| `REVIEW_TYPES` | compliance / barrier / definitions / needs_info |
| `COMPLEXITY_LEVELS` | LOW / MEDIUM / MEDIUM-HIGH / HIGH |
| `SEVERITY_THRESHOLDS` | HIGH: 7, MEDIUM: 4, LOW: 1 |

### Centralized Constants (`lib/constants/`)

Additional constants centralized by domain:

| File | Contents |
|------|----------|
| `entity-types.ts` | Entity type definitions and display config |
| `filters.ts` | Filter option arrays (status, severity, tier, etc.) |
| `hierarchy.ts` | Hierarchy level labels and ordering |
| `barriers.ts` | Barrier 18-category definitions and display config |
| `navigation.ts` | Navigation link configuration |
| `pipeline.ts` | Pipeline status colors, classification mappings |
| `values.ts` | Shared value constants (state codes, defaults) |

### Formatters (`lib/formatters/`)

Citation formatting utilities by jurisdiction:

| File | Purpose |
|------|---------|
| `nycrr.ts` | NYCRR (NY) citation formatting |
| `njac.ts` | NJAC (NJ) citation formatting |
| `rcny.ts` | RCNY (NYC) citation formatting |
| `citations.ts` | Generic/cross-jurisdiction citation formatting |

### Custom Hooks

Beyond the hooks listed in the file tree, key custom hooks:

| Hook | Purpose |
|------|---------|
| `useQueue` | Generic queue navigation with pagination and keyboard shortcuts |
| `useSuggestionQueue` | Smart suggestion mode queue with batch-based navigation |
| `useQueueNavigation` | Keyboard shortcuts for queues (j/k navigation, x to select) |
| `useChartDimensions` | Responsive chart container sizing |
| `useChartColors` | Chart color palette based on design tokens |
| `useDeveloperName` | Persist developer name in localStorage |
| `useActiveSection` | IntersectionObserver-based section tracking for navigation |
| `useTermHighlighting` | Definition term highlighting in regulation text |
| `useCrossRefHighlighting` | Cross-reference text highlighting |

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

Generic review form used by ComplianceIssueReviewForm:

```tsx
import { ReviewForm } from '@/components/review';

<ReviewForm
  itemType="compliance_issue"
  item={issue}
  onUpdated={handleUpdated}
  onSubmit={updateComplianceIssueReview}
/>
```

### useReviewForm Hook

Shared state management for review forms:

```tsx
import { useReviewForm } from '@/hooks';

const { formData, updateField, isEditing, setIsEditing, isPending, error, handleSubmit } =
  useReviewForm({
    initialData: item,
    onSubmit: updateComplianceIssueReview,
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
  itemLabel="issues"
  showKeyboardHint
/>
```

### QueueEmptyState

Empty state for queues:

```tsx
import { QueueEmptyState } from '@/components/review/shared';

<QueueEmptyState
  title="No issues found"
  description="Try adjusting your filters."
/>
```

### useQueueNavigation Hook

Keyboard navigation for queues (j/k navigation, focus management):

```tsx
import { useQueueNavigation } from '@/hooks';

const { focusedIndex, setCardRef, handleKeyDown, currentItem } = useQueueNavigation({
  items: issues,
  getItemId: (item) => `issue-${item.id}`,
  onViewRegulation: (item) => setSelectedId(item.regulation.id),
  findNextUnreviewed: (idx) => issues.findIndex((item, i) => i > idx && !item.reviewStatus),
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
│   └── tokens.css              # Design token definitions
├── app/
│   ├── globals.css             # Base styles, imports tokens
│   ├── layout.tsx              # Root layout with Header/Footer
│   ├── page.tsx                # Home dashboard page
│   └── [state]/
│       ├── page.tsx            # State table view
│       ├── browse/
│       │   └── page.tsx        # Browse hierarchy page
│       ├── statutes/
│       │   └── page.tsx        # Browse statute hierarchy page
│       └── review/
│           └── page.tsx        # Review mode page
├── hooks/
│   ├── useActiveSection.ts     # IntersectionObserver for nav highlighting
│   ├── useChartColors.ts       # Chart color palette hook
│   ├── useChartDimensions.ts   # Responsive chart sizing
│   ├── useCrossRefHighlighting.ts # Cross-reference text highlighting
│   ├── useDebouncedValue.ts    # Debounced value hook
│   ├── useDeepLink.ts          # Deep link navigation for review items
│   ├── useDeveloperName.ts     # Persist developer name in localStorage
│   ├── useLocalStorageName.ts  # Generic localStorage name persistence
│   ├── useMediaQuery.ts        # SSR-safe media query hook
│   ├── useQueue.ts             # Generic queue navigation (pagination, keyboard)
│   ├── useQueueNavigation.ts   # Keyboard shortcuts for queue (j/k, x)
│   ├── useRegulationById.ts    # Fetch regulation for modal display
│   ├── useReviewerName.ts      # Persist reviewer name in localStorage
│   ├── useReviewForm.ts        # Review form state management
│   ├── useStateFromPath.ts     # Extract state (ny/nj/nyc) from URL path
│   ├── useSuggestionQueue.ts   # Smart suggestion mode queue hook
│   ├── useTermHighlighting.ts  # Definition term highlighting
│   └── index.ts
├── components/
│   ├── ui/                     # Reusable UI primitives
│   │   ├── Alert.tsx
│   │   ├── Badge.tsx
│   │   ├── BookmarkButton.tsx  # Bookmark/star toggle
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── CopyLinkButton.tsx  # Copy deep link to clipboard
│   │   ├── Drawer.tsx          # Mobile-friendly slide-in panel
│   │   ├── EmptyState.tsx
│   │   ├── EntityTypeIndicator.tsx
│   │   ├── FullTextSearchLink.tsx
│   │   ├── Input.tsx
│   │   ├── KeywordTags.tsx
│   │   ├── LevelBadge.tsx      # Hierarchy level badges
│   │   ├── MarkdownTable.tsx
│   │   ├── MetadataIndicators.tsx
│   │   ├── Modal.tsx           # Radix Dialog wrapper
│   │   ├── Pagination.tsx
│   │   ├── ProgressCard.tsx
│   │   ├── ResizableDivider.tsx # Draggable panel divider
│   │   ├── ScrollToHash.tsx
│   │   ├── SearchableContent.tsx # Inline search with match highlighting
│   │   ├── SearchInput.tsx     # Search with debounce, clear, loading
│   │   ├── SectionTypeBadge.tsx
│   │   ├── SegmentedControl.tsx
│   │   ├── Select.tsx          # Radix Select wrapper
│   │   ├── StatCard.tsx
│   │   ├── Tag.tsx             # Labels, keywords, matched phrases
│   │   ├── Textarea.tsx
│   │   ├── FilterBar/          # Composable filter system
│   │   │   ├── FilterBar.tsx
│   │   │   ├── FilterField.tsx
│   │   │   ├── SortControls.tsx
│   │   │   ├── ClearFiltersButton.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── layout/                 # Layout components
│   │   ├── Header.tsx          # Responsive with mobile menu
│   │   ├── Footer.tsx
│   │   ├── Container.tsx
│   │   ├── GlobalSearch.tsx
│   │   ├── MobileNav.tsx       # Mobile navigation drawer
│   │   ├── NavDropdown.tsx     # Navigation link dropdown
│   │   ├── PageHeader.tsx
│   │   ├── StateContextBar.tsx # Jurisdiction context bar
│   │   └── index.ts
│   ├── navigation/             # Page navigation components
│   │   ├── SidebarSectionIndex.tsx
│   │   ├── StickyPageSectionTabs.tsx
│   │   └── index.ts
│   ├── home/                   # Home dashboard components
│   │   ├── DashboardStats.tsx
│   │   ├── HomePrioritySection.tsx
│   │   ├── PipelineHeroBanner.tsx
│   │   ├── QuickLinks.tsx
│   │   ├── RecentActivityCard.tsx
│   │   ├── StateCard.tsx
│   │   ├── TopIssuesChart.tsx
│   │   └── index.ts
│   ├── auth/                   # Authentication components
│   │   ├── AuthGuard.tsx
│   │   ├── PasswordForm.tsx
│   │   └── ShareLinkModal.tsx
│   ├── bookmarks/              # Bookmark feature
│   │   ├── BookmarksContent.tsx
│   │   └── index.ts
│   ├── browse/                 # Browse hierarchy components
│   │   ├── BrowseClient.tsx
│   │   ├── BrowseFilters.tsx
│   │   ├── HierarchyBreadcrumbs.tsx
│   │   ├── HierarchyTree.tsx
│   │   ├── TreeNode.tsx
│   │   ├── ReferenceHighlightContext.tsx
│   │   ├── DetailPanel/        # Multi-section detail panel
│   │   │   ├── DetailPanel.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── SummarySection.tsx
│   │   │   ├── MetadataSection.tsx
│   │   │   ├── ComplianceIssuesSection.tsx
│   │   │   ├── CrossReferencesSection.tsx
│   │   │   ├── IncomingReferencesSection.tsx
│   │   │   ├── StatuteLinksSection.tsx
│   │   │   └── index.tsx
│   │   └── index.ts
│   ├── definitions/            # Definitions glossary components
│   │   ├── AggregatedTermCard.tsx
│   │   ├── ApplicableDefinitions.tsx
│   │   ├── DefinitionCard.tsx
│   │   ├── DefinitionPopover.tsx
│   │   ├── DefinitionsList.tsx
│   │   ├── GlossaryClient.tsx
│   │   ├── GlossaryFilters.tsx
│   │   ├── GlossarySearch.tsx
│   │   └── index.ts
│   ├── statutes/               # Statute components
│   │   ├── EnablingAuthorityCard.tsx
│   │   ├── StatuteBrowseClient.tsx
│   │   ├── StatuteBrowseFilters.tsx
│   │   ├── StatuteDetailPanel.tsx
│   │   ├── StatuteHierarchyTree.tsx
│   │   ├── StatuteLinksList.tsx
│   │   ├── StatuteTreeNode.tsx
│   │   └── index.ts
│   ├── analysis/               # Pipeline analysis detail components
│   │   ├── AnalysisDashboard.tsx
│   │   ├── AnalysisTable.tsx
│   │   ├── AnalysisTableFilters.tsx
│   │   ├── ExecutiveSummary.tsx
│   │   ├── PipelineFlowVisualizer.tsx
│   │   ├── PipelineTimeline.tsx
│   │   ├── TierSection.tsx
│   │   ├── TierDistributionChart.tsx
│   │   └── ... (25 files total)
│   ├── analytics/              # Analytics dashboard tabs
│   │   ├── AnalyticsClient.tsx
│   │   ├── AnalyticsTabs.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── IssuesTab.tsx
│   │   ├── PipelineTab.tsx
│   │   ├── DefinitionsTab.tsx
│   │   ├── HierarchyTab.tsx
│   │   ├── KeywordsTab.tsx
│   │   ├── StatutesTab.tsx
│   │   ├── CrossReferencesTab.tsx
│   │   ├── BarrierAnalyticsTab.tsx
│   │   ├── cross-references/   # Cross-ref analytics sub-components
│   │   ├── definitions-graph/  # Definitions graph visualizations
│   │   ├── pipeline/           # Pipeline analytics sub-components
│   │   └── index.ts
│   ├── charts/                 # Reusable chart components
│   │   ├── BarChart.tsx
│   │   ├── PieChart.tsx
│   │   ├── HeatmapGrid.tsx
│   │   ├── ChartContainer.tsx
│   │   ├── ChartLegend.tsx
│   │   ├── ChartTooltip.tsx
│   │   ├── ClientChart.tsx
│   │   └── index.ts
│   ├── issues/                 # Compliance issue display components
│   │   ├── OutcomeBadges.tsx
│   │   ├── ComplianceIssueDisplayCard.tsx
│   │   ├── ComplianceIssuesList.tsx
│   │   ├── TierClassificationFlow.tsx
│   │   ├── TierProgressIndicator.tsx
│   │   ├── EvidenceDisplay.tsx
│   │   ├── WebSourceBadge.tsx
│   │   └── index.ts
│   ├── cross-references/       # Cross-reference components
│   │   ├── CrossReferenceCard.tsx
│   │   ├── CrossReferenceList.tsx
│   │   ├── CrossRefPopover.tsx
│   │   └── index.ts
│   ├── ibr/                    # IBR (Standards) page components
│   │   ├── IbrClient.tsx
│   │   ├── IbrBrowseTab.tsx
│   │   ├── IbrOverviewTab.tsx
│   │   ├── IbrTable.tsx
│   │   ├── IbrDetailDrawer.tsx
│   │   └── index.ts
│   ├── notes/                  # Document annotation components
│   │   ├── AnnotatableContent.tsx
│   │   ├── NoteCard.tsx
│   │   ├── NotesSidePanel.tsx
│   │   └── index.ts
│   ├── prompts/                # Prompt management components
│   │   ├── PromptCard.tsx
│   │   ├── PromptsList.tsx
│   │   ├── PromptTemplate.tsx
│   │   ├── PromptVariables.tsx
│   │   ├── FeedbackForm.tsx
│   │   ├── FeedbackList.tsx
│   │   ├── V5PipelineComposer/ # Research pipeline prompt composer
│   │   ├── BarrierPipelineComposer/ # Barrier pipeline prompt composer
│   │   ├── shared/            # Shared prompt components (LayerSection)
│   │   └── index.ts
│   ├── regulations/            # Regulation listing/filtering components
│   │   ├── RegulationCard.tsx
│   │   ├── RegulationCardGrid.tsx
│   │   ├── RegulationContent.tsx
│   │   ├── FacetedFilters.tsx
│   │   ├── ActiveFilterChips.tsx
│   │   ├── ViewToggle.tsx
│   │   └── ... (17 files total)
│   ├── search/                 # Search page components
│   │   ├── SearchResultsClient.tsx
│   │   ├── SearchResultCard.tsx
│   │   ├── SearchFilters.tsx
│   │   ├── CommentarySidebar.tsx
│   │   └── index.ts
│   └── review/                 # Review mode components
│       ├── ReviewCard/              # Review card
│       │   ├── ReviewCard.tsx
│       │   ├── Header.tsx
│       │   ├── LLMAnalysisSection.tsx
│       │   ├── RegulationActions.tsx
│       │   ├── ReviewForm.tsx
│       │   └── index.ts
│       ├── ComplianceIssueCard/     # Compliance review card (8 sub-components)
│       │   ├── ComplianceIssueCard.tsx
│       │   ├── Header.tsx
│       │   ├── TierClassificationSection.tsx
│       │   ├── SummaryContext.tsx
│       │   ├── LLMAnalysisSection.tsx
│       │   ├── EvidenceSection.tsx
│       │   ├── AnalysisDetailsSection.tsx
│       │   ├── TechnicalDetailsSection.tsx
│       │   ├── ReviewForm.tsx
│       │   └── index.tsx
│       ├── DeveloperCard/           # Generic developer card
│       │   ├── DeveloperCard.tsx
│       │   ├── DeveloperForm.tsx
│       │   ├── ReviewSummary.tsx
│       │   ├── ItemContent/
│       │   │   └── ComplianceIssueContent.tsx
│       │   └── index.tsx
│       ├── definitions/             # Definitions review workflow
│       │   ├── DefinitionsReviewQueue.tsx
│       │   ├── DefinitionReviewCard/
│       │   │   ├── DefinitionReviewCard.tsx
│       │   │   ├── Header.tsx
│       │   │   ├── OriginalColumn.tsx
│       │   │   ├── EditableColumn.tsx
│       │   │   ├── SummaryContext.tsx
│       │   │   ├── MetadataSection.tsx
│       │   │   ├── ReviewNotesSection.tsx
│       │   │   ├── ActionButtons.tsx
│       │   │   └── index.tsx
│       │   ├── DefinitionDeveloperCard.tsx
│       │   ├── DefinitionsDeveloperQueue.tsx
│       │   ├── DefinitionsProgress.tsx
│       │   ├── DefinitionsDeveloperProgress.tsx
│       │   ├── DefinitionsReviewFilters.tsx
│       │   ├── DefinitionsDeveloperFilters.tsx
│       │   ├── BulkActionsBar.tsx
│       │   ├── ScopeDocumentTypeahead.tsx
│       │   └── index.ts
│       ├── shared/                  # Shared review components
│       │   ├── CardWrapper.tsx
│       │   ├── HierarchyBreadcrumbsInline.tsx
│       │   ├── HierarchyTreeView.tsx
│       │   ├── HierarchyTreeNodeCompact.tsx
│       │   ├── CornellLink.tsx
│       │   ├── RegulationTextViewer.tsx
│       │   ├── SiblingSectionsView.tsx
│       │   ├── KeyboardHelpModal.tsx
│       │   ├── QueueEmptyState.tsx
│       │   ├── QueuePagination.tsx
│       │   ├── QueueResultsInfo.tsx
│       │   └── index.ts
│       ├── ComplianceReviewQueue.tsx
│       ├── ComplianceFilters.tsx
│       ├── ComplianceQueueModeSwitcher.tsx
│       ├── SuggestionModeControls.tsx
│       ├── ComplianceDeveloperQueue.tsx
│       ├── ComplianceDeveloperFilters.tsx
│       ├── BarrierQueue.tsx
│       ├── BarrierCard.tsx
│       ├── DeveloperQueue.tsx
│       ├── DeveloperProgress.tsx
│       ├── DeveloperFilters.tsx
│       ├── ReviewFilters.tsx
│       ├── ReviewProgress.tsx
│       ├── ReviewModeSwitcher.tsx
│       ├── ReviewTypeTabs.tsx
│       ├── ReviewForm.tsx
│       ├── ExcludedSectionsList.tsx
│       ├── ExpandableRegulationQuote.tsx
│       ├── NeedMoreInfoCard.tsx
│       ├── NeedMoreInfoQueue.tsx
│       ├── QueueReviewFormBase.tsx
│       ├── ReviewPageError.tsx
│       └── index.ts
├── lib/
│   ├── actions/
│   │   ├── types.ts             # ActionResult type and helpers
│   │   ├── analysis.ts          # Pipeline analysis detail actions
│   │   ├── auth.ts              # Password protection actions
│   │   ├── bookmarks.ts         # Bookmark toggle actions
│   │   ├── compliance-issues.ts # Compliance issue CRUD
│   │   ├── cross-references.ts  # Cross-reference actions
│   │   ├── dashboard.ts         # Dashboard stats
│   │   ├── definitions.ts       # Definitions glossary actions
│   │   ├── developer.ts         # Developer mode actions
│   │   ├── document-notes.ts    # Document annotation actions
│   │   ├── hierarchy.ts         # Hierarchy navigation
│   │   ├── ibr.ts               # IBR page actions
│   │   ├── barrier.ts           # Barrier pipeline actions
│   │   ├── pipeline-analytics.ts # Pipeline analytics actions
│   │   ├── prompt-feedback.ts   # Prompt feedback actions
│   │   ├── prompts.ts           # Prompt management actions
│   │   ├── regulations.ts       # Regulation listing/detail
│   │   ├── research-pipeline.ts # Research pipeline actions
│   │   ├── review-page.ts       # Review page data loading
│   │   ├── search.ts            # Full-text search actions
│   │   └── statutes.ts          # Statute actions
│   ├── url/
│   │   ├── parsers.ts           # nuqs query param parsers
│   │   ├── filter-helpers.ts    # Filter utility functions
│   │   ├── type-helpers.ts      # Type narrowing helpers
│   │   └── index.ts
│   ├── constants/
│   │   ├── entity-types.ts      # Entity type definitions
│   │   ├── filters.ts           # Filter option constants
│   │   ├── hierarchy.ts         # Hierarchy level labels
│   │   ├── barrier.ts           # Barrier category constants
│   │   ├── navigation.ts        # Navigation config
│   │   ├── pipeline.ts          # Pipeline status/color constants
│   │   └── values.ts            # Shared value constants
│   ├── formatters/
│   │   ├── citations.ts         # Generic citation formatting
│   │   ├── njac.ts              # NJAC citation formatting
│   │   ├── nycrr.ts             # NYCRR citation formatting
│   │   ├── rcny.ts              # RCNY citation formatting
│   │   └── index.ts
│   ├── analytics.ts             # Analytics utility functions
│   ├── format.ts                # Shared formatting utilities
│   ├── charts/                  # Chart type definitions
│   │   └── types.ts
│   └── utils/
│       ├── expandContext.ts     # Context expansion utility
│       ├── highlight.tsx        # Text highlighting utility
│       ├── sanitize-snippet.ts  # HTML snippet sanitization
│       └── sanitize-snippet.test.ts
├── types/
│   └── regulation.ts            # Constants, helpers, types
└── tailwind.config.ts           # Extended Tailwind theme
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
| `size` | `sm`, `md`, `lg`, `xl`, `full` | `md` | Panel width/height (`xl` = 540px) |

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

Cards: Total Regulations, Analyzed (with % coverage), Compliance Issues (with unreviewed count), Barrier Issues (with unreviewed count). Displays 2 columns on mobile, 4 columns on desktop.

### RecentActivityCard

Shows activity counts from the last 7 days in a 2x2 grid:

```tsx
import { RecentActivityCard } from '@/components/home';

<RecentActivityCard activity={recentActivity} />
```

Metrics: Issues discovered, Issues reviewed, Definitions reviewed, Documents analyzed. Shows "No recent activity" when all counts are zero. Data comes from `getRecentActivity()` server action.

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

<StateCard jurisdiction="ny" stats={nyStats} guidanceTotal={1234} burdenStats={burdenData} />
```

Features:
- State abbreviation badge with accent color (uses CSS custom property vars: `--color-state-{code}-accent`, `--color-state-{code}-bg`, `--color-state-{code}-border`)
- Subtitle shows regulation count + guidance count (when > 0)
- Progress bar: "Compliance Issues Human-Reviewed X/Y"
- Inline burden bar with average score (when burden data available)
- Danger badges for unreviewed issues (only when > 0)
- Hover state with shadow elevation

Optional props: `guidanceTotal?: number`, `burdenStats?: BurdenOverviewStats | null`. Zero/null data is handled gracefully (rows hidden).

### RegulatoryLandscape

3-column grid of linked summary cards providing at-a-glance access to major data domains:

```tsx
import { RegulatoryLandscape } from '@/components/home';

<RegulatoryLandscape
  complianceStats={aggregateStats.complianceIssues}
  guidanceStats={{ total: 13000, agencyCount: 42 }}
  finesStats={{ total: 12000, uniqueAgencies: 35 }}
  jurisdiction="ny"
/>
```

Cards: Compliance Issues (→ pipeline), Guidance Documents (→ guidance), Fines & Fees (→ fines).

Each card uses a left 4px colored border accent (`--color-warning`, `--color-primary`, `--color-danger`), shows a large primary metric, secondary detail text, and reveals an arrow on hover. Null/zero data shows "No data yet".

### QuickLinks

Grid of quick action cards with optional contextual badges:

```tsx
import { QuickLinks } from '@/components/home';

<QuickLinks state="ny" stats={aggregateStats} />
```

Pass `stats` prop to show unreviewed count badge on the Review Queue card. Links to Browse Hierarchy, Review Queue, Analytics, Definitions, Regulations.

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
| `jurisdiction` | `JurisdictionCode` | Jurisdiction code ('ny' or 'nj') for fetching definitions |

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
  description="Breakdown of issues by severity level"
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
  label="Total Issues"
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

// ?tab=overview | crossrefs | issues | keywords | definitions | statutes | guidance | barrier | pipeline
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
  sizeMetric="issues"      // issues | documents | compliance
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
| `jurisdiction` | `JurisdictionCode` | Jurisdiction code (e.g., 'NY', 'NJ') |

Content:
- **Stat cards** (4): Total Statutes, Linked Statutes (with %), Total Links, Regulations with Links (with %)
- **Link Type Distribution**: Horizontal bar chart from `byLinkType` using `LINK_TYPE_LABELS`
- **Match Quality**: Donut chart from `byMatchStatus` using `MATCH_STATUS_LABELS` with color-coded statuses (matched=green, corrected=blue, unmatched=yellow, obsolete=red)
- **Link Type Details**: Grid of count cards for each link type

### BarrierAnalyticsTab

Dedicated analytics tab for barrier framework analysis. 6 scrollable sections with `StickyPageSectionTabs`.

```tsx
import { BarrierAnalyticsTab } from '@/components/analytics';

<BarrierAnalyticsTab
  jurisdiction={stateCode}
  barrierStats={barrierStats}
  barrierSeverity={barrierSeverity}
  categories={barrierCategories}
  parts={barrierParts}
  sectionTypes={barrierSectionTypes}
  developerStatusCounts={barrierDeveloperStatusCounts}
  burdenStats={barrierBurdenStats}
  complexityDistribution={barrierComplexityDistribution}
  categorySeverityMatrix={barrierCategorySeverityMatrix}
  sourceTypeBreakdown={barrierSourceTypeBreakdown}
  reviewProgressByCategory={barrierReviewProgressByCategory}
  burdenScoreDistribution={barrierBurdenScoreDistribution}
/>
```

Sections:
- **Overview**: 4 stat cards (Total Findings, High Severity, Review Progress %, Avg Burden)
- **Category Landscape**: HorizontalBarChart (18 categories, structural highlighted in orange) + PieChart (Structural vs Non-Structural)
- **Severity & Complexity**: Severity PieChart + Complexity PieChart + Category × Severity HeatmapGrid
- **Parts & Sources**: HorizontalBarChart by Part + Section Type + PieChart (Regulation vs Guidance)
- **Review & Developer Progress**: Review Status PieChart + Developer Status PieChart + StackedBarChart (categories × review statuses)
- **Burden Hotspots**: 3 stat cards + BarChart histogram (burden score distribution by bucket)

Uses `STRUCTURAL_CATEGORIES` and `BARRIER_CATEGORY_LABELS` from `lib/constants/barrier.ts`.

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
| `jurisdiction` | `JurisdictionCode` | Jurisdiction code (e.g., 'NJ', 'NY') |
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
- Severity badge and issue count
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
| `jurisdiction` | `JurisdictionCode` | Jurisdiction code for constructing links |
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

### Bulk Selection (AnalysisTable)

Checkbox column (first column, before bookmark) with header select-all checkbox. Uses `useBulkSelection` hook with `rowMarkerKey` ("docId-issueType") as selection keys. Selected rows highlighted with `bg-[var(--color-primary-weaker)]`. When items are selected, renders `BulkActionBar` between table and pagination for bulk bookmark, unmark, marker assignment, and inline category creation. Header checkbox supports indeterminate state when partial selection. "Select all matching" banner appears when all visible rows are selected and more exist across pages.

### AnalysisDetailDrawer Navigation + Triage

The pipeline drawer (`AnalysisDetailDrawer`, `size="xl"` = 540px) includes a sticky toolbar below the header with:

- **Navigation row:** Prev/Next buttons (`ChevronLeft`/`ChevronRight`) with "N of M" counter. Keyboard: `←`/`→` or `p`/`n`.
- **Triage row:** Three color-coded `TriageButtons` — Confirmed (green `#16a34a`), Needs Review (amber `#d97706`), Incorrect (red `#dc2626`). Multi-select. Auto-bookmarks on first tag. Active state: filled background + white text. Inactive: outlined border + colored text.
- **Active row highlight:** Table row for the currently-viewed item gets `ring-1 ring-inset ring-[var(--color-primary)]` + light blue tint.

Triage tags are `marker_groups` with `category = 'triage'`. They also appear in the regular MarkerPicker dropdown.

### Pipeline Detail Page Section Order

1. Header Card (classification flow, final outcome)
2. **Executive Summary Card** (key findings at a glance)
3. Easy Cleanup Card (when flagged)
4. **Severity Progression** (Base -> Web Search -> Final)
5. Marker Badges + Picker (when bookmarked)
6. Bookmark Notes Card (when bookmarked)
7. Regex Matches Section
8. Pipeline Timeline (tier-by-tier journey)
9. Metadata Footer

### Marker Assignment on Detail Pages

All three detail pages (fines, pipeline, guidance) support marker assignment when an item is bookmarked. The pattern:

- **Provider wraps the page** (`FineBookmarkProvider`, `AnalysisBookmarkProvider`, `GuidanceBookmarkProvider`) to share bookmark + marker state
- **MarkerBadge chips** (`size="sm"`) display assigned markers with an `onRemove` callback
- **MarkerPicker** trigger (tag icon) opens a dropdown to assign/unassign marker groups
- Markers appear between the bookmark toggle and the notes card
- Optimistic updates: UI updates instantly, reverts on server action failure
- Marker groups and assigned markers are fetched client-side via `useEffect` (not SSR)
- Components: `MarkerBadge` and `MarkerPicker` from `@/components/markers`

---

## Prompts Page

The Prompts page at `/prompts` displays all LLM prompts used by the regulatory analysis system. It uses a five-tab layout with `SegmentedControl` for tab switching, following the same pattern as IBR and Guidance pages.

### Tab Structure

| Tab | URL param | Component | Description |
|-----|-----------|-----------|-------------|
| Overview | `?tab=overview` (default) | `PromptsOverviewTab` | Stats dashboard, composer quick links, catalog summary |
| Research | `?tab=research` | `V5PipelineComposer` | 3-tier research pipeline prompt composer (full width) |
| Barrier | `?tab=barrier` | `BarrierPipelineComposer` | Barrier pipeline prompt composer |
| Fines | `?tab=fines` | `FinesPipelineComposer` | Fines extraction prompt composer (2-layer) |
| Catalog | `?tab=catalog` | `PromptCatalogTab` | Search + prompt cards + sidebar nav |

### PromptsClient

Client component managing tab state via `promptsParsers` (nuqs). Renders tab content based on active tab. Uses `SegmentedControl` with BarChart3/Layers/Cpu/DollarSign/Code icons. Passes `onNavigateTab` callback to `PromptsOverviewTab` for composer quick links.

### PromptsOverviewTab

Dashboard with five stat cards (Total, Core, Compliance, Barrier, Feedback), two pipeline composer cards with "Open Composer" buttons, a prompt catalog summary card, and optional archived feedback section.

### PromptCatalogTab

Thin wrapper composing `PromptsList` + `PromptNav` in the existing flex layout. `PromptNav` sidebar hidden below `lg` breakpoint.

### PromptsList

Search input + three prompt sections (Core, Compliance by category, Barrier). Stats have been moved to `PromptsOverviewTab` to avoid duplication. Includes empty state and archived feedback rendering.

### File Structure

```
components/prompts/
├── index.ts                # Barrel exports
├── PromptsClient.tsx       # Tab switching client component
├── PromptsOverviewTab.tsx  # Overview dashboard
├── PromptCatalogTab.tsx    # Catalog wrapper (PromptsList + PromptNav)
├── PromptsList.tsx         # Search + prompt sections
├── PromptNav.tsx           # Sidebar navigation
├── PromptCard.tsx          # Core prompt card
├── CompliancePromptCard.tsx # Compliance prompt card
├── ArchivedFeedback.tsx    # Orphaned feedback display
├── FeedbackForm.tsx        # Feedback submission form
├── FeedbackList.tsx        # Feedback display list
├── PromptTemplate.tsx      # Prompt template viewer
├── PromptVariables.tsx     # Prompt variables display
├── V5PipelineComposer/     # Research pipeline composer
├── BarrierPipelineComposer/  # Barrier pipeline prompt composer
├── FinesPipelineComposer/  # Fines extraction prompt composer
└── shared/                 # Shared prompt components (LayerSection)
```

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
{ key: 'ibr', label: 'Referenced Standards', icon: Library, pathSuffix: '/ibr', groupId: 'explorer' }
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

## Guidance Documents Page

The Guidance page at `/[state]/guidance` displays sub-regulatory policy directives (ADMs, LCMs, INFs, GIS, TSBs) from state agencies. It uses the same two-tab layout as IBR (Overview, Browse) with `SegmentedControl` for tab switching.

### Tab Structure

| Tab | Component | Description |
|-----|-----------|-------------|
| Overview | `GuidanceOverviewTab` | Analytics: stat cards, breakdowns by agency/type/category/status |
| Browse | `GuidanceBrowseTab` | Filterable/sortable table with pagination |

### GuidanceOverviewTab

Four stat cards (Total Documents, Active, Agencies, Policy Categories) plus four `HorizontalBarChart` breakdowns: by agency, document type, policy category, and status/year.

### GuidanceBrowseTab

Supports two browse modes via `SegmentedControl` toggle (Flat / Grouped), following the same pattern as the cross-references table's flat/grouped mode.

**Flat mode** (default): Inline filter bar with dropdowns for agency, doc type, policy category, status, plus search input. Uses `GuidanceTable` for display. Pagination at bottom.

**Grouped mode**: Documents aggregated by a selectable dimension (Agency, Doc Type, or Policy Category) via a `Select` dropdown. Shows `GroupedGuidanceTable` with aggregate stats per group. Sort controls are inline in the grouped table headers, not in the `FilterBar`.

All filter/sort/mode state managed via `useQueryStates(guidanceParsers)`.

### GroupedGuidanceTable

Grouped/collapsible table for guidance documents, following the `GroupedCrossRefsTable` pattern from cross-references. Group row columns: expand toggle, Group Name, Documents count, Compliance Issues, Barrier Issues, Year range, Avg Readability (`ReadabilityBadge`). Sortable column headers for group-level metrics.

**Expansion behavior**: Click group row to toggle. First expand lazy-loads documents via `getGuidanceGroupDocuments` server action. Cached in component state; cache cleared when filters/groupBy change.

**Year sub-groups**: Expanded content is bucketed by year using collapsible `YearSection` sub-components. Each year section shows compact document rows (Ref, Title, Type, Status, Issues).

### GuidanceTable

Clickable table rows linking to detail page. Columns: Ref (canonical reference), Title, Agency, Type, Category (`PolicyCategoryBadge`), Status (`GuidanceStatusBadge`), Year.

### GuidanceStatusBadge

Status badge mapping: `active` → success, `superseded` → warning, `canceled` → danger, `expired` → default.

### PolicyCategoryBadge

Badge for policy category values (eligibility, compliance, fiscal, etc.) with distinct color variants per category.

### GuidanceSidebarWithNav

Thin client wrapper around `SidebarSectionIndex` for the guidance detail page. Provides scrollspy pill navigation at the top of the sidebar, matching the `RegulationSidebarWithNav` pattern. Sections are built conditionally based on available data (Summary, Metadata, Readability, Compliance, Barrier, Lineage). Lives in `app/[state]/guidance/[id]/GuidanceSidebarWithNav.tsx`.

The guidance detail page uses `RegulationDetailLayout` for its two-column sticky layout (same as regulation and statute pages), with all sidebar content inlined in `page.tsx` and wrapped in `GuidanceSidebarWithNav`. The former `GuidanceDetailSidebar` component is no longer used — its content is rendered directly in the page for easier section ID assignment.

### AudienceCard

Audience classification card rendered in the guidance detail sidebar below the metadata card. Shows:
- **Direction badge**: `public` (green), `government` (blue), `both` (yellow)
- **Expertise badge**: `lay` (green), `specialized` (yellow), `mixed` (default)
- **Target Audience** as `Tag` chips (e.g., "Local DSS", "Child Care Providers")
- **Explanation** as muted text paragraph

Returns `null` when all audience fields are empty.

### GuidanceDetailContent

Document text content with "View Original" external link when a URL is available.

### DocumentLineageViewer

Full transitive document lineage viewer using a CSS vertical timeline. Shows the complete revision/supersedure chain from oldest to newest, with the current document highlighted. Each node displays canonicalRef, title, agency, year, and status badge. Non-current nodes are clickable links to navigate the chain. Returns null when a document has no lineage (chain length ≤ 1). Replaces the former single-level `SupersedureChain` component.

### GuidanceClient

Client component managing tab state via `guidanceParsers` (nuqs). Renders `GuidanceOverviewTab` or `GuidanceBrowseTab` based on active tab. Uses `SegmentedControl` with BarChart3/List icons.

### Navigation Integration

Guidance appears in the Explorer nav group after Referenced Standards:
```typescript
{ key: 'guidance', label: 'Guidance', icon: ScrollText, pathSuffix: '/guidance', groupId: 'explorer' }
```

### File Structure

```
components/guidance/
├── index.ts                  # Barrel exports
├── GuidanceClient.tsx        # Tab switching client component
├── GuidanceOverviewTab.tsx   # Overview analytics
├── GuidanceBrowseTab.tsx     # Filter + flat/grouped toggle + conditional render
├── GuidanceTable.tsx         # Flat clickable data table
├── GroupedGuidanceTable.tsx  # Grouped/collapsible table with lazy-load expansion
├── GuidanceStatusBadge.tsx   # Status badge
├── PolicyCategoryBadge.tsx   # Policy category badge
├── GuidanceDetailSidebar.tsx # (deprecated — sidebar content inlined in page.tsx)
├── GuidanceDetailContent.tsx # Detail page content display
├── AudienceCard.tsx         # Audience classification metadata card
├── DocumentLineageViewer.tsx    # Full transitive document lineage timeline
├── LinkedCitationList.tsx       # Linked citation list
├── GuidanceBookmarkButton.tsx   # Bookmark toggle (standalone, used in browse)
└── GuidanceDetailBookmark.tsx   # Provider + bookmark toggle + markers for detail page
```

---

## Entity Type Visual System

The app has 8 core data entity types. Each has a distinct visual identity (icon + color palette) defined once in `src/lib/constants/entity-types.ts` and applied everywhere via the `EntityTypeIndicator` component.

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
| Definition | `BookOpen` | `text-sky-600` | `bg-sky-50` | `border-sky-300` |
| Cross-Reference | `Link2` | `text-indigo-600` | `bg-indigo-50` | `border-indigo-300` |
| IBR/Standard | `Library` | `text-emerald-600` | `bg-emerald-50` | `border-emerald-300` |
| Guidance Document | `ScrollText` | `text-teal-600` | `bg-teal-50` | `border-teal-300` |
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
<EntityTypeIndicator type="compliance_issue" size="sm" />

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
- **Navigation**: Nav items that map to entity types (Statutes, Definitions, IBR, Bookmarks) import icons from `entity-types.ts`; view/action nav items (Browse, Regulations, Pipeline) keep their own icons
- **Cross-reference direction**: Both outgoing and incoming cross-references use the same `Link2` + indigo. The section title ("Cross-References" vs "Cited By") communicates direction

## Fines, Fees & Penalties Components

Components for browsing, filtering, and viewing extracted fines/fees/penalties from regulations and guidance documents.

### Centralized Constants (`lib/constants/fines.ts`)

All penalty type display values are centralized in a single constants file to avoid duplication across components:

- **`PENALTY_TYPE_LABELS`** -- Singular labels (`Fine`, `Fee`, `Penalty`, etc.) for table cells and detail views
- **`PENALTY_TYPE_LABELS_PLURAL`** -- Plural labels (`Fines`, `Fees`, `Penalties`, etc.) for charts and overview summaries
- **`PENALTY_TYPE_COLORS`** -- Badge color classes using semantic CSS variable tokens

**Color mapping rationale:**

| Type | Semantic Token | Rationale |
|------|---------------|-----------|
| `fine` | `danger` (red) | Direct monetary penalty |
| `penalty` | `warning` (amber) | Punitive but broader |
| `fee` | `info` (blue) | Administrative cost |
| `surcharge` | `warning` (amber) | Additional charge |
| `forfeiture` | `danger` (red) | Loss of asset/right |
| `other` | `neutral` (gray) | Uncategorized |

Badge classes use CSS variable tokens (e.g., `bg-[var(--color-danger-bg)] text-[var(--color-danger)]`) instead of raw Tailwind colors to stay consistent with the design system.

**Source type constants** are also centralized in the same file:

- **`SOURCE_TYPE_COLORS`** -- Badge colors: `regulation` → `info` (blue), `guidance` → `warning` (amber)
- **`SOURCE_TYPE_BADGE_LABELS`** -- Short labels for inline badges: `Reg`, `Guidance`
- **`SOURCE_TYPE_LABELS`** -- Full labels for charts and filters: `Regulations`, `Guidance Documents`

**Inline source type badge pattern:** Small badges (`text-[10px]`, `px-1.5 py-0.5`) placed inline before a link or title to indicate document source type. Used in the FinesTable Source column:

```tsx
<div className="flex items-center gap-1.5">
  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${SOURCE_TYPE_COLORS[sourceType]}`}>
    {SOURCE_TYPE_BADGE_LABELS[sourceType]}
  </span>
  <Link ...>{title}</Link>
</div>
```

### FinesTable

Data table displaying paginated fines with penalty type badge, amount, agency, level, who pays, description, and source link.

- Standard table styling: `border-[var(--color-neutral-200)]` borders, `hover:bg-[var(--color-neutral-50)]` row hover
- Penalty type column renders a badge using `PENALTY_TYPE_COLORS` and `PENALTY_TYPE_LABELS` from constants
- Who Pays column: `max-w-[150px] truncate`, shows `whoPays` value or "—" for nulls
- Source column: inline source type badge (`Reg`/`Guidance`) before the document title link
- Clickable rows open `FinesDetailDrawer`
- Falls back to `EmptyState` when no data
- Optional bookmark star column: `BookmarkButton` with `sm` size, click stops propagation to avoid triggering row click. Controlled via `bookmarkedFineIds` (Set<number>) and `onToggleBookmark` props
- **Bulk selection**: checkbox column (first column, before bookmark) with header select-all checkbox. Uses `useBulkSelection` hook. Selected rows highlighted with `bg-[var(--color-primary-weaker)]`. When items are selected, renders `BulkActionBar` as a sticky footer bar for bulk bookmark, unmark, marker assignment, and inline category creation. "Select all matching" banner appears when all visible rows are selected and more exist across pages

### FinesDetailDrawer

Right-side drawer showing full detail for a selected fine/fee/penalty.

- Uses the shared `Drawer` component (`side="right"`, `size="lg"`)
- Sections: Violation/Trigger, Who Pays, Amount Details, Requirement Quote, Context, Pattern Matched, Source Document
- Section headers use `text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider`
- Requirement quote uses `border-l-2 border-[var(--color-primary)]` blockquote style
- `FineBookmarkButton` in drawer header (next to close button)
- "View full details →" link at bottom of drawer body, linking to `/[state]/fines/[fineId]`

### FineDetailContent

Full-page detail view for individual fines (at `/[state]/fines/[fineId]`).

- 2-column layout: main content (left) + sidebar (right)
- Main: Violation/Trigger, Who Pays, Activity Category + Estimated Impact, Justification, Amount Details, Requirement Quote, Full Context, Pattern Matched
- Sidebar: Type/level badges, agency info, source document card with link, bookmark section (`FineBookmarkButton` + `BookmarkNotesEditor` with name field)
- Follows same server component → client component pattern as guidance detail page
- Detail page wrapped in `FineBookmarkProvider` -- provides shared bookmark + marker state to header star and notes card
- `FineDetailNotesCard` renders marker badges + picker above the notes card when bookmarked

### FineBookmarkButton

Bookmark toggle button for fines (cloned from `GuidanceBookmarkButton`). Accepts `fineId`, `jurisdiction`, optional `size`/`showLabel`. Uses `useBookmarkName` for auto-filling creator name. Optimistic updates with rollback on failure.

### FinesBrowseTab

Browse view with filter bar, paginated results, CSV export, and per-agency ZIP export.

- 7 filters via `FilterBar` + `nuqs` URL state (`finesParsers`):
  - **Penalty Type** -- `MultiSelect` with `PENALTY_TYPE_MULTISELECT_OPTIONS`, empty = all types. Uses `parseCommaSeparated`/`serializeCommaSeparated`
  - **Source Type** -- `Select` dropdown (All Sources / Regulations / Guidance Documents), uses `SOURCE_TYPE_LABELS`
  - **Agency** -- `MultiSelect`, dynamic values from `getFinesAgencies()`, empty = all agencies
  - **Who Pays** -- `MultiSelect` with `count` field (right-aligned, non-truncating), dynamic values from `getFinesWhoPays()`, empty = all
  - **Per Unit** -- `MultiSelect`, dynamic values from `getFinesPerUnits()`, empty = all
  - **Amount Range** -- two compact `<input type="number">` (Min $ / Max $), styled inline with filter bar
  - **Search** -- free-text search via `SearchInput`
- Error state displayed as a danger banner above results card
- Three export buttons in results header, separated by a vertical divider:
  - **Export All (CSV)** -- ghost variant, always exports full unfiltered data via `exportAllFinesCsv`
  - **Export Filtered CSV** / **Export CSV** -- secondary variant, exports current filtered results. Shows `Filter` icon prefix when filters are active
  - **Export Filtered by Agency (ZIP)** / **Export by Agency (ZIP)** -- secondary variant, generates a ZIP file (via `jszip`) with one CSV per agency. Shows `Filter` icon prefix when filters are active
- When filters are active, muted text below filtered export buttons shows count: "Exports N filtered results"
- Filtered export buttons disabled when `total === 0`; "Export All" remains enabled

### FinesOverviewTab

Summary statistics and charts for fines data.

- Four `StatCard`s in a `StatGrid columns={4}`: Total Fines & Fees, Agencies, From Regulations, From Guidance
- Five `HorizontalBarChart`s:
  - Row 1 (2-col grid): By Type (`PENALTY_TYPE_LABELS_PLURAL`), By Government Level (`AGENCY_LEVEL_LABELS`)
  - Row 2 (2-col grid): By Who Pays (title-cased), By Source Type (`SOURCE_TYPE_LABELS`)
  - Row 3 (full-width): By Agency

### File Structure

```
src/components/fines/
  FineBookmarkButton.tsx  -- Bookmark toggle for fines (uses useBookmarkName)
  FinesBrowseTab.tsx      -- Browse with 7 filters, pagination, CSV + ZIP export, bookmark integration
  FinesClient.tsx         -- Tab container (Overview / Browse), passes server data to tabs
  FineDetailContent.tsx   -- Full-page detail view (2-column layout)
  FinesDetailDrawer.tsx   -- Right-side detail drawer with bookmark + detail link
  FinesOverviewTab.tsx    -- Stats + charts overview
  FinesTable.tsx          -- Data table with optional bookmark star column
src/app/[state]/fines/[fineId]/
  page.tsx                -- Server component for fine detail page
src/hooks/
  useBookmarkName.ts      -- localStorage hook for bookmark creator name
src/lib/constants/
  fines.ts                -- PENALTY_TYPE_LABELS, PENALTY_TYPE_LABELS_PLURAL, PENALTY_TYPE_COLORS, SOURCE_TYPE_LABELS, SOURCE_TYPE_COLORS, SOURCE_TYPE_BADGE_LABELS, ACTIVITY_CATEGORY_LABELS, ESTIMATED_PAYERS_LABELS
src/lib/url/parsers.ts    -- finesParsers (tab, page, pageSize, sortBy, sortOrder, penaltyType, agency, search, sourceType, amountMin, amountMax, whoPays, perUnit)
```

---

## Barrier Strategies Components

Components for browsing Barrier framework findings filtered by different analysis strategies. Located in `components/barriers/`.

### BarrierStrategiesClient

Main client component using `nuqs` URL state via `barrierStrategyParsers`. Uses `SegmentedControl` with 5 tabs: Overview, Best Stories, Surprises, Core Framework, Action Plan.

### BarrierOverviewTab

Stats overview with 4 `StatCard`s in a `StatGrid columns={4}`: Total Findings, Best Stories, Surprises, Core Framework. Two `HorizontalBarChart`s showing category and severity distributions.

### BarrierBrowseTab

Browse tab shared across all 4 strategy tabs. Shows strategy description banner, `FilterBar` with category (MultiSelect), severity (Select), and search. Paginated results using `BarrierStrategyTable`.

### BarrierStrategyTable

Data table with columns: Category (color badge), Severity (color badge), Type (regulation/guidance badge), Source (link), Explanation (truncated with `line-clamp-2`). Uses `tableHeaderClass` and `tableRowClass` from `ui/table-styles`.

### File Layout

```
src/components/barriers/
  BarrierStrategiesClient.tsx -- Tab container (Overview + 4 strategy tabs)
  BarrierOverviewTab.tsx      -- Stats + charts overview
  BarrierBrowseTab.tsx        -- Browse with filters, pagination per strategy
  BarrierStrategyTable.tsx    -- Data table for strategy findings
src/app/[state]/barriers/
  page.tsx                  -- Server component fetching stats
src/lib/actions/
  barrier-strategies.ts       -- Server actions (stats + paginated query with strategy filters)
src/lib/url/parsers.ts      -- barrierStrategyParsers (tab, page, pageSize, sortBy, sortOrder, category, severity, search)
```

---

## Burden Index Components

Components for browsing and filtering regulatory documents ranked by composite burden score. Located in `components/burden/`.

### BurdenClient

Main client component using `nuqs` URL state via `burdenParsers`. No tabs — single-page layout with stats, filters, and ranked list.

**Overview section:**
- `StatGrid columns={4}` with 4 `StatCard`s: Documents Analyzed, High Burden (>40), Average Score, Top Structural Category

**Filters:**
- Source: `Select` (All / Regulations / Guidance)
- Min Severity: `Select` (Any / 4+ / 7+)
- Category: `Select` dropdown of 6 structural categories
- Sort By: `Select` (adjustedBurden / compositeBurden / maxSeverity / issueCount)
- Order: `Select` (Highest First / Lowest First)
- Search: `SearchInput` for document titles

**Ranked document list:**
Each row is a `Card` displaying:
- **Rank badge** (left, circle with number)
- **Document title** (linked to regulation/guidance detail page) with external link icon
- **Source badge** (Regulation/Guidance, color-coded)
- **Score section** (right-aligned): adjusted burden (large), raw composite, max severity, issue count
- **Structural cluster indicators**: 6 small badges (`Admin`, `Steps`, `Complex`, `One-Size`, `Rigidity`, `Unfunded`), filled with warning colors when present
- **"Why this ranks high" explanation**: italic text computed from structured data

**File structure:**
```
src/components/burden/
  BurdenClient.tsx          -- Full page client component with stats, filters, ranked list
src/app/[state]/burden/
  page.tsx                  -- Server component (validates jurisdiction, fetches stats)
src/lib/url/parsers.ts      -- burdenParsers (page, pageSize, sortBy, sortOrder, source, severity, category, part, sectionType, search)
```

---

## Pipeline Source Tab Pattern

The Pipeline page uses a `SegmentedControl` to switch between regulation-sourced and guidance-sourced compliance issues. Both tabs share the same table columns, badges, sort/filter controls, and review flow -- only the underlying document context differs.

### Source Tabs

| Source | Description | URL Param |
|--------|-------------|-----------|
| Regulations | Compliance issues found in regulatory documents (NYCRR, NJAC, RCNY) | `?source=regulations` (default) |
| Guidance | Compliance issues found in guidance documents (letters, directives, memos) | `?source=guidance` |

### Analysis Table Consistency

Both regulation and guidance analysis tables render identical columns:
- Bookmark toggle (star icon -- bookmarking supported for both sources)
- Issue Type (with `ISSUE_TYPE_LABELS` for human-readable names)
- Document (regulation section number or guidance document title)
- T1, T2, T3 (tier classification badges)
- Severity (numeric severity score)
- Federal (federal mandate indicator)
- Easy Fix (easy fix indicator)
- Actions (review actions)

The Document column links to the appropriate pipeline detail page (`/[state]/pipeline/[docId]/[issueType]` for regulations, `/[state]/pipeline/guidance/[guidanceDocumentId]/[issueType]` for guidance).

### Guidance Context Pattern vs Regulatory Context

| Aspect | Regulatory Context | Guidance Context |
|--------|-------------------|------------------|
| Document reference | Section number (e.g., "18 NYCRR 415.2") | Document title + canonical ref |
| Detail link | `/[state]/pipeline/[docId]/[issueType]` | `/[state]/pipeline/guidance/[guidanceDocumentId]/[issueType]` |
| Hierarchy | Title > Part > Subpart > Section | Agency > Doc Type > Document |
| Compliance summary | Per-section analysis | `GuidanceComplianceCard` on detail page |

### GuidanceComplianceCard

Displayed on guidance document detail pages when compliance issues exist. Shows:
- Regex match count vs analyzed count
- Burdensome/justified breakdown with color-coded icons
- Top 5 issue types with counts
- Link to pipeline (`/{state}/pipeline?source=guidance`)

Uses `Card` + `CardHeader`/`CardTitle` layout. Stats use a 4-column grid with icon+label+value pattern matching `StatCard` visual weight.

```tsx
import { GuidanceComplianceCard } from '@/components/guidance/GuidanceComplianceCard';

<GuidanceComplianceCard summary={complianceSummary} state={state} />
```

### ReadabilityBadge

Color-coded Badge displaying Flesch Reading Ease score with difficulty label. Thresholds: 0-29 danger ("Very Difficult"), 30-49 warning ("Difficult"), 50-59 warning ("Fairly Difficult"), 60-69 default ("Standard"), 70+ success ("Easy"). Shows numeric score alongside the label (e.g., "32 - Difficult"). Also exports `getReadabilityLabel(score)` helper for use in stat cards.

```tsx
import { ReadabilityBadge } from '@/components/guidance/ReadabilityBadge';

<ReadabilityBadge score={doc.fleschReadingEase} />
```

### ReadabilityMetricsCard

Sidebar card on guidance document detail pages showing readability metrics. Only renders when `doc.wordCount` is not null. Displays:
- Flesch Reading Ease prominently with `ReadabilityBadge`
- Consensus grade level from `readingGradeLevel`
- 2-column grid of detailed scores: FK Grade, Gunning Fog, ARI, Coleman-Liau, SMOG, Dale-Chall, Linsear Write
- Word count, sentence count, and difficult word percentage

Uses `Card` + `CardHeader`/`CardTitle` layout with CSS variable styling.

```tsx
import { ReadabilityMetricsCard } from '@/components/guidance/ReadabilityMetricsCard';

<ReadabilityMetricsCard doc={doc} />
```

### ReadabilityCrossCutSection

Analytics section showing cross-cutting analysis of readability complexity against compliance issues and Barrier implementation burden, segmented by target audience. Renders up to 10 charts across 5 rows:

- **Headline stats**: Public-facing ease, government-internal ease, lay audience ease, specialist ease
- **Row 1**: Reading ease by audience direction + by expertise level
- **Row 2**: Compliance issues by readability bucket + Barrier severity by readability bucket
- **Row 3**: Compliance issues by direction + by expertise
- **Row 4**: Grade level by target audience tag + compliance issues by tag
- **Row 5**: Barrier severity by direction + by tag

Only renders sections where data exists. Returns null if no cross-cut data.

```tsx
import { ReadabilityCrossCutSection } from '@/components/guidance/ReadabilityCrossCutSection';

<ReadabilityCrossCutSection stats={crossCutStats} />
```

## Review Tab Consistency

The Review page supports 5 tab types defined in `REVIEW_TYPE_VALUES`:
- **Compliance Issues**: Compliance issues from regulation analysis
- **Definitions**: Definition review/editing
- **Needs More Info**: Items requiring additional context
- **Barrier**: Barrier framework analysis results
- **Guidance**: Compliance issues from guidance documents (links to Pipeline)

Each tab shows a count badge in the tab button. The `ReviewTypeTabs` component handles both review mode and developer mode layouts. The Guidance tab currently renders a `GuidanceReviewPlaceholder` that links to the Pipeline page with `?source=guidance`, since guidance compliance issues share the pipeline review workflow.

### Adding a New Review Tab

1. Add the value to `REVIEW_TYPE_VALUES` in `lib/constants/values.ts`
2. Add the label mapping in `REVIEW_TYPES` in `types/regulation.ts`
3. Add `guidance: number` to `TabCounts` in `lib/actions/review-page.ts`
4. Add the count to both `getDeveloperModeCountsData` and `getReviewModeCountsData`
5. Add `counts.guidance` to `ReviewTypeTabsProps` and render the tab button
6. Add `case 'guidance'` to both `renderDeveloperMode` and `renderReviewMode` switches
7. Skip redirect logic for tabs that don't use `reviewStatus`/`developerStatus` filters
