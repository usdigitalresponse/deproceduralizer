import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui';
import { PromptsList, PromptNav, V5PipelineComposer } from '@/components/prompts';
import { getPrompts, getCompliancePrompts, getJenAIPrompts } from '@/lib/actions/prompts';
import { getAllFeedback, getFeedbackCounts } from '@/lib/actions/prompt-feedback';
import { getIssueTypesList } from '@/lib/actions/research-pipeline';

export default async function PromptsPage() {
  // Fetch prompts and feedback data in parallel
  const [promptsResult, compliancePromptsResult, jenaiPromptsResult, feedbackCountsResult, allFeedbackResult, issueTypesResult] = await Promise.all([
    getPrompts(),
    getCompliancePrompts(),
    getJenAIPrompts(),
    getFeedbackCounts(),
    getAllFeedback(),
    getIssueTypesList(),
  ]);

  // Handle prompts error
  if (!promptsResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title="LLM Prompts"
          description="View and provide feedback on analysis prompts"
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load prompts: {promptsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  const prompts = promptsResult.data;
  const compliancePrompts = compliancePromptsResult.success ? compliancePromptsResult.data : [];
  const jenaiPrompts = jenaiPromptsResult.success ? jenaiPromptsResult.data : [];
  const feedbackCounts = feedbackCountsResult.success ? feedbackCountsResult.data : {};
  const allFeedback = allFeedbackResult.success ? allFeedbackResult.data : [];
  const issueTypes = issueTypesResult.success ? issueTypesResult.data : [];

  // Detect orphaned feedback (feedback for prompts that no longer exist)
  const promptNames = new Set(prompts.map((p) => p.name));
  const orphanedFeedback = allFeedback.filter((f) => !promptNames.has(f.promptName));

  const totalPrompts = prompts.length + compliancePrompts.length + jenaiPrompts.length;

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="LLM Prompts"
        description={`View ${totalPrompts} prompts used by the regulatory analysis system (${prompts.length} core, ${compliancePrompts.length} compliance, ${jenaiPrompts.length} JenAI). Submit feedback to help improve prompt quality.`}
      />

      <Container size="2xl" className="py-6 space-y-8">
        {/* V5 Pipeline Composer - Show if we have issue types */}
        {issueTypes.length > 0 && (
          <V5PipelineComposer issueTypes={issueTypes} />
        )}

        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <PromptsList
              prompts={prompts}
              compliancePrompts={compliancePrompts}
              jenaiPrompts={jenaiPrompts}
              feedbackCounts={feedbackCounts}
              orphanedFeedback={orphanedFeedback}
            />
          </div>

          {/* Sidebar navigation - hidden on mobile */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <PromptNav prompts={prompts} compliancePrompts={compliancePrompts} jenaiPrompts={jenaiPrompts} />
          </aside>
        </div>
      </Container>
    </div>
  );
}
