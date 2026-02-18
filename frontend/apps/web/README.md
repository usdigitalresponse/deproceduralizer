# Deproceduralizer Web App

A regulatory analysis tool for identifying compliance issues, procedural complexity, and technical review requirements in government regulations.

## Overview

The Deproceduralizer is a web application that helps policy reviewers and government staff analyze regulatory documents. It identifies "red flags" - areas of complexity, compliance issues, and sections requiring technical review - and provides a searchable interface for reviewing and annotating findings.

### Key Features

- **Home Dashboard**: Overview of stats across all states with quick navigation
- **Multi-State Support**: View and analyze regulations from NY and NJ
- **Red Flag Analysis**: AI-powered identification of regulatory complexity and compliance issues
- **Compliance Issues**: Detection of 40+ compliance issue types (wet signatures, mail-only, etc.)
- **Definitions Glossary**: Searchable A-Z glossary with List and Grouped view modes
- **Browse Hierarchy**: Tree view of regulations organized by titles, parts, and sections
- **Review Workflow**: Mark items as confirmed, false positive, needs context, or deferred
- **Developer Mode**: Track implementation status, developer assignment, resolution type
- **Table View**: Sortable, filterable data table with full-text search
- **Mobile Responsive**: Fully responsive design with drawer patterns for mobile browsing

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for comprehensive component documentation including Review Mode, Developer Mode, and Definitions components.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database (see `/packages/database` for schema)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database connection string
```

### Development

```bash
# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Production Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Home dashboard
│   │   ├── layout.tsx          # Root layout with header/footer
│   │   ├── globals.css         # Global styles
│   │   └── [state]/            # State-specific routes (ny, nj)
│   │       ├── page.tsx        # Table view
│   │       ├── browse/         # Hierarchy browser
│   │       ├── definitions/    # Definitions glossary
│   │       └── review/         # Review workflow (flags, issues, definitions)
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Drawer.tsx      # Mobile slide-in panel
│   │   │   ├── Modal.tsx       # Radix Dialog wrapper
│   │   │   └── ...
│   │   ├── layout/             # Layout components
│   │   │   ├── Header.tsx      # Responsive with mobile menu
│   │   │   ├── MobileNav.tsx   # Mobile navigation drawer
│   │   │   └── ...
│   │   ├── home/               # Dashboard components
│   │   ├── browse/             # Browse hierarchy components
│   │   ├── definitions/        # Definitions glossary components
│   │   ├── flags/              # Red flag display components
│   │   ├── issues/             # Compliance issue components
│   │   └── review/             # Review queue and shared components
│   ├── hooks/                  # Custom React hooks
│   │   └── useMediaQuery.ts    # SSR-safe media query
│   ├── lib/                    # Utilities and server actions
│   └── styles/
│       └── tokens.css          # Design token definitions
├── STYLE_GUIDE.md              # Design system documentation
└── tailwind.config.ts
```

## Design System

The app follows a "modern civic" design language with:

- **Primary color**: Navy blue (`#154973`)
- **Typography**: Inter (sans-serif), JetBrains Mono (monospace)
- **Components**: Built on Radix UI primitives for accessibility
- **Tokens**: CSS custom properties for consistent theming

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for complete design documentation.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Styling**: Tailwind CSS v4 with CSS custom properties
- **UI Components**: [Radix UI](https://www.radix-ui.com/) primitives
- **Data Table**: [TanStack Table](https://tanstack.com/table)
- **Database**: PostgreSQL with Drizzle ORM (via `@deproceduralizer/database`)
- **Fonts**: Inter, JetBrains Mono (Google Fonts)

## Acknowledgments

Built with support from [Recoding America Fund](https://www.recodingamerica.fund).
