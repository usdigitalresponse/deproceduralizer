# Scraper Expansion Plan

> **Status: IN PROGRESS**
> As of 2026-03-13, 25 scrapers are registered covering 21 agencies.

## Current Coverage

The table below shows scraper registrations. See **Database Counts** for actual imported totals.

| Agency | Scraper | Type | Docs | Status |
|--------|---------|------|------|--------|
| NYSED | nysed-early-learning | Static | ~20 | Done |
| OMH | omh-guidance | Static | ~30 | Done |
| NYSDOT | nysdot-permits | Static | ~15 | Done |
| OCM | ocm-licensing | Static | ~10 | Done |
| WCB | wcb-subject-numbers | Static | 289 | Done |
| NYSDOL | nysdol-directives | Paginated | ~50 | Done |
| OPWDD | opwdd-guidance | Paginated | ~100 | Done |
| OASAS | oasas-legal | Paginated | ~169 | Done |
| SLA | sla-guidance | Paginated | ~50 | Done |
| HCR | hcr-rental-housing | Paginated | ~60 | Done |
| DOCCS | doccs-directives | Paginated | 369 | Done |
| OGS | ogs-procurement | Paginated | 91 | Done |
| DOS | dos-technical-support | Paginated | 188 | Done |
| DOS | dos-publications | Paginated | 89 | Done |
| AG | ag-opinions | Paginated | 536 | Done |
| AG | ag-regulatory-documents | Paginated | 221 | Done |
| AG | ag-real-estate-memos | Paginated | 115 | Done |
| NYSDEC | nysdec-guidance | CategoryHub | ~200 | Done |
| TAX | tax-tsb-m | CategoryHub | ~500 | Done |
| OTDA | otda-directives | CategoryHub | ~1000 | Done |
| NYSDOH | nysdoh-dals | Playwright | 755 | New (downloads failing) |
| NYSDOH | nysdoh-early-intervention | Playwright | 179 | New (downloads failing) |
| NYSDOH | nysdoh-gis | Playwright | 1,148 | Done |
| NYDFS | nydfs-circular-letters | Playwright | ~100 | Enabled |
| OCFS | ocfs-childcare-letters | Playwright | ~200 | Enabled |

## Database Counts (Mar 2026)

Actual guidance documents imported into the `guidance_documents` table:

| Agency | DB Count | Top Doc Types |
|--------|----------|---------------|
| OTDA | 4,997 | ADM, INF, LCM, GIS |
| NYSDOH | 2,059 | GIS, DAL |
| OCFS | 1,826 | LCM, INF, ADM |
| TAX | 1,484 | TSB-M |
| AG | 841 | Informal Opinion, letter |
| SLA | 535 | Guidance, Advisory |
| WCB | 289 | Bulletin |
| DOCCS | 252 | Directive |
| DOS | 196 | Technical Bulletin, Publication |
| NYSDEC | 188 | Guidance |
| OPWDD | 97 | ADM, other |
| OGS | 90 | Contract Letter, Requirement Letter |
| HCR | 89 | Guidance |
| NYSDOL | 77 | Directive |
| OMH | 68 | Guidance |
| NYSED | 42 | Guidance |
| OASAS | 25 | Guidance |
| JUSTICE_CENTER | 2 | Guidance |
| OCM | 2 | Guidance |
| NYDFS | 1 | Circular Letter |
| NYC_DOHMH | 146 | Health Code Guidance |

**Total in DB: 13,306 guidance documents (13,160 NY + 146 NYC)**
All documents have text content (100% extraction rate).

## Known Issue: health.ny.gov blocks automated downloads

NYSDOH sites (health.ny.gov) return 403 to automated requests. Playwright scraping of index pages works, but PDF downloads mostly fail (49/50 failure rate). Options:
1. Manual download from a browser session
2. Slower download with longer delays between requests
3. Ask the agency for a bulk copy of the documents

## Priority Expansion Targets

### Tier 1: High-value, likely scrapable

#### DOL Opinion Letters
- **URL**: Was at `labor.ny.gov/legal/counsel-opinion-letters.shtm` — **page no longer exists on dol.ny.gov**
- **What**: ~372 legal opinion letters interpreting labor law (historical archive, no longer issued)
- **Challenge**: All PDFs return 404 on both labor.ny.gov and dol.ny.gov — only available via Wayback Machine
- **Approach**: Archive scraper using Wayback Machine CDX API to enumerate and download ~372 PDFs
- **Scraper type**: Custom (Wayback Machine CDX API)
- **Priority**: Lower — requires special Wayback Machine approach

#### OGS (Office of General Services) Procurement Guidance — DONE
- **Scraper**: `ogs-procurement` (PaginatedScraper), 91 documents
- **What**: Contract Letters (CLs), Requirement Letters (RLs), procurement guidance

#### NYSDOH ADMs/DAMs (Administrative Directives)
- **URL**: `https://www.health.ny.gov/professionals/hospitals/` and similar
- **What**: Hospital/facility regulation guidance beyond Medicaid GIS
- **Challenge**: Same download blocking as other NYSDOH sites
- **Approach**: PlaywrightScraper, similar to nysdoh-gis pattern

#### DOS (Dept of State) — DONE
- **Scrapers**: `dos-technical-support` (188 docs) + `dos-publications` (89 docs)
- **What**: Building code interpretations, technical bulletins, code outreach, legal memoranda (LG/LI/LU series), planning guides

### Tier 2: Medium-value

#### NYSIF (State Insurance Fund) Bulletins
- **URL**: `https://ww3.nysif.com/`
- **What**: Workers comp bulletins, employer guidance
- **Approach**: Explore for bulletin/guidance section

#### NYSERDA Energy Guidance
- **URL**: `https://www.nyserda.ny.gov/`
- **What**: Clean energy program guidance, compliance guidance
- **Approach**: Likely has a resources/guidance section

#### Office of the State Comptroller (OSC) Opinions
- **URL**: `https://www.osc.ny.gov/`
- **What**: State comptroller opinions on fiscal matters, local government guidance
- **Approach**: Explore legal/opinions section

#### Workers' Compensation Board Bulletins — DONE
- **Scraper**: `wcb-subject-numbers` (StaticPageScraper), 289 documents
- **What**: SN 046 general bulletins (283), SN 187 legal holidays (17), DBIC/WCIC/MDO bulletins
- **Note**: Excluded ~1,190 health provider authorization notices (low regulatory value)

### Tier 3: Lower priority or harder to scrape

#### OCA (Office of Court Administration)
- **What**: Court administrative orders, directives
- **Challenge**: Courts have their own web infrastructure

#### NYSED (expanded beyond early learning)
- **What**: NYSED has guidance across many divisions (higher ed, P-12, professions)
- **Approach**: Multiple sub-scrapers for different divisions

#### NYSHCR (expanded beyond rental housing)
- **What**: HCR has additional guidance on affordable housing, weatherization
- **Approach**: Additional URL patterns for same agency

## How to Write a New Scraper

1. **Inspect the target site** — Use Playwright browser tools to navigate and understand:
   - Page structure (static HTML? JavaScript-rendered? paginated?)
   - Document link patterns (direct PDF links? landing pages? mixed?)
   - Pagination (Drupal `?page=N`? custom? infinite scroll?)
   - Bot protection (403 errors? CAPTCHAs?). If the site blocks automated access, skip it.

2. **Choose the base class**:
   - `StaticPageScraper` — Single page with document links, no pagination
   - `PaginatedScraper` — Drupal/CMS with `?page=N` pagination (most NY state sites)
   - `CategoryHubScraper` — Hub page linking to category sub-pages
   - `PlaywrightScraper` — JavaScript-rendered sites (heavier)

3. **Create the scraper file** at `src/scrapers/agencies/{agency-name}.ts`:
   - Define `ScraperConfig` with agency, domain, topic, URLs
   - Override `extractDocuments(html, pageUrl)` to parse the HTML
   - Extract: title, URL, fileType, description, docType, docSeries, year

4. **Register in `scripts/scrape.ts`** — Add the `.js` path to `SCRAPER_MODULES`

5. **Test**: `npm run scrape -- --scraper={name}`

6. **Process**: After scraping, run the full pipeline:
   ```bash
   npm run merge && npm run download && npm run extract && npm run enrich && npm run merge-enriched
   ```

7. **Import into deproceduralizer**:
   ```bash
   cd ../deproceduralizer/backend
   python3 -m scripts.guidance_pipeline --execute
   ```

## After Scraping: Processing Pipeline

Once new scraped CSVs are in `data/raw/scraped/`, the full processing pipeline is:

```bash
cd nys-documents

# 1. Merge scraped CSVs into master catalog
npm run merge

# 2. Download PDFs/documents (slow step — this is where blocked downloads show up)
npm run download

# 3. Extract text from downloaded files
npm run extract

# 4. Enrich with metadata (dates, citations, etc.)
npm run enrich

# 5. Merge enrichment into catalog
npm run merge-enriched
```

Then import into the deproceduralizer database:
```bash
cd ../deproceduralizer/backend
python3 -m scripts.guidance_pipeline --dry-run          # preview
python3 -m scripts.guidance_pipeline --execute           # import
python3 -m scripts.guidance_pipeline --gap-analysis      # check coverage
```
