'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface PrintModeContextValue {
  isPrintMode: boolean;
}

const PrintModeContext = createContext<PrintModeContextValue>({ isPrintMode: false });

interface PrintModeProviderProps {
  isPrintMode: boolean;
  children: ReactNode;
}

/**
 * Provider for print mode state.
 * When isPrintMode is true, expandable components should render fully expanded
 * and interactive elements should be hidden.
 */
export function PrintModeProvider({ isPrintMode, children }: PrintModeProviderProps) {
  return (
    <PrintModeContext.Provider value={{ isPrintMode }}>
      {children}
    </PrintModeContext.Provider>
  );
}

/**
 * Hook to access print mode state.
 * Returns { isPrintMode: boolean }
 */
export function usePrintMode(): PrintModeContextValue {
  return useContext(PrintModeContext);
}
