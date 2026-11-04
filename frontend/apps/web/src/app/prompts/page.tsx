import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui';
import { PromptsClient } from '@/components/prompts';
import { getPrompts, getCompliancePrompts, getBarrierPrompts, getTournamentPrompts } from '@/lib/actions/prompts';
import { getAllFeedback, getFeedbackCounts } from '@/lib/actions/prompt-feedback';
import { getIssueTypesList } from '@/lib/actions/research-pipeline';

export default async function PromptsPage() {
  // Fetch prompts and feedback data in parallel
  const [promptsResult, compliancePromptsResult, barrierPromptsResult, tournamentPromptsResult, feedbackCountsResult, allFeedbackResult, issueTypesResult] = await Promise.all([
    getPrompts(),
    getCompliancePrompts(),
    getBarrierPrompts(),
    getTournamentPrompts(),
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
  const barrierPrompts = barrierPromptsResult.success ? barrierPromptsResult.data : [];
  const tournamentPrompts = tournamentPromptsResult.success ? tournamentPromptsResult.data : [];
  const feedbackCounts = feedbackCountsResult.success ? feedbackCountsResult.data : {};
  const allFeedback = allFeedbackResult.success ? allFeedbackResult.data : [];
  const issueTypes = issueTypesResult.success ? issueTypesResult.data : [];

  // Detect orphaned feedback (feedback for prompts that no longer exist)
  const promptNames = new Set(prompts.map((p) => p.name));
  const orphanedFeedback = allFeedback.filter((f) => !promptNames.has(f.promptName));

  const totalPrompts = prompts.length + compliancePrompts.length + barrierPrompts.length + tournamentPrompts.length;

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="LLM Prompts"
        description={`View ${totalPrompts} prompts used by the regulatory analysis system (${prompts.length} core, ${compliancePrompts.length} compliance, ${barrierPrompts.length} Barrier, ${tournamentPrompts.length} tournament). Submit feedback to help improve prompt quality.`}
      />

      <Container size="2xl" className="py-6">
        <PromptsClient
          prompts={prompts}
          compliancePrompts={compliancePrompts}
          barrierPrompts={barrierPrompts}
          tournamentPrompts={tournamentPrompts}
          feedbackCounts={feedbackCounts}
          orphanedFeedback={orphanedFeedback}
          issueTypes={issueTypes}
        />
      </Container>
    </div>
  );
}
