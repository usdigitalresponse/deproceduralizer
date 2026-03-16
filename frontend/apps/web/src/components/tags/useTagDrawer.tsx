'use client';
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface TagDrawerState {
  isOpen: boolean;
  field: string | null;
  value: string | null;
  contextDocumentId?: number;
}

interface TagDrawerContextValue {
  state: TagDrawerState;
  openTag: (field: string, value: string, contextDocumentId?: number) => void;
  close: () => void;
}

const TagDrawerContext = createContext<TagDrawerContextValue | null>(null);

export function TagDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TagDrawerState>({
    isOpen: false,
    field: null,
    value: null,
  });

  const openTag = useCallback((field: string, value: string, contextDocumentId?: number) => {
    setState({ isOpen: true, field, value, contextDocumentId });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <TagDrawerContext.Provider value={{ state, openTag, close }}>
      {children}
    </TagDrawerContext.Provider>
  );
}

export function useTagDrawer(): TagDrawerContextValue {
  const ctx = useContext(TagDrawerContext);
  if (!ctx) {
    throw new Error('useTagDrawer must be used within a TagDrawerProvider');
  }
  return ctx;
}
