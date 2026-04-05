'use client';

import { useState } from 'react';
import { SeverityBadge } from '@/components/ui';
import type {
  TournamentResults,
  TournamentPattern,
  TournamentExample,
  TournamentNamedFinding,
} from '@/lib/actions/jenai-strategies';

interface JenAIRecommendationsTabProps {
  results: TournamentResults | null;
}

function PatternCard({ pattern, domainFilter = 'all' }: { pattern: TournamentPattern; domainFilter?: string }) {
  const [expanded, setExpanded] = useState(false);

  const isPermitting = (ex: TournamentExample) => {
    const e = (ex.explanation + ' ' + ex.fix).toLowerCase();
    const hasPermitWord = e.includes('license') || e.includes('permit') || e.includes('certific');
    const hasProcessWord = e.includes('applicat') || e.includes('renewal') || e.includes('approv') || e.includes('issu');
    return hasPermitWord && hasProcessWord && !e.includes('appeal') && !e.includes('hearing');
  };
  const filteredExamples = domainFilter === 'all'
    ? pattern.examples
    : domainFilter === 'Permitting'
      ? pattern.examples.filter(isPermitting)
      : pattern.examples.filter((ex) => ex.domain === domainFilter);

  return (
    <div className="border rounded p-4 bg-white">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <h6 className="mb-0 fw-semibold">{pattern.name}</h6>
        <span className="badge bg-primary-subtle text-primary ms-2 flex-shrink-0">
          {domainFilter !== 'all' && pattern.domainBreakdown?.[domainFilter]
            ? `${pattern.domainBreakdown[domainFilter]} ${domainFilter} regs`
            : `${pattern.regulationCount} regs`}
        </span>
      </div>
      <p className="text-muted small mb-2">{pattern.description}</p>

      {filteredExamples.length > 0 && (
        <>
          <button
            className="btn btn-sm btn-outline-secondary mb-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide' : 'Show'} {filteredExamples.length} examples
          </button>

          {expanded && (
            <div className="mt-2">
              {filteredExamples.map((ex) => (
                <div
                  key={ex.id}
                  className="border-start border-3 border-primary-subtle ps-3 mb-3"
                >
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <code className="small">{ex.citation}</code>
                    {ex.severity && <SeverityBadge severity={ex.severity} />}
                    {ex.domain && (
                      <span className="badge bg-secondary-subtle text-secondary small">
                        {ex.domain}
                      </span>
                    )}
                  </div>
                  <p className="small mb-1">
                    <strong>Fix:</strong> {ex.fix}
                  </p>
                  <p className="small text-muted mb-0">
                    <strong>Why it matters:</strong> {ex.whyItMatters}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NamedFindingCard({ finding }: { finding: TournamentNamedFinding }) {
  return (
    <div className="border rounded p-3 bg-white">
      <h6 className="fw-semibold mb-1">{finding.name}</h6>
      <p className="small mb-1">
        <strong>Fix:</strong> {finding.fix}
      </p>
      <p className="small text-muted mb-1">{finding.why}</p>
      <div className="d-flex flex-wrap gap-1">
        {finding.citations.map((cite) => (
          <code key={cite} className="small">
            {cite}
          </code>
        ))}
      </div>
    </div>
  );
}

export function JenAIRecommendationsTab({ results }: JenAIRecommendationsTabProps) {
  const [domainFilter, setDomainFilter] = useState<string>('all');

  if (!results) {
    return (
      <div className="text-center py-5 text-muted">
        No tournament results available. Run the tournament pipeline first.
      </div>
    );
  }

  // Collect all domains across examples
  const allDomains = new Set<string>();
  [...results.pass1Patterns, ...results.pass2Patterns].forEach((p) => {
    p.examples.forEach((ex) => {
      if (ex.domain) allDomains.add(ex.domain);
    });
    if (p.domainBreakdown) {
      Object.keys(p.domainBreakdown).forEach((d) => allDomains.add(d));
    }
  });
  const domainOptions = Array.from(allDomains).sort();

  // Permitting: examples about license/permit/certificate + application/renewal/approval
  const isPermittingExample = (ex: TournamentExample) => {
    const e = (ex.explanation + ' ' + ex.fix).toLowerCase();
    const hasPermitWord = e.includes('license') || e.includes('permit') || e.includes('certific');
    const hasProcessWord = e.includes('applicat') || e.includes('renewal') || e.includes('approv') || e.includes('issu');
    const isExcluded = e.includes('appeal') || e.includes('hearing');
    return hasPermitWord && hasProcessWord && !isExcluded;
  };

  // Filter patterns: show pattern if it has any examples in the selected domain
  const filterPatterns = (patterns: typeof results.pass1Patterns) => {
    if (domainFilter === 'all') return patterns;
    if (domainFilter === 'Permitting') {
      return patterns.filter((p) => p.examples.some(isPermittingExample));
    }
    return patterns.filter((p) =>
      p.domainBreakdown?.[domainFilter] ||
      p.examples.some((ex) => ex.domain === domainFilter)
    );
  };

  const filteredPass1 = filterPatterns(results.pass1Patterns);
  const filteredPass2 = filterPatterns(results.pass2Patterns);
  const filteredNamed = domainFilter === 'all'
    ? results.namedFindings
    : results.namedFindings.filter((nf) => {
        // Named findings don't have domain yet — filter by citation pattern
        const cite = (nf.citations[0] || '').toLowerCase();
        if (domainFilter === 'Childcare') return cite.includes('18 nycrr 41');
        if (domainFilter === 'Health') return cite.includes('10 nycrr');
        if (domainFilter === 'Education') return cite.includes('8 nycrr');
        return true;
      });

  const pass1Total = filteredPass1.reduce((sum, p) => sum + p.regulationCount, 0);
  const pass2Total = filteredPass2.reduce((sum, p) => sum + p.regulationCount, 0);

  return (
    <div>
      {/* Domain filter */}
      <div className="mb-4">
        <select
          className="form-select form-select-sm d-inline-block w-auto"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
        >
          <option value="all">All domains</option>
          <option value="Permitting">Permitting (cross-cutting)</option>
          {domainOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {domainFilter !== 'all' && (
          <button
            className="btn btn-sm btn-link ms-2"
            onClick={() => setDomainFilter('all')}
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="border rounded p-3 bg-white text-center">
            <div className="fs-2 fw-bold text-primary">
              {filteredPass1.length + filteredPass2.length}
            </div>
            <div className="text-muted small">Fix Patterns</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="border rounded p-3 bg-white text-center">
            <div className="fs-2 fw-bold text-primary">{pass1Total + pass2Total}</div>
            <div className="text-muted small">Regulations Affected</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="border rounded p-3 bg-white text-center">
            <div className="fs-2 fw-bold text-primary">{filteredNamed.length}</div>
            <div className="text-muted small">Named Findings</div>
          </div>
        </div>
      </div>

      {/* Pass 1: Easy Text Fixes */}
      <div className="mb-5">
        <div className="mb-3">
          <h5 className="fw-bold mb-1">Easy Text Fixes</h5>
          <p className="text-muted small mb-0">
            Literal word swaps and reference updates — {filteredPass1.length} patterns
            covering {pass1Total} regulations
          </p>
        </div>
        <div className="d-flex flex-column gap-3">
          {filteredPass1.map((p) => (
            <PatternCard key={p.id} pattern={p} domainFilter={domainFilter} />
          ))}
        </div>
      </div>

      {/* Pass 2: Structural Policy Fixes */}
      <div className="mb-5">
        <div className="mb-3">
          <h5 className="fw-bold mb-1">Structural Policy Fixes</h5>
          <p className="text-muted small mb-0">
            One-sentence policy changes: proportionality, size exemptions, prioritization —{' '}
            {filteredPass2.length} patterns covering {pass2Total} regulations
          </p>
        </div>
        <div className="d-flex flex-column gap-3">
          {filteredPass2.map((p) => (
            <PatternCard key={p.id} pattern={p} domainFilter={domainFilter} />
          ))}
        </div>
      </div>

      {/* Named Findings */}
      {filteredNamed.length > 0 && (
        <div className="mb-5">
          <div className="mb-3">
            <h5 className="fw-bold mb-1">Named Findings</h5>
            <p className="text-muted small mb-0">
              Individual findings where the fix is a specific text change to one regulation
            </p>
          </div>
          <div className="d-flex flex-column gap-3">
            {filteredNamed.map((f) => (
              <NamedFindingCard key={f.id} finding={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
