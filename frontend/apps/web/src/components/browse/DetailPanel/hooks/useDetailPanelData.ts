import { useEffect, useState } from 'react';
import type { RegulationWithAnalysis, ComplianceIssueWithAnalysisFields, CrossReferenceWithTarget, CrossReferenceWithSource, RegulationStatuteLinkWithStatute } from '@deproceduralizer/database';
import { getDocumentForPanel } from '@/lib/actions/hierarchy';
import { getComplianceIssuesByDocumentId } from '@/lib/actions/compliance-issues';
import { getCrossReferencesForDocument, getIncomingReferences } from '@/lib/actions/cross-references';
import { getStatuteLinksForRegulation } from '@/lib/actions/statutes';

export function useDetailPanelData(documentId: number | null) {
  const [document, setDocument] = useState<RegulationWithAnalysis | null>(null);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssueWithAnalysisFields[]>([]);
  const [crossRefs, setCrossRefs] = useState<CrossReferenceWithTarget[]>([]);
  const [incomingRefs, setIncomingRefs] = useState<CrossReferenceWithSource[]>([]);
  const [statuteLinks, setStatuteLinks] = useState<RegulationStatuteLinkWithStatute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
    } else {
      setDocument(null);
      setComplianceIssues([]);
      setCrossRefs([]);
      setIncomingRefs([]);
      setStatuteLinks([]);
    }
  }, [documentId]);

  async function loadDocument(id: number) {
    setIsLoading(true);
    setError(null);
    try {
      const [docResult, issuesResult, crossRefsResult, incomingRefsResult, statuteLinksResult] = await Promise.all([
        getDocumentForPanel(id),
        getComplianceIssuesByDocumentId(id),
        getCrossReferencesForDocument(id),
        getIncomingReferences(id),
        getStatuteLinksForRegulation(id),
      ]);

      if (!docResult.success) {
        setError(`Failed to load document: ${docResult.error}`);
        return;
      }

      if (!issuesResult.success) {
        console.error('Failed to load compliance issues:', issuesResult.error);
      }

      if (!crossRefsResult.success) {
        console.error('Failed to load cross-references:', crossRefsResult.error);
      }

      if (!incomingRefsResult.success) {
        console.error('Failed to load incoming references:', incomingRefsResult.error);
      }

      if (!statuteLinksResult.success) {
        console.error('Failed to load statute links:', statuteLinksResult.error);
      }

      setDocument(docResult.data);
      setComplianceIssues(issuesResult.success ? issuesResult.data : []);
      setCrossRefs(crossRefsResult.success ? crossRefsResult.data : []);
      setIncomingRefs(incomingRefsResult.success ? incomingRefsResult.data : []);
      setStatuteLinks(statuteLinksResult.success ? statuteLinksResult.data : []);
    } catch (err) {
      console.error('Failed to load document:', err);
      setError('Failed to load document details');
    } finally {
      setIsLoading(false);
    }
  }

  return {
    document,
    complianceIssues,
    crossRefs,
    incomingRefs,
    statuteLinks,
    isLoading,
    error,
  };
}
