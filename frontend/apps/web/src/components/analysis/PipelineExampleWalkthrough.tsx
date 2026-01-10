'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, X } from 'lucide-react';
import {
  getClassificationColors,
  getClassificationLabel,
} from '@/lib/constants/pipeline';

/**
 * Example pipeline walkthrough data
 * Represents a real V5 pipeline journey through 3 tiers (T1 → T2 → T3)
 */
const EXAMPLE_JOURNEY = {
  document: {
    citation: 'N.J.A.C. 7:26-2.8',
    title: 'Submission of Manifests',
    issueType: 'in_person_submission',
    matchPreview: '...generator shall submit the manifest **in person** to the designated facility...',
  },
  steps: [
    {
      id: 0,
      tier: null,
      title: 'Document Identified',
      description: 'Regex patterns found potential compliance issue in regulation text.',
      details: [
        'Pattern "in person" matched in document',
        'Issue type: In-Person Submission',
        'Grouped with 2 other matches in same document',
      ],
      highlight: 'input',
    },
    {
      id: 1,
      tier: 1,
      title: 'Tier 1: Match Filtering',
      description: 'AI reviews matches with context catalog to filter false positives and generate argument framing.',
      details: [
        'Context catalog shows document is about waste manifest submissions',
        'Sibling sections discuss delivery procedures',
        '"In person" appears in procedural context, not incidental mention',
        'Generated argument framing for Tier 2 analysis',
      ],
      classification: 'needs_research',
      output: 'Valid match - proceeding to Tier 2',
      highlight: 'tier1',
    },
    {
      id: 2,
      tier: 2,
      title: 'Tier 2: Full Classification',
      description: 'Deep analysis with full document text, definitions, and Tier 1 argument framing.',
      details: [
        'Full document text analyzed for requirement scope',
        'Inherited definitions and cross-references consulted',
        'Identified: "Physical submission of hazardous waste manifests required"',
        'Severity assessed: 7/10 (significant operational burden)',
        'High-risk issue type (in_person_*) triggers Tier 3 escalation',
      ],
      classification: 'burdensome',
      severity: 7,
      output: 'High-risk issue + severity ≥ 7 - escalating to Tier 3 for web verification',
      highlight: 'tier2',
    },
    {
      id: 3,
      tier: 3,
      title: 'Tier 3: Web Search Verification',
      description: 'External web search validates findings against federal requirements.',
      details: [
        'Searched: "EPA hazardous waste manifest submission requirements"',
        'Found: EPA e-Manifest system allows electronic submission',
        'Federal law permits electronic manifests since 2018',
        'NJ requirement for in-person submission exceeds federal mandate',
      ],
      classification: 'burdensome',
      severity: 8,
      federalMandateFound: false,
      stateDiscretion: 'high',
      output: 'Confirmed burdensome - state exceeds federal requirements',
      highlight: 'tier3',
    },
    {
      id: 4,
      tier: null,
      title: 'Analysis Complete',
      description: 'Pipeline finished with final classification and severity.',
      details: [
        'Final Classification: Burdensome',
        'Final Severity: 8/10',
        'Federal Mandate: No (state discretion)',
        'Verbatim Requirement: "generator shall submit the manifest in person to the designated facility"',
      ],
      classification: 'burdensome',
      severity: 8,
      highlight: 'complete',
    },
  ],
};

interface PipelineExampleWalkthroughProps {
  onClose: () => void;
}

export function PipelineExampleWalkthrough({ onClose }: PipelineExampleWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const step = EXAMPLE_JOURNEY.steps[currentStep];
  const totalSteps = EXAMPLE_JOURNEY.steps.length;

  const goNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentStep, totalSteps]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      goNext();
    }, 3000);

    return () => clearInterval(timer);
  }, [isPlaying, goNext]);

  // Stop playing when reaching end
  useEffect(() => {
    if (currentStep === totalSteps - 1) {
      setIsPlaying(false);
    }
  }, [currentStep, totalSteps]);

  return (
    <div className="bg-white border border-[var(--color-primary)]/30 rounded-[var(--radius-lg)] overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-primary-bg)] border-b border-[var(--color-primary)]/20">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 text-xs font-bold text-white bg-[var(--color-primary)] rounded">
            EXAMPLE
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Pipeline Walkthrough
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {EXAMPLE_JOURNEY.document.citation} - {EXAMPLE_JOURNEY.document.title}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded transition-colors"
          aria-label="Close walkthrough"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-[var(--color-neutral-100)]">
        <div
          className="h-full bg-[var(--color-primary)] transition-all duration-300"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Tier Flow Indicator - V5: T1 → T2 → T3 */}
      <div className="flex items-center justify-center gap-1 py-3 border-b border-[var(--color-neutral-200)]">
        {/* Start marker */}
        <button
          onClick={() => setCurrentStep(0)}
          className={`flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full transition-all ${
            currentStep === 0
              ? 'bg-[var(--color-primary)] text-white scale-110'
              : 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30'
          }`}
        >
          🔍
        </button>

        <span className="text-[var(--color-neutral-300)]">→</span>

        {/* T1 */}
        <button
          onClick={() => setCurrentStep(1)}
          className={`flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full transition-all ${
            currentStep === 1
              ? 'bg-[var(--color-primary)] text-white scale-110'
              : currentStep > 1
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'
          }`}
        >
          T1
        </button>

        <span className="text-[var(--color-neutral-300)]">→</span>

        {/* T2 */}
        <button
          onClick={() => setCurrentStep(2)}
          className={`flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full transition-all ${
            currentStep === 2
              ? 'bg-[var(--color-primary)] text-white scale-110'
              : currentStep > 2
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'
          }`}
        >
          T2
        </button>

        <span className="text-[var(--color-neutral-300)]">→</span>

        {/* T3 */}
        <button
          onClick={() => setCurrentStep(3)}
          className={`flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full transition-all ${
            currentStep === 3
              ? 'bg-[var(--color-primary)] text-white scale-110'
              : currentStep > 3
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'
          }`}
        >
          T3
        </button>

        <span className="text-[var(--color-neutral-300)]">→</span>

        {/* Complete marker */}
        <button
          onClick={() => setCurrentStep(4)}
          className={`flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full transition-all ${
            currentStep === 4
              ? 'bg-[var(--color-primary)] text-white scale-110'
              : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'
          }`}
        >
          ✓
        </button>
      </div>

      {/* Escalation explanation - shows when moving from T2 to T3 */}
      {currentStep === 2 && (
        <div className="flex items-center justify-center gap-2 py-2 bg-[var(--color-info-bg)] border-b border-[var(--color-info)]/20">
          <span className="text-xs text-[var(--color-info)]">
            ℹ️ High-risk issue type + severity ≥ 7 triggers Tier 3 web verification
          </span>
        </div>
      )}

      {/* Current Step Content */}
      <div className="p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Step {currentStep + 1} of {totalSteps}
            </span>
            {step.tier !== null && (
              <span className="px-2 py-0.5 text-xs font-bold text-white bg-[var(--color-primary)] rounded">
                Tier {step.tier}
              </span>
            )}
          </div>
          <h4 className="text-lg font-semibold text-[var(--color-text)] mb-1">
            {step.title}
          </h4>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {step.description}
          </p>
        </div>

        {/* Details List */}
        <div className="mb-4 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
          <ul className="space-y-2">
            {step.details.map((detail, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-primary)] mt-0.5">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Classification & Severity */}
        {step.classification && (
          <div className="flex items-center gap-4 mb-4">
            <div>
              <span className="text-xs text-[var(--color-text-muted)] block mb-1">Classification</span>
              <span
                className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded border ${
                  getClassificationColors(step.classification).bg
                } ${getClassificationColors(step.classification).text} ${
                  getClassificationColors(step.classification).border
                }`}
              >
                {getClassificationLabel(step.classification)}
              </span>
            </div>
            {step.severity !== undefined && (
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block mb-1">Severity</span>
                <span className="inline-flex items-center px-2.5 py-1 text-sm font-bold text-[var(--color-warning)] bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 rounded">
                  {step.severity}/10
                </span>
              </div>
            )}
            {'federalMandateFound' in step && (
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block mb-1">Federal Mandate</span>
                <span className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded border ${
                  step.federalMandateFound
                    ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]/30'
                    : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)] border-[var(--color-neutral-300)]'
                }`}>
                  {step.federalMandateFound ? 'Yes' : 'No'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Output/Decision */}
        {step.output && (
          <div className="p-3 bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 rounded-[var(--radius-md)]">
            <span className="text-xs font-medium text-[var(--color-info)] block mb-1">Decision</span>
            <p className="text-sm text-[var(--color-info)]">{step.output}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
        <button
          onClick={reset}
          disabled={currentStep === 0 && !isPlaying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={currentStep === 0}
            className="flex items-center justify-center w-8 h-8 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous step"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded transition-colors ${
              isPlaying
                ? 'bg-[var(--color-neutral-200)] text-[var(--color-text)]'
                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                {currentStep === totalSteps - 1 ? 'Replay' : 'Auto-play'}
              </>
            )}
          </button>

          <button
            onClick={goNext}
            disabled={currentStep === totalSteps - 1}
            className="flex items-center justify-center w-8 h-8 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next step"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-[var(--color-text-muted)]">
          {isPlaying && 'Auto-advancing...'}
        </div>
      </div>
    </div>
  );
}

export default PipelineExampleWalkthrough;
