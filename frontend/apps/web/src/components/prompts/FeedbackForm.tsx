'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { createPromptFeedback } from '@/lib/actions/prompt-feedback';
import type { FeedbackType } from '@deproceduralizer/database';

interface FeedbackFormProps {
  promptName: string;
  onSuccess?: () => void;
  className?: string;
}

const FEEDBACK_TYPE_OPTIONS = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

/**
 * Form for submitting feedback on a prompt
 */
export function FeedbackForm({
  promptName,
  onSuccess,
  className = '',
}: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion');
  const [content, setContent] = useState('');
  const [highlightedText, setHighlightedText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please enter your feedback');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await createPromptFeedback({
      promptName,
      feedbackType,
      content: content.trim(),
      highlightedText: highlightedText.trim() || undefined,
      authorName: authorName.trim() || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSuccess(true);
      setContent('');
      setHighlightedText('');
      onSuccess?.();
      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          Feedback submitted successfully! Thank you.
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            Feedback Type
          </label>
          <Select
            value={feedbackType}
            onValueChange={(value) => setFeedbackType(value as FeedbackType)}
            options={FEEDBACK_TYPE_OPTIONS}
            aria-label="Feedback type"
          />
        </div>

        <Input
          label="Your Name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Anonymous"
        />
      </div>

      <Input
        label="Specific text reference (optional)"
        value={highlightedText}
        onChange={(e) => setHighlightedText(e.target.value)}
        placeholder="Quote the specific part of the template you're referring to..."
        helperText="If your feedback relates to a specific part of the template, paste it here"
      />

      <Textarea
        label="Your Feedback"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe your suggestion, question, or issue..."
        rows={4}
        required
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || !content.trim()}
          className="flex items-center gap-2"
        >
          {isSubmitting ? (
            'Submitting...'
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Feedback
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default FeedbackForm;
