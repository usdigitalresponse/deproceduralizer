# Volunteer Onboarding Guide

Welcome to the Deproceduralizer! This tool uses AI to scan 120,000+ regulatory sections across New York State, New Jersey, and New York City to find procedural barriers, outdated requirements, and unnecessary complexity buried in administrative codes. Your work reviewing and validating these findings is critical.

**App URL:** https://deproceduralizer.vercel.app

**Questions?** Post them in the team Slack channel.

---

## Onboarding Checklist

Work through these steps in order. Each builds on the previous one.

### Step 1: Get Oriented — Analytics Dashboard

**Go to:** `ny/analytics`

Start here to get the big picture before diving into details.

- [ ] Browse the **section type distribution** — see how regulations are categorized
- [ ] Review **compliance issue counts by type and severity** — there are 49 issue types we scan for
- [ ] Check the **pipeline tier progression** — shows how many issues have been through each stage of AI analysis
- [ ] Look at **Barrier severity distribution** — this is the 18-category barrier framework analysis

**Goal:** Understand the scale of what we're analyzing and how we categorize regulatory burden.

---

### Step 2: Explore the Pipeline View

**Go to:** `ny/pipeline`

This shows the research pipeline — the multi-stage AI analysis process.

- [ ] Review the **tier progression** (Tier 1 filtering → Tier 2 classification → Tier 3 web search verification)
- [ ] Look at the **classification breakdown** — burdensome vs. justified vs. neutral
- [ ] Browse the **priority picks** — these are issues flagged as most burdensome
- [ ] Click into **1-2 specific issues** to see the full analysis detail (document context, AI reasoning, statute citations)

**Goal:** Understand how raw regex matches become validated compliance findings through the AI pipeline.

---

### Step 3: Browse Regulatory Documents

**Go to:** `ny` (table view) or `ny/browse` (hierarchy view)

- [ ] Try the **table view** — filter by issue types to see how regulations are tagged
- [ ] Try the **browse view** — navigate the hierarchy (Title → Chapter → Part → Section) to see how NY regulations are structured
- [ ] Click into **2-3 individual regulations** to see their detail pages — note the summaries, definitions, and linked compliance issues
- [ ] Check out the **Glossary** (`ny/definitions`) — see how defined terms are extracted and linked
- [ ] Glance at **Guidance Documents** (`ny/guidance`) — these are sub-regulatory documents (advisories, policy letters) that interpret the regulations

**Goal:** Get comfortable navigating the regulatory corpus and understand how documents relate to each other.

---

### Step 4: Understand the Prompts

**Go to:** `Prompts` (in the top navigation)

This is where all the AI prompts that power the analysis are defined.

- [ ] Browse the **Core prompts** — these handle definitions and foundational analysis
- [ ] Browse the **Compliance Issue prompts** (49) — each one targets a specific type of regulatory burden
- [ ] Browse the **Barrier prompts** (18) — these are the barrier framework categories for implementation analysis
- [ ] Read through **2-3 prompts** in detail to understand what the AI is being asked to look for
- [ ] Note the **feedback counts** — you can provide feedback on any prompt if you think it could be improved

**Goal:** Understand what the AI is looking for and how it's instructed. If something seems wrong in the results, it often traces back to the prompt.

---

### Step 5: Review Barrier Results

**Go to:** `ny/review` → **Barrier tab**

The Barrier analysis uses a single enriched pass to categorize regulatory burden across 18 categories.

- [ ] Browse through several Barrier results to see how regulations are categorized
- [ ] Pay attention to the **severity ratings** and **category assignments**
- [ ] Note whether the AI's reasoning makes sense for the regulatory text shown

**Goal:** See how the AI categorizes regulatory burden and start forming opinions about accuracy.

---

### Step 6: Review Compliance Issues (Main Review Work)

**Go to:** `ny/review` → **Compliance Issues tab**

This is where the core review work happens. You'll be validating AI findings.

- [ ] Start in **Suggestion Mode** (default) — the AI groups related issues for efficient review
- [ ] Review **3-5 compliance issues** to get the feel for it:
  - Read the flagged regulatory text
  - Read the AI's analysis and classification
  - Check whether the issue is genuinely burdensome, justified, or neutral
  - Look at any statute citations — does the statute actually mandate the requirement?
- [ ] Try **Filter Mode** (`queueMode=filter`) to browse issues by type, severity, or tier status
- [ ] Try filtering by different **issue types** to see the variety of problems found

**Goal:** Get hands-on with the review process. This is the primary work volunteers will be doing — validating whether the AI correctly identified regulatory burden.

---

### Step 7: Explore Other Review Tabs

**Go to:** `ny/review` → other tabs

- [ ] Check the **Red Flags tab** — these are high-level implementation complexity flags
- [ ] Check the **Definitions tab** — review extracted regulatory definitions
- [ ] Check the **Needs More Info tab** — these are issues that need additional research or clarification

**Goal:** Understand the full scope of review work available.

---

## Tips for Reviewers

- **Trust your judgment** — if the AI's classification doesn't match your reading of the regulation, that's valuable feedback
- **Context matters** — click through to the full regulation to understand the broader context around a flagged section
- **We want feedback** — if something in the app is confusing or could be better, say so in Slack. We're actively improving the tool
- **Start with New York** — NY has the most complete data. NJ and NYC are also available but may have less analysis coverage

## Quick Reference

| Section | URL | What You'll Find |
|---------|-----|------------------|
| Analytics | `ny/analytics` | High-level stats and charts |
| Pipeline | `ny/pipeline` | AI analysis progression and priority issues |
| Table View | `ny` | Filterable list of all regulations |
| Browse | `ny/browse` | Hierarchical navigation |
| Glossary | `ny/definitions` | Extracted defined terms |
| Guidance | `ny/guidance` | Sub-regulatory guidance documents |
| Prompts | `prompts` | All AI prompts with feedback |
| Review | `ny/review` | Review queues (compliance, flags, Barrier, definitions) |
