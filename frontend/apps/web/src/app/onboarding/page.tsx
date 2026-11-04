import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  BarChart3,
  FlaskConical,
  FolderTree,
  Code,
  ClipboardCheck,

  BookOpen,
  Lightbulb,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react';

interface OnboardingStep {
  number: number;
  title: string;
  icon: LucideIcon;
  route: string;
  routeLabel: string;
  description: string;
  checklist: string[];
  goal: string;
}

const STEPS: OnboardingStep[] = [
  {
    number: 1,
    title: 'Get Oriented — Analytics Dashboard',
    icon: BarChart3,
    route: '/ny/analytics',
    routeLabel: 'ny/analytics',
    description: 'Start here to get the big picture before diving into details.',
    checklist: [
      'Browse the section type distribution — see how regulations are categorized',
      'Review compliance issue counts by type and severity — there are 42 issue types we scan for',
      'Check the pipeline tier progression — shows how many issues have been through each stage of AI analysis',
      'Look at Barrier severity distribution — this is the 18-category barrier framework analysis',
    ],
    goal: 'Understand the scale of what we\'re analyzing and how we categorize regulatory burden.',
  },
  {
    number: 2,
    title: 'Explore the Pipeline View',
    icon: FlaskConical,
    route: '/ny/pipeline',
    routeLabel: 'ny/pipeline',
    description: 'This shows the research pipeline — the multi-stage AI analysis process.',
    checklist: [
      'Review the tier progression (Tier 1 filtering → Tier 2 classification → Tier 3 web search verification)',
      'Look at the classification breakdown — burdensome vs. justified vs. neutral',
      'Browse the priority picks — these are issues flagged as most burdensome',
      'Click into 1-2 specific issues to see the full analysis detail (document context, AI reasoning, statute citations)',
    ],
    goal: 'Understand how raw regex matches become validated compliance findings through the AI pipeline.',
  },
  {
    number: 3,
    title: 'Browse Regulatory Documents',
    icon: FolderTree,
    route: '/ny',
    routeLabel: 'ny',
    description: 'Explore how regulations are structured and navigate the corpus.',
    checklist: [
      'Try the table view — filter by severity or issue types to see how regulations are tagged',
      'Try the browse view — navigate the hierarchy (Title → Chapter → Part → Section)',
      'Click into 2-3 individual regulations to see their detail pages — note summaries, definitions, and linked compliance issues',
      'Check out the Glossary (ny/definitions) — see how defined terms are extracted and linked',
      'Glance at Guidance Documents (ny/guidance) — sub-regulatory documents that interpret the regulations',
    ],
    goal: 'Get comfortable navigating the regulatory corpus and understand how documents relate to each other.',
  },
  {
    number: 4,
    title: 'Understand the Prompts',
    icon: Code,
    route: '/prompts',
    routeLabel: 'Prompts',
    description: 'This is where all the AI prompts that power the analysis are defined.',
    checklist: [
      'Browse the Core prompts (12) — these handle definitions and foundational analysis',
      'Browse the Compliance Issue prompts (42) — each one targets a specific type of regulatory burden',
      'Browse the Barrier prompts (18) — these are the barrier framework categories for implementation analysis',
      'Read through 2-3 prompts in detail to understand what the AI is being asked to look for',
      'Note the feedback counts — you can provide feedback on any prompt if you think it could be improved',
    ],
    goal: 'Understand what the AI is looking for and how it\'s instructed. If something seems wrong in the results, it often traces back to the prompt.',
  },
  {
    number: 5,
    title: 'Review Barrier Results',
    icon: ClipboardCheck,
    route: '/ny/review',
    routeLabel: 'ny/review → Barrier tab',
    description: 'The Barrier analysis uses a single enriched pass to categorize regulatory burden across 18 categories.',
    checklist: [
      'Browse through several Barrier results to see how regulations are categorized',
      'Pay attention to the severity ratings and category assignments',
      'Note whether the AI\'s reasoning makes sense for the regulatory text shown',
    ],
    goal: 'See how the AI categorizes regulatory burden and start forming opinions about accuracy.',
  },
  {
    number: 6,
    title: 'Review Compliance Issues (Main Review Work)',
    icon: CheckSquare,
    route: '/ny/review',
    routeLabel: 'ny/review → Compliance Issues tab',
    description: 'This is where the core review work happens. You\'ll be validating AI findings.',
    checklist: [
      'Start in Suggestion Mode (default) — the AI groups related issues for efficient review',
      'Review 3-5 compliance issues: read the flagged text, the AI analysis, and check if the classification is correct',
      'Look at statute citations — does the statute actually mandate the requirement?',
      'Try Filter Mode (queueMode=filter) to browse issues by type, severity, or tier status',
      'Try filtering by different issue types to see the variety of problems found',
    ],
    goal: 'Get hands-on with the review process. This is the primary work volunteers will be doing — validating whether the AI correctly identified regulatory burden.',
  },
  {
    number: 7,
    title: 'Explore Other Review Tabs',
    icon: ClipboardCheck,
    route: '/ny/review',
    routeLabel: 'ny/review → other tabs',
    description: 'Explore the full scope of review work available.',
    checklist: [
      'Check the Definitions tab — review extracted regulatory definitions',
      'Check the Needs More Info tab — issues that need additional research or clarification',
    ],
    goal: 'Understand the full scope of review work available.',
  },
];

const TIPS = [
  { text: 'Trust your judgment — if the AI\'s classification doesn\'t match your reading of the regulation, that\'s valuable feedback' },
  { text: 'Context matters — click through to the full regulation to understand the broader context around a flagged section' },
  { text: 'We want feedback — if something in the app is confusing or could be better, say so in Slack. We\'re actively improving the tool' },
  { text: 'Start with New York — NY has the most complete data. NJ and NYC are also available but may have less analysis coverage' },
];

const QUICK_REFERENCE = [
  { section: 'Analytics', route: '/ny/analytics', description: 'High-level stats and charts' },
  { section: 'Pipeline', route: '/ny/pipeline', description: 'AI analysis progression and priority issues' },
  { section: 'Table View', route: '/ny', description: 'Filterable list of all regulations' },
  { section: 'Browse', route: '/ny/browse', description: 'Hierarchical navigation' },
  { section: 'Glossary', route: '/ny/definitions', description: 'Extracted defined terms' },
  { section: 'Guidance', route: '/ny/guidance', description: 'Sub-regulatory guidance documents' },
  { section: 'Prompts', route: '/prompts', description: 'All AI prompts with feedback' },
  { section: 'Review', route: '/ny/review', description: 'Review queues (compliance, barriers, definitions)' },
];

export default function OnboardingPage() {
  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="Volunteer Onboarding"
        description="Welcome to the Deproceduralizer! Work through these 7 steps to get familiar with the tool and start reviewing AI-identified regulatory burden."
      />

      <Container size="2xl" className="py-6 space-y-8">
        {/* Intro */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 mt-0.5 text-[var(--color-primary)]" />
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                This tool uses AI to scan 120,000+ regulatory sections across New York State, New Jersey,
                and New York City to find procedural barriers, outdated requirements, and unnecessary
                complexity buried in administrative codes. Your work reviewing and validating these
                findings is critical.
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                Questions? Post them in the team Slack channel.
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
              >
                {/* Step header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[var(--color-primary)] text-white text-sm font-semibold">
                    {step.number}
                  </span>
                  <Icon className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  <h2 className="text-base font-semibold text-[var(--color-text)]">
                    {step.title}
                  </h2>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {/* Route link */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">Go to:</span>
                    <Link
                      href={step.route}
                      className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {step.routeLabel}
                    </Link>
                  </div>

                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {step.description}
                  </p>

                  {/* Checklist */}
                  <ul className="space-y-2">
                    {step.checklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                        <span className="mt-1 h-4 w-4 rounded border border-[var(--color-border)] flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  {/* Goal callout */}
                  <div className="rounded-md bg-[var(--color-primary-faint)] border border-[var(--color-border)] px-4 py-3">
                    <p className="text-sm text-[var(--color-text)]">
                      <span className="font-semibold">Goal:</span> {step.goal}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-[var(--color-warning)]" />
            <h2 className="text-base font-semibold text-[var(--color-text)]">Tips for Reviewers</h2>
          </div>
          <ul className="space-y-3">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-text-tertiary)]">&bull;</span>
                {tip.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Reference */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
            <h2 className="text-base font-semibold text-[var(--color-text)]">Quick Reference</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">Section</th>
                  <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">URL</th>
                  <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">What You&apos;ll Find</th>
                </tr>
              </thead>
              <tbody>
                {QUICK_REFERENCE.map((ref) => (
                  <tr key={ref.section} className="border-b border-[var(--color-border)] last:border-b-0">
                    <td className="px-6 py-3 font-medium text-[var(--color-text)]">{ref.section}</td>
                    <td className="px-6 py-3">
                      <Link
                        href={ref.route}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {ref.route}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-secondary)]">{ref.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </div>
  );
}
