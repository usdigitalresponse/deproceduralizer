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

---

## Files Structure

```
apps/web/src/
├── styles/
│   └── tokens.css          # Design token definitions
├── app/
│   ├── globals.css         # Base styles, imports tokens
│   ├── layout.tsx          # Root layout with Header/Footer
│   └── review/
│       └── page.tsx        # Review mode page (server component)
├── components/
│   ├── ui/                 # Reusable UI primitives
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Select.tsx      # Radix Select wrapper
│   │   ├── Modal.tsx       # Radix Dialog wrapper
│   │   └── index.ts
│   ├── layout/             # Layout components
│   │   ├── Header.tsx      # Includes nav links to Review Mode
│   │   ├── Footer.tsx
│   │   ├── Container.tsx
│   │   ├── PageHeader.tsx
│   │   └── index.ts
│   └── review/             # Review mode components
│       ├── ReviewQueue.tsx      # Main container with state
│       ├── ReviewCard.tsx       # Individual flag card
│       ├── ReviewFilters.tsx    # Filter bar
│       ├── ReviewProgress.tsx   # Progress indicator
│       ├── ReviewKeyboardNav.tsx # Keyboard shortcuts
│       ├── RegulationModal.tsx  # Regulation detail modal
│       └── index.ts
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
