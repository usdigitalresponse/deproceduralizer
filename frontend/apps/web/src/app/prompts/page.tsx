import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui';
import { PromptsList } from '@/components/prompts';
import { getPrompts } from '@/lib/actions/prompts';
import { getAllFeedback, getFeedbackCounts } from '@/lib/actions/prompt-feedback';

export default async function PromptsPage() {
  // Fetch prompts and feedback data in parallel
  const [promptsResult, feedbackCountsResult, allFeedbackResult] = await Promise.all([
    getPrompts(),
    getFeedbackCounts(),
    getAllFeedback(),
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
  const feedbackCounts = feedbackCountsResult.success ? feedbackCountsResult.data : {};
  const allFeedback = allFeedbackResult.success ? allFeedbackResult.data : [];

  // Detect orphaned feedback (feedback for prompts that no longer exist)
  const promptNames = new Set(prompts.map((p) => p.name));
  const orphanedFeedback = allFeedback.filter((f) => !promptNames.has(f.promptName));

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="LLM Prompts"
        description={`View ${prompts.length} analysis prompts used by the regulatory analysis system. Submit feedback to help improve prompt quality.`}
      />

      <Container size="2xl" className="py-6">
        <PromptsList
          prompts={prompts}
          feedbackCounts={feedbackCounts}
          orphanedFeedback={orphanedFeedback}
        />
      </Container>
    </div>
  );
}
