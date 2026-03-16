'use client';

import { useCallback, useRef } from 'react';

interface ResizableDividerProps {
  /** Called during drag with the delta in pixels */
  onResize: (delta: number) => void;
  /** Called when drag ends */
  onResizeEnd?: () => void;
  /** Called on double-click to reset */
  onReset?: () => void;
  /** Orientation of the divider */
  orientation?: 'vertical' | 'horizontal';
  /** Additional class names */
  className?: string;
}

/**
 * A draggable divider for resizing adjacent panels.
 *
 * Usage:
 * ```tsx
 * <ResizableDivider
 *   onResize={(delta) => setWidth(w => w + delta)}
 *   onResizeEnd={() => saveToStorage()}
 *   onReset={() => setWidth(400)}
 * />
 * ```
 */
export function ResizableDivider({
  onResize,
  onResizeEnd,
  onReset,
  orientation = 'vertical',
  className = '',
}: ResizableDividerProps) {
  const isDragging = useRef(false);
  const lastPosition = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastPosition.current = orientation === 'vertical' ? e.clientX : e.clientY;

    // Capture pointer to receive events outside the element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
  }, [orientation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;

    const currentPosition = orientation === 'vertical' ? e.clientX : e.clientY;
    const delta = currentPosition - lastPosition.current;
    lastPosition.current = currentPosition;

    onResize(delta);
  }, [orientation, onResize]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;

    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Restore normal behavior
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    onResizeEnd?.();
  }, [onResizeEnd]);

  const handleDoubleClick = useCallback(() => {
    onReset?.();
  }, [onReset]);

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={`
        ${isVertical ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize'}
        flex-shrink-0 relative group
        ${className}
      `}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-orientation={orientation}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
    >
      {/* Invisible hit area */}
      <div
        className={`
          absolute
          ${isVertical ? 'inset-y-0 -left-2 -right-2' : 'inset-x-0 -top-2 -bottom-2'}
        `}
      />
      {/* Visible line */}
      <div
        className={`
          absolute
          ${isVertical ? 'inset-y-0 left-1/2 -translate-x-1/2 w-px' : 'inset-x-0 top-1/2 -translate-y-1/2 h-px'}
          bg-[var(--color-neutral-200)]
          group-hover:bg-[var(--color-primary)]
          transition-colors duration-[var(--duration-fast)]
        `}
      />
      {/* Grip indicator (3 dots) */}
      <div
        className={`
          absolute
          ${isVertical
            ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 items-center'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-row gap-1 items-center'}
          opacity-0 group-hover:opacity-100
          transition-opacity duration-[var(--duration-fast)]
        `}
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1 h-1 rounded-full bg-[var(--color-neutral-400)] group-hover:bg-[var(--color-primary)]"
          />
        ))}
      </div>
      {/* Hover background strip */}
      <div
        className={`
          absolute
          ${isVertical ? 'inset-y-0 left-0 right-0' : 'inset-x-0 top-0 bottom-0'}
          rounded
          bg-transparent group-hover:bg-[var(--color-neutral-100)]
          transition-colors duration-[var(--duration-fast)]
          -z-10
        `}
      />
    </div>
  );
}
