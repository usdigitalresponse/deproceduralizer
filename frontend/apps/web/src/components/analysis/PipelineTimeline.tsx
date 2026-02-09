'use client';

import type { FullAnalysisRecord } from '@deproceduralizer/database';
import { TierSection } from './TierSection';
import { ReasoningBlock } from './ReasoningBlock';
import { SeverityProgression } from './SeverityProgression';
import { DismissedMatchesDisplay } from './DismissedMatchesDisplay';
import { RoutingDecision } from './RoutingDecision';
import { ArgumentFramingSummary } from './ArgumentFramingSummary';
import { Tier3FlagsDisplay } from './Tier3FlagsDisplay';
import { ExpandableSection } from './ExpandableSection';
import { EvidenceDisplay } from '@/components/issues/EvidenceDisplay';
import { Badge } from '@/components/ui';

interface PipelineTimelineProps {
  analysis: FullAnalysisRecord;
}

export function PipelineTimeline({ analysis }: PipelineTimelineProps) {
  const { tier1, tier2, tier3, highestTierCompleted } = analysis;

  const normalizedHighest = highestTierCompleted;

  return (
    <div className="space-y-4">
      {/* Pipeline Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">
          Pipeline Journey
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="info">
            Completed through Tier {normalizedHighest}
          </Badge>
        </div>
      </div>

      {/* Tier Sections */}
      <div className="space-y-3">
        {/* Tier 1: Match Filtering */}
        <TierSection
          tierNumber={1}
          title="Match Filtering"
          classification={tier1?.classification || null}
          confidence={tier1?.confidence}
          completedAt={tier1?.completedAt || null}
          isCompleted={!!tier1}
        >
          {tier1 && (
            <div className="space-y-4">
              <ReasoningBlock label="Reasoning" text={tier1.reasoning} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Relevant Matches
                  </span>
                  <div className="text-sm font-medium text-[var(--color-success)]">
                    {tier1.relevantMatchIds?.length || 0} matches
                  </div>
                </div>
                <div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Dismissed Matches
                  </span>
                  <div className="text-sm font-medium text-[var(--color-danger)]">
                    {tier1.dismissedMatchIds?.length || 0} matches
                  </div>
                </div>
              </div>

              <DismissedMatchesDisplay dismissedMatches={tier1.dismissedReasons} />

              {tier1.contextRequests && tier1.contextRequests.length > 0 && (
                <div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Context Requested
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tier1.contextRequests.map((req, i) => (
                      <Badge key={i} variant="default" className="text-xs">
                        {req.contextType}: {req.identifier}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* V5: Argument Framing - show full view, not compact */}
              {tier1.argumentFraming && (
                <ArgumentFramingSummary data={tier1.argumentFraming} />
              )}

              {/* V5: Context Requests (Show more) */}
              {tier1.recommendations?.context_requests && tier1.recommendations.context_requests.length > 0 && (
                <ExpandableSection label="Show context requests">
                  <div className="space-y-2">
                    {tier1.recommendations.context_requests.map((req, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Badge variant="default" className="text-xs shrink-0">
                          {req.context_type}
                        </Badge>
                        <div className="text-xs">
                          <span className="font-medium">{req.identifier}</span>
                          <span className="text-[var(--color-text-muted)] ml-1">
                            [{req.need_level}]
                          </span>
                          <span className="text-[var(--color-text-secondary)] block">
                            {req.reason}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ExpandableSection>
              )}

              {/* Routing Decision */}
              <RoutingDecision
                tier={1}
                classification={tier1.classification}
                relevantMatchCount={tier1.relevantMatchIds?.length || 0}
                advancedToNextTier={tier1.classification === 'needs_research' && normalizedHighest >= 2}
              />
            </div>
          )}
        </TierSection>

        {/* Tier 2: Full Classification */}
        <TierSection
          tierNumber={2}
          title="Full Classification"
          classification={tier2?.classification || null}
          confidence={tier2?.confidence}
          completedAt={tier2?.completedAt || null}
          isCompleted={!!tier2}
        >
          {tier2 && (
            <div className="space-y-4">
              <ReasoningBlock label="Reasoning" text={tier2.reasoning} />

              {/* Steelman Arguments */}
              <div className="grid md:grid-cols-2 gap-3">
                <ReasoningBlock
                  label="Argument For Regulation"
                  text={tier2.argumentForRegulation}
                  variant="for"
                />
                <ReasoningBlock
                  label="Argument Against Regulation"
                  text={tier2.argumentAgainstRegulation}
                  variant="against"
                />
              </div>

              {/* Severity */}
              {tier2.severity && (
                <div className="bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 rounded-[var(--radius-sm)] p-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)]">Severity</span>
                      <div className="text-2xl font-bold text-[var(--color-warning)]">
                        {tier2.severity}
                      </div>
                    </div>
                    {tier2.severityCalculation && (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {tier2.severityCalculation}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Context Used (includes Verbatim Requirements) */}
              {(tier2.verbatimRequirements?.length > 0 || (tier2.contextUsed && tier2.contextUsed.length > 0)) && (
                <EvidenceDisplay contextUsed={tier2.contextUsed} verbatimRequirements={tier2.verbatimRequirements} />
              )}

              {/* Flags */}
              <div className="flex flex-wrap gap-2">
                {tier2.potentiallyControversial && (
                  <Badge variant="warning">Potentially Controversial</Badge>
                )}
                {tier2.federalMandateSuspected && (
                  <Badge variant="danger">Federal Mandate Suspected</Badge>
                )}
                {tier2.needsWebSearch && (
                  <Badge variant="info">Needs Web Search</Badge>
                )}
                {/* V5 flags */}
                {tier2.citesFederalStatute && (
                  <Badge variant="info" title={tier2.federalCitation || undefined}>
                    Federal Statute Cited{tier2.federalCitation ? `: ${tier2.federalCitation.slice(0, 30)}...` : ''}
                  </Badge>
                )}
                {tier2.claimsNoAlternative && (
                  <Badge variant="warning">Claims No Alternative</Badge>
                )}
                {tier2.rerunCount > 0 && (
                  <Badge variant="warning" className="animate-pulse">
                    Re-ran {tier2.rerunCount}x for context
                  </Badge>
                )}
                {tier2.forcedClassification && (
                  <Badge variant="danger">Forced Classification</Badge>
                )}
              </div>

              {/* Web Search Topics suggested by Tier 2 */}
              {tier2.webSearchTopics && tier2.webSearchTopics.length > 0 && (
                <div className="bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 rounded-[var(--radius-sm)] p-3">
                  <h5 className="text-xs font-medium text-[var(--color-info)] mb-2">
                    Suggested Web Search Topics
                  </h5>
                  <ul className="space-y-1">
                    {tier2.webSearchTopics.map((topic, i) => (
                      <li key={i} className="text-xs text-[var(--color-text-secondary)]">
                        • {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* V5.2: Web Search Strategy (disambiguation for Tier 3) */}
              {(tier2.programContext || tier2.notToConfuseWith?.length || tier2.searchScopeGuidance) && (
                <ExpandableSection label="Web Search Strategy">
                  <div className="space-y-3">
                    {tier2.programContext && (
                      <div>
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          Program Context
                        </span>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          {tier2.programContext}
                        </p>
                      </div>
                    )}
                    {tier2.notToConfuseWith && tier2.notToConfuseWith.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          Not to Confuse With
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tier2.notToConfuseWith.map((item, i) => (
                            <Badge key={i} variant="warning" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {tier2.searchScopeGuidance && (
                      <div>
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          Search Scope Guidance
                        </span>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          {tier2.searchScopeGuidance}
                        </p>
                      </div>
                    )}
                  </div>
                </ExpandableSection>
              )}

              {/* V5: Context requests made during re-runs */}
              {tier2.contextRequestsMade && tier2.contextRequestsMade.length > 0 && (
                <ExpandableSection label="Show context requests">
                  <div className="space-y-1">
                    {tier2.contextRequestsMade.map((req, i) => (
                      <div key={i} className="text-xs text-[var(--color-text-secondary)]">
                        <span className="font-medium">{req.context_type}:</span> {req.identifier}
                        <span className="text-[var(--color-text-muted)]"> - {req.reason}</span>
                      </div>
                    ))}
                  </div>
                </ExpandableSection>
              )}

              {/* Routing Decision */}
              <RoutingDecision
                tier={2}
                classification={tier2.classification}
                severity={tier2.severity}
                confidence={tier2.confidence}
                issueType={analysis.issueType}
                citesFederalStatute={tier2.citesFederalStatute}
                federalCitation={tier2.federalCitation}
                claimsNoAlternative={tier2.claimsNoAlternative}
                potentiallyControversial={tier2.potentiallyControversial}
                federalMandateSuspected={tier2.federalMandateSuspected}
                needsWebSearch={tier2.needsWebSearch}
                advancedToNextTier={normalizedHighest >= 3}
              />
            </div>
          )}
        </TierSection>

        {/* Tier 3: Web Search Verification */}
        <TierSection
          tierNumber={3}
          title="Web Search Verification"
          classification={tier3?.classification || null}
          confidence={tier3?.confidence}
          completedAt={tier3?.completedAt || null}
          isCompleted={!!tier3}
        >
          {tier3 && (
            <div className="space-y-4">
              {/* V5.1: Show why this was escalated to Tier 3 */}
              {tier3.triggerReason && (
                <div className="bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 rounded-[var(--radius-sm)] p-3">
                  <span className="text-xs font-medium text-[var(--color-info)]">
                    Escalation Trigger:
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)] ml-2">
                    {tier3.triggerReason}
                  </span>
                </div>
              )}

              <ReasoningBlock label="Reasoning" text={tier3.reasoning} />

              {/* Web search summary */}
              {tier3.webSearchSummary && (
                <div className="bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 rounded-[var(--radius-sm)] p-3">
                  <h5 className="text-xs font-semibold text-[var(--color-info)] mb-2">
                    Web Search Summary
                  </h5>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {tier3.webSearchSummary}
                  </p>
                </div>
              )}

              {/* Federal Mandate / State Discretion flags */}
              <div className="flex flex-wrap gap-2">
                {tier3.federalMandateFound && (
                  <Badge variant="danger">Federal Mandate Found</Badge>
                )}
                {tier3.stateHasDiscretion && (
                  <Badge variant="success">State Has Discretion</Badge>
                )}
                {!tier3.stateHasDiscretion && tier3.federalMandateFound && (
                  <Badge variant="danger">No State Discretion</Badge>
                )}
              </div>

              {/* Severity Adjustment */}
              {tier3.severityAdjustment !== null && tier3.severityAdjustment !== 0 && (
                <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Severity Adjustment
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        tier3.severityAdjustment > 0
                          ? 'text-[var(--color-danger)]'
                          : 'text-[var(--color-success)]'
                      }`}
                    >
                      {tier3.severityAdjustment > 0 ? '+' : ''}
                      {tier3.severityAdjustment}
                    </span>
                  </div>
                  {tier3.severityAdjustmentReasoning && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {tier3.severityAdjustmentReasoning}
                    </p>
                  )}
                </div>
              )}

              {/* Structured flags with evidence */}
              {tier3.flags && (
                <Tier3FlagsDisplay
                  flags={tier3.flags}
                  evidenceGap={tier3.evidenceGap}
                />
              )}

              {/* Routing Decision (always terminal for Tier 3) */}
              <RoutingDecision
                tier={3}
                classification={tier3.classification}
                evidenceGap={tier3.evidenceGap}
                advancedToNextTier={false}
              />
            </div>
          )}
        </TierSection>
      </div>

      {/* Severity Progression */}
      <SeverityProgression
        baseSeverity={tier2?.severity || null}
        tier3Adjustment={tier3?.severityAdjustment || null}
        finalSeverity={analysis.finalSeverity}
        tier2Calculation={tier2?.severityCalculation || null}
        tier3Reasoning={tier3?.severityAdjustmentReasoning || null}
      />
    </div>
  );
}

export default PipelineTimeline;
