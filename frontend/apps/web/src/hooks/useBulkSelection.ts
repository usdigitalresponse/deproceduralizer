'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * Shared hook for checkbox-based bulk selection in tables.
 * Tracks a set of selected keys and provides toggle/selectAll/clear helpers.
 */
export function useBulkSelection<K extends string | number>(visibleKeys: K[]) {
  const [selectedKeys, setSelectedKeys] = useState<Set<K>>(new Set());

  const toggle = useCallback((key: K) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(visibleKeys));
  }, [visibleKeys]);

  const clear = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const isAllSelected = useMemo(
    () => visibleKeys.length > 0 && visibleKeys.every(k => selectedKeys.has(k)),
    [visibleKeys, selectedKeys]
  );

  const isSomeSelected = useMemo(
    () => visibleKeys.some(k => selectedKeys.has(k)),
    [visibleKeys, selectedKeys]
  );

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      clear();
    } else {
      selectAll();
    }
  }, [isAllSelected, clear, selectAll]);

  return {
    selectedKeys,
    toggle,
    selectAll,
    clear,
    toggleAll,
    isAllSelected,
    isSomeSelected,
    count: selectedKeys.size,
  };
}
