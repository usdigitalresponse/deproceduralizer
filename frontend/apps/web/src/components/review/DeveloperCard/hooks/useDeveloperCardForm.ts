import { useState, useEffect } from 'react';
import { useDeveloperName } from '@/hooks/useDeveloperName';
import type { DeveloperItem } from '@/lib/actions/developer';
import type { DeveloperFormData } from '../types';

export function useDeveloperCardForm(item: DeveloperItem) {
  const { developerName: storedName, saveDeveloperName, isLoaded } = useDeveloperName();

  const [formData, setFormData] = useState<DeveloperFormData>({
    developerStatus: item.developerStatus || 'unresolved',
    developerAssigned: item.developerAssigned || '',
    developerNotes: item.developerNotes || '',
    resolutionType: item.resolutionType || '',
    resolutionComments: item.resolutionComments || '',
    developerQuestion: item.developerQuestion || '',
  });

  // Pre-fill developer name from localStorage
  useEffect(() => {
    if (isLoaded && storedName && !formData.developerAssigned) {
      setFormData((prev) => ({ ...prev, developerAssigned: storedName }));
    }
  }, [isLoaded, storedName, formData.developerAssigned]);

  return {
    formData,
    setFormData,
    saveDeveloperName,
  };
}
