---
name: web-scraping
description: Scrape, download, extract, and enrich guidance documents from NY state agency websites. Use when adding new scrapers, downloading documents, handling sites that need a browser to download, or troubleshooting download failures.
---

# Web Scraping & Document Pipeline

## Architecture Overview

The **nys-documents** repo (sibling at `../nys-documents`) handles all web scraping. The **newyork** repo imports the results via the guidance pipeline (`backend/scripts/guidance_pipeline/`).

```
nys-documents repo                          newyork repo
┌─────────────────────────────────┐        ┌──────────────────────┐
│ scrape → merge → download →     │        │ guidance_pipeline    │
│ extract → enrich → merge-enrich │───────→│ --execute            │
└─────────────────────────────────┘        └──────────────────────┘
```

## nys-documents Pipeline Steps

Run from `cd ../nys-documents`:

| Step | Command | What it does |
|------|---------|-------------|
| 1. Scrape | `npm run scrape` | Runs all scrapers, outputs to `data/raw/scraped/` |
| 2. Merge | `npm run merge` | Merges scraped docs into `data/raw/master_catalog.csv` |
| 3. Download | `npm run download` | Downloads files for `pending`/`failed` entries |
| 4. Extract | `npm run extract` | Extracts text (PDF→text, HTML→text, DOCX→text) |
| 5. Enrich | `npm run enrich` | Enriches metadata (titles, dates, tags) |
| 6. Merge enriched | `npm run merge-enriched` | Produces `data/enriched_catalog.json` |

## Key Files (nys-documents)

| File | Purpose |
|------|---------|
| `src/scrapers/agencies/*.ts` | Individual agency scrapers |
| `src/downloaders/playwright-downloader.ts` | Browser-based downloads for sites that don't serve files to plain HTTP clients |
| `src/downloaders/http-downloader.ts` | Simple HTTP downloads |
| `src/downloaders/index.ts` | Domain→downloader routing (`PLAYWRIGHT_DOMAINS`) |
| `src/downloaders/base-downloader.ts` | Content validation, logging |
| `scripts/download.ts` | Download orchestrator |
| `scripts/scrape.ts` | Scraper registry (all scrapers registered here) |
| `data/raw/master_catalog.csv` | Master catalog of all documents |
| `data/raw/download_log.csv` | Playwright download log |
| `data/enriched_catalog.json` | Final enriched output consumed by newyork repo |

## Sites That Need a Browser

Some agency sites don't serve documents to plain HTTP clients. The downloader routes those domains to Playwright through `PLAYWRIGHT_DOMAINS` in `src/downloaders/index.ts`. The details live in the **nys-documents** repo, which collects the guidance documents. This repo only imports its output.

**Note:** some sites still refuse automated downloads. When that happens, skip the document rather than working around the site's controls.

### Debugging Downloads

```bash
# Check download log for failure reasons
grep "failed" data/raw/download_log.csv | tail -20

# Check specific URL
grep "ocfs.ny.gov/some/path" data/raw/download_log.csv

# Reset specific entries to retry
python3 -c "
import csv
target_ids = {'12345'}  # catalog IDs to reset
rows = []
with open('data/raw/master_catalog.csv', 'r') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        if row['id'] in target_ids:
            row['download_status'] = 'pending'
        rows.append(row)
with open('data/raw/master_catalog.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
"

# Then re-run download
npm run download
```

## Writing a New Scraper

Scrapers live in `nys-documents/src/scrapers/agencies/`. Each scraper:
1. Exports a function matching the `Scraper` type
2. Navigates/fetches an agency's document index page
3. Returns `ScrapedDocument[]` with metadata (title, url, agency, date, etc.)

### Scraper Template

```typescript
import type { ScrapedDocument } from '../../types/catalog.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeAgencyDocs(): Promise<ScrapedDocument[]> {
  const docs: ScrapedDocument[] = [];
  const { data } = await axios.get('https://agency.ny.gov/documents');
  const $ = cheerio.load(data);

  $('a[href$=".pdf"]').each((_, el) => {
    docs.push({
      agency: 'AGENCY_CODE',
      agency_division: 'Division Name',
      title: $(el).text().trim(),
      url: new URL($(el).attr('href')!, 'https://agency.ny.gov').toString(),
      domain: 'regulatory_domain',
      doc_type: 'guidance',
      file_format: 'pdf',
      source_project: 'project_name',
    });
  });

  return docs;
}
```

### Registering a Scraper

Add to `scripts/scrape.ts`:
```typescript
import { scrapeAgencyDocs } from '../src/scrapers/agencies/agency-name.js';
scrapers.set('agency-name', scrapeAgencyDocs);
```

## Curated Manifest Scraper

For one-off URL lists (e.g., hand-picked URLs), use the curated manifest pattern:
- Put URLs in `data/raw/curated-manifest.json`
- The `curated-manifest.ts` scraper reads the JSON and emits `ScrapedDocument[]` without HTTP
- Merge into catalog via `npm run scrape && npm run merge`

## Content Validation

`base-downloader.ts` validates downloaded content by checking file headers:

| Format | Magic bytes | Validation |
|--------|------------|------------|
| PDF | `%PDF` (0x25504446) | Valid |
| DOCX/XLSX | `PK` (0x504B0304) | Valid (ZIP) |
| DOC/XLS | OLE2 (0xD0CF11E0) | Valid |
| HTML (expected) | `<!DOCTYPE` or `<html` | Valid only if `file_format === 'html'` |
| HTML (unexpected) | `<!DOCTYPE` or `<html` | **Rejected as `html_bot_page`** — usually means the site served an error or block page instead of the file |

## Import to Database (newyork repo)

After the nys-documents pipeline completes:
```bash
cd backend
python3 -m scripts.guidance_pipeline --execute
```

Add `--extract-content-refs --execute` to extract cross-references from document content, `--gap-analysis` for coverage gaps.

## Lessons Learned

- **Blocked ≠ 404**: `ERR_CONNECTION_RESET` or `html_bot_page` usually means the site refused the request, not that the URL is dead. Check it in a regular browser before marking it dead.
- **PDF viewer trap**: Chrome renders PDFs in its built-in viewer, so `response.body()` returns HTML. Fetch the raw bytes instead.
- **Be polite**: keep delays between requests (3-5s) so bulk downloads don't load agency sites.
- **Site restructuring is common**: NY state agencies frequently reorganize their websites. Old URLs go 404 without redirects. Always check index pages for current URLs before bulk retrying.
- **OCFS has ~22 OCFS childcare policy PDFs**: Some are at stable URLs, others get moved during site redesigns. The policies index page (`/programs/childcare/policies/`) may not link to all PDFs.
