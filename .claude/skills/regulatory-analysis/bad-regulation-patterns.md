# Bad Regulation Patterns

A taxonomy of regulatory anti-patterns with real-world examples. Use this reference when reviewing regulations for modernization opportunities.

---

## 1. Prescriptive Formatting Requirements

**Pattern:** Regulations specify exact physical formats, dimensions, materials, or presentation methods that add cost without improving outcomes.

### Example: California Subdivision Map Act (Gov. Code § 66434)

```
The final map shall be prepared by or under the direction of a registered civil
engineer or licensed land surveyor...

(a) It shall be legibly drawn, printed, or reproduced by a process guaranteeing
a permanent record in black on tracing cloth or polyester base film...

(b) The size of each sheet shall be 18 by 26 inches or 460 by 660 millimeters.
A marginal line shall be drawn completely around each sheet, leaving an entirely
blank margin of one inch or 025 millimeters.
```

**Why It's Problematic:**
- Maps get rejected for margin width violations, not content issues
- County officials reject maps for "use of a blue ball point pen" or "not using a permanent Sharpie for signatures"
- Developers pay for reprints and resubmissions over formatting, not substance
- Contributes to housing shortage by slowing approvals

**Mayor Matt Mahan (San Jose):**
> "Obviously, this is ridiculous. It's the kind of needless bureaucracy that contributes to our housing shortage... we should have better communicated why we did this and obviously we need to work together to improve the upstream regs."

### Detection Signals
- Specific paper dimensions (letter, legal, 18x26")
- Margin requirements (1-inch, specific measurements)
- Ink/pen specifications (black ink, permanent marker, no ballpoint)
- Font requirements (specific typefaces, sizes)
- File format mandates (PDF-only, specific software)

### Better Approach
Focus on **legibility and durability** rather than exact specifications:
- "Documents must be clearly legible and reproducible"
- "Use any format that ensures permanent record retention"
- Allow electronic submission with equivalent integrity

---

## 2. Technology Mandates Creating Monopolies

**Pattern:** Regulations require specific technology that is patented or only available from a single vendor, effectively mandating a monopoly.

### Example: CPSC Table Saw Safety Standard (2023)

The Consumer Product Safety Commission proposed requiring "Active Injury Mitigation" (AIM) technology on all table saws—technology patented by a single company (SawStop).

**The Requirement:**
> The performance standard would limit the depth of cut to 3.5 millimeters when a test probe approaches the spinning blade at a rate of 1 meter per second.

**Cost Impact:**
| Saw Type | Price Range |
|----------|-------------|
| Standard table saws (DeWalt, Milwaukee) | $129 - $599 |
| SawStop entry-level bench saw | $899+ |
| Compliance cost per model | $100,000 - $700,000 |

**Rep. Marie Gluesenkamp-Perez (WA-03):**
> "The Consumer Product Safety Commission's proposed mandate on finger-detection technology could create a monopoly and price out small woodworkers and tradespeople in rural communities like mine."

**Key Arguments Against:**
1. **Monopoly creation** - Only one company (SawStop) had compliant technology
2. **Patent timing** - SawStop pledged to release patents when rule takes effect, but competitors need years to develop alternative designs
3. **Rural/small business impact** - $700+ cost increase prices out hobbyists and small crews
4. **Unintended consequences** - Higher costs may push people toward DIY alternatives using circular saws, which could be more dangerous

**Outcome:** The rule was withdrawn in August 2025 under the Trump administration's deregulatory approach.

### Detection Signals
- Performance standards only one vendor can meet
- References to patented technologies
- Requirements that match a single product's specifications exactly
- Compliance timelines shorter than product development cycles
- No technology-neutral alternatives offered

### Better Approach
- **Performance-based standards** that allow multiple solutions
- **Technology-neutral language** ("shall prevent X" not "shall use technology Y")
- **Reasonable compliance timelines** allowing market competition to develop
- **Patent considerations** - don't mandate patented tech without public availability

---

## 3. Death by a Thousand Cuts

**Pattern:** No single requirement is insurmountable, but the cumulative burden of fees, steps, agencies, and delays makes compliance nearly impossible.

*Framework from Institute for Justice's "[Barriers to Business](https://ij.org/report/barriers-to-business/)" report.*

### A. Excessive Costs

**San Francisco Restaurant Startup:**
- Total cost: **$22,648**
- Number of fees: 17
- Highest single fee: Sewer impact fee ($8,275 in Minneapolis)

| City | Restaurant Startup Cost | Number of Fees |
|------|------------------------|----------------|
| San Francisco | $22,648 | 17 |
| Minneapolis | $13,973 | 14 |
| Seattle | $7,466 | 12 |
| Detroit | $6,545 | 15 |
| St. Louis | $6,642 | 8 |
| **Average (20 cities)** | **$2,555** | - |

**Duplicative Costs:**
- Indianapolis requires trade name registration at **both** state and county level
- Des Moines barbers need state license for practitioner **AND** separate facility license
- Each inspection may need to occur multiple times before sign-off

### B. Delays

**Siloed Agencies:**
- Food truck entrepreneurs interact with **7 agencies on average**
- Newark requires **13 in-person activities** to start a food truck
- No city scored 5/5 on "one-stop shop" criteria

**Inconsistent Enforcement:**
> "Jesse remembers getting failed in an inspection on something that a previous inspector had already approved, highlighting how inconsistent enforcement by officials can lead to frustration, delays, and wasted resources."

**One-Stop Shop Scores (out of 5):**
| City | Score | City | Score |
|------|-------|------|-------|
| Atlanta | 4 | Birmingham | 0 |
| Detroit | 4 | Des Moines | 0 |
| New York | 4 | Boston | 1 |
| San Francisco | 4 | Raleigh | 1 |

### C. Complexity

**Step Counts to Open a Business:**
| City | Restaurant | Bookstore | Food Truck | Barbershop |
|------|------------|-----------|------------|------------|
| Boston | 92 | 34 | 37 | 81 |
| Atlanta | 76 | 46 | 44 | 68 |
| Detroit | 77 | 32 | 43 | 60 |
| Jacksonville | 66 | 37 | 33 | 66 |

**License Category Proliferation:**
- San Francisco: **212 business license categories**
- New York barbershop: **24 individual forms/documents required**

### Detection Signals
- Multiple agencies with overlapping jurisdiction
- Same requirement at multiple levels (city, county, state)
- High step counts (50+ to open a business)
- Extensive in-person requirements
- No consolidated portal or guide
- Fees that seem small individually but add up

### Better Approach
- **True one-stop shops** - single portal for all requirements
- **Consolidated licensing** - one license per business type
- **Eliminate duplicative requirements** across government levels
- **Reduce in-person mandates** - allow electronic submissions
- **Tiered fees** - lower for small/new businesses

---

## 4. Regulatory Capture & Protectionism

**Pattern:** Rules that appear to serve public interest but actually protect established businesses from competition.

### Example: Atlanta Food Truck Proximity Rules

> "Mobile vendors may not operate within 200 feet of a stationary business selling the same or similar products."

**Effect:** Food trucks are banned from high-traffic corridors where brick-and-mortar restaurants operate—the exact places where food trucks would succeed.

### Example: New Orleans Tour Guide Licensing

Requirements to become a licensed tour guide:
- Clean criminal record
- Pay $50 fee
- Pass test on "the history and culture of New Orleans"

**Risk level addressed:** Virtually none. Tour guides pose no safety risk that justifies occupational licensing.

**Actual effect:** Barriers to entry that protect established tour companies.

### Detection Signals
- Proximity restrictions benefiting existing businesses
- Licensing for low-risk occupations
- Requirements unrelated to safety (culture tests, specific training hours)
- Industry associations lobbying for requirements
- Grandfathering that exempts incumbents

### Better Approach
- **Focus on actual harms** - what safety risk does this prevent?
- **Proportional requirements** - match burden to risk
- **Remove proximity restrictions** - let markets compete
- **Sunset provisions** - require periodic justification

---

## 5. Clean Hands & Exclusionary Rules

**Pattern:** Rules that disqualify applicants for reasons unrelated to their ability to safely perform the licensed activity.

### Examples

**Debt-Based Exclusion:**
> "'Clean hands' rules make it impossible to obtain or renew paperwork if the applicant owes even small sums of money to city government."

**Effect:** Entrepreneurship becomes inaccessible over petty debts like unpaid parking tickets.

**Criminal History Checks:**
- Applied to occupations with no safety justification
- Deters returning citizens from legal entrepreneurship
- Forces people toward unlicensed/informal economy

**Disproportionate Impact:**
> "These rules especially disadvantage those who are unsure if their past will be held against them in the licensing process, even if unrelated to the skills they have developed to be a successful entrepreneur in their chosen field."

### Detection Signals
- Criminal background checks for low-risk occupations
- Debt/tax clearance requirements for business licenses
- "Good moral character" requirements without definition
- Blanket disqualifications without individual review
- No appeals process for denials

### Better Approach
- **Nexus requirement** - criminal history only relevant if related to the occupation
- **Individual review** - not blanket disqualifications
- **Payment plans** - don't block licenses over small debts
- **Clear standards** - define what "good moral character" means
- **Appeals process** - allow applicants to explain circumstances

---

## 6. Procedural Worship Over Outcomes

**Pattern:** Regulations focus on mandating specific steps rather than achieving specific outcomes, creating rigidity that prevents innovation.

*See also: Jennifer Pahlka's "Recoding America" framework in `/prompts/core.yaml`*

### Key Anti-Patterns

| Anti-Pattern | Red Flag | Better Approach |
|--------------|----------|-----------------|
| Mandated steps | "shall use Form X-100 in PDF format" | "shall decide 90% of applications within 10 days" |
| No iteration | "program authorized for 10 years...report after 9 years" | "Secretary may test simpler approaches" |
| Zero risk language | "ensure that no improper payments occur" | "use reasonable steps to reduce errors" |
| Process-only audits | "audit compliance with each requirement" | "examine whether program reaches qualifying people" |

### Detection Signals
- Hard-coded forms, formats, technology
- No pilot or waiver authority
- Absolute language ("ensure no X occurs")
- Punitive language for any deviation
- No feedback loops or user testing provisions
- Compliance-only oversight (not outcome-based)

---

## Evaluation Framework

When reviewing a regulation, ask these questions:

### Necessity
- What specific harm does this requirement prevent?
- Is there evidence this harm actually occurs without the rule?
- Could market forces or liability address this instead?

### Proportionality
- Is the burden proportional to the risk?
- Would a reasonable person consider this requirement sensible?
- What is the cost-per-harm-prevented?

### Alternatives
- Could the same goal be achieved with less burden?
- Are there technology-neutral ways to achieve this?
- What do other jurisdictions do?

### Competition
- Does this protect incumbents from competition?
- Does this create barriers that favor large over small businesses?
- Is there a monopoly/patent concern?

### Accessibility
- Does this create barriers for small businesses?
- Does this disproportionately affect rural communities?
- Does this exclude people based on unrelated factors (debt, history)?

### Modernization
- Does this require outdated technology (fax, mail, in-person)?
- Could this be done electronically?
- Has this been updated since originally written?

### Coordination
- Does this duplicate requirements from other agencies?
- Are there conflicting requirements across jurisdictions?
- Is there a one-stop shop for compliance?

---

## Sources

1. **California Government Code Section 66434** - Subdivision Map Act
   https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66434

2. **Mayor Matt Mahan** - Twitter/X thread on map margin requirements
   https://twitter.com/MattMahanSJ

3. **Rep. Marie Gluesenkamp-Perez** - Table Saw Monopoly Prevention Act
   https://gluesenkampperez.house.gov/posts/gluesenkamp-perez-duncan-introduce-bipartisan-bill-to-protect-lower-cost-table-saws-prevent-monopoly-on-saws-with-finger-detection-technology

4. **Institute for Justice** - Barriers to Business Report
   https://ij.org/report/barriers-to-business/

5. **CPSC Table Saw Rulemaking** - Federal Register (2023)
   https://www.federalregister.gov/documents/2023/11/01/2023-23898/safety-standard-addressing-blade-contact-injuries-on-table-saws

6. **Jennifer Pahlka** - "Recoding America" (2023)
   Framework implemented in `/prompts/core.yaml`
