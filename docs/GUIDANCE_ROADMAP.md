> **Status: PARTIALLY IMPLEMENTED**
> - Phase 1-4: Complete (migration, schema, repository, pages, components)
> - Phase 5: Complete (search integration)
> - Phase 6: Complete (documentation)
> - Phase 2 enhancements: Planned (see below)

# Guidance Documents — Phase 2 Enhancements Roadmap

This document captures future enhancements deferred from the initial guidance documents frontend build (PR feat/guidance-frontend).

---

## 1. Pipeline Page Integration

Show guidance-sourced compliance issues alongside regulation-sourced ones in Pipeline/Review pages.

**Requirements:**
- Update `ComplianceIssuesRepository` to handle `guidance_document_id` FK (already in schema)
- Add source-type badges to distinguish regulation-sourced vs guidance-sourced issues
- Update Pipeline queue filters to include guidance documents
- Update review workflow to support guidance document context

**Complexity:** Medium — repository and UI changes, no new tables needed.

---

## 2. Regulation Detail "Referenced by Guidance"

On regulation detail pages, show a section listing guidance documents that cite this regulation (via `cites_regulations[]` array matching).

**Requirements:**
- New repository query: match regulation identifiers against `cites_regulations` array values
- New component on regulation detail page showing linked guidance documents
- Badge showing count of referencing guidance documents

**Complexity:** Medium — array matching query + one new component.

---

## 3. Cross-Reference Visualization

Use the `cross_references` table's `source_guidance_id`/`target_guidance_id` FKs to display bidirectional citation links between guidance and regulations.

**Requirements:**
- Update `CrossReferencesRepository` to query guidance-to-regulation and guidance-to-guidance links
- Build a reference graph component (or extend existing cross-reference views)
- Handle bidirectional display: "This guidance cites" / "This guidance is cited by"

**Complexity:** High — new queries, potentially a graph visualization component.

---

## 4. Analytics Dashboard Integration

Add guidance stats cards to the analytics page: total docs, by-agency breakdown, citation coverage %, supersedure rates, compliance issue distribution.

**Requirements:**
- New analytics queries in guidance repository or analytics repository
- Stat cards and chart components on the analytics page
- Jurisdiction-aware filtering

**Complexity:** Low-Medium — mostly new queries + cards, follows existing analytics patterns.

---

## 5. Guidance-Aware Compliance Analysis

Run the 3-tier LLM research pipeline on guidance-sourced compliance issues. Currently guidance issues are only regex-scanned (migration 0057), with no LLM analysis.

**Requirements:**
- Extend research pipeline to accept `guidance_document_id` as document source
- Provide guidance document context (text, metadata) to LLM prompts
- Handle guidance-specific issue types (e.g., `reporting_frequency`)
- Store results in `compliance_issue_analyses` with guidance source tracking

**Complexity:** High — pipeline changes, new prompt templates, cost implications.

---

## 6. Document Lineage Viewer

A visual timeline/graph showing the full revision history and supersedure chain for a document family (e.g., all versions of "OCFS-ADM-15" from 2018 to 2024).

**Requirements:**
- Query to resolve full document family from any member (follow supersedes/superseded_by/revision_of chains)
- Timeline or directed graph visualization component
- Highlight current document in the chain
- Show key metadata changes between versions

**Complexity:** High — recursive chain resolution + graph/timeline UI.

---

## 7. Full-Text Content Viewer

Rich content rendering with syntax highlighting for citations, linked regulation references, and inline cross-reference popups.

**Requirements:**
- Parse document text to identify citation patterns (regulation refs, statute refs, document refs)
- Render citations as clickable links to regulation/statute/guidance detail pages
- Inline popup/tooltip showing referenced document summary on hover
- Syntax highlighting for legal citation formats

**Complexity:** High — content parsing, link resolution, popup UI.
