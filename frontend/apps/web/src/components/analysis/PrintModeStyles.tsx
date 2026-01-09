'use client';

import { useEffect } from 'react';

interface PrintModeStylesProps {
  isPrintMode: boolean;
}

/**
 * Client component that hides/shows elements marked with data-print-hide
 * when in print preview mode. This handles elements outside the React
 * component tree (like layout components).
 */
export function PrintModeStyles({ isPrintMode }: PrintModeStylesProps) {
  useEffect(() => {
    // Find all elements with data-print-hide attribute
    const elementsToHide = document.querySelectorAll('[data-print-hide]');

    elementsToHide.forEach((el) => {
      if (el instanceof HTMLElement) {
        if (isPrintMode) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
        }
      }
    });

    // Cleanup: restore display when unmounting or switching modes
    return () => {
      elementsToHide.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.display = '';
        }
      });
    };
  }, [isPrintMode]);

  return null;
}
