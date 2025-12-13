# Deproceduralizer Web App

A regulatory analysis tool for identifying compliance issues, procedural complexity, and technical review requirements in government regulations.

## Overview

The Deproceduralizer is a web application that helps policy reviewers and government staff analyze regulatory documents. It identifies "red flags" - areas of complexity, compliance issues, and sections requiring technical review - and provides a searchable interface for reviewing and annotating findings.

### Key Features

- **Red Flag Analysis**: AI-powered identification of regulatory complexity and compliance issues
- **Searchable Database**: Full-text search across regulations and analysis results
- **Review Workflow**: Mark flags as confirmed, false positive, needs context, or deferred
- **Severity & Priority Tracking**: Categorize issues by severity level and priority
- **Detailed Modal View**: Deep-dive into individual regulations with full context

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
│   │   ├── page.tsx            # Main regulations list
│   │   ├── layout.tsx          # Root layout with header/footer
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx       # Radix Dialog wrapper
│   │   │   └── ...
│   │   ├── layout/             # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Container.tsx
│   │   ├── DataTable.tsx       # Main data table
│   │   ├── DetailModal.tsx     # Regulation detail view
│   │   └── RedFlagReviewForm.tsx
│   ├── hooks/                  # Custom React hooks
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
