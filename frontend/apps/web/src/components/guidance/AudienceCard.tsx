'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Badge } from '@/components/ui/Badge';

interface AudienceCardProps {
  targetAudience: string[] | null;
  audienceDirection: string | null;
  audienceExpertise: string | null;
  audienceExplanation: string | null;
}

const directionVariant: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  public: 'success',
  government: 'info',
  both: 'warning',
};

const expertiseVariant: Record<string, 'success' | 'warning' | 'default'> = {
  lay: 'success',
  specialized: 'warning',
};

export function AudienceCard({
  targetAudience,
  audienceDirection,
  audienceExpertise,
  audienceExplanation,
}: AudienceCardProps) {
  const hasData = targetAudience?.length || audienceDirection || audienceExpertise || audienceExplanation;
  if (!hasData) return null;

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Audience</CardTitle>
      </CardHeader>
      <div className="pt-4 space-y-3">
        {/* Direction + Expertise badges */}
        {(audienceDirection || audienceExpertise) && (
          <div className="flex items-center gap-2 flex-wrap">
            {audienceDirection && (
              <Badge variant={directionVariant[audienceDirection] ?? 'default'}>
                {audienceDirection}
              </Badge>
            )}
            {audienceExpertise && (
              <Badge variant={expertiseVariant[audienceExpertise] ?? 'default'}>
                {audienceExpertise}
              </Badge>
            )}
          </div>
        )}

        {/* Target audience tags */}
        {targetAudience && targetAudience.length > 0 && (
          <div>
            <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Target Audience
            </span>
            <div className="flex flex-wrap gap-1">
              {targetAudience.map((audience) => (
                <Tag key={audience} variant="primary" size="sm">
                  {audience}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* Explanation */}
        {audienceExplanation && (
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            {audienceExplanation}
          </p>
        )}
      </div>
    </Card>
  );
}
