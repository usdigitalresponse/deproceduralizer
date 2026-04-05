'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ReactNode, forwardRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * Mobile-friendly slide-in drawer/sheet component.
 * Based on Radix Dialog with slide animations.
 */
export function Drawer({ open, onOpenChange, children }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

interface DrawerTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export function DrawerTrigger({ children, asChild }: DrawerTriggerProps) {
  return (
    <Dialog.Trigger asChild={asChild}>
      {children}
    </Dialog.Trigger>
  );
}

interface DrawerContentProps {
  children: ReactNode;
  className?: string;
  side?: 'left' | 'right' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sideStyles = {
  left: {
    position: 'left-0 top-0 h-full',
    animation: {
      open: 'slide-in-from-left',
      close: 'slide-out-to-left',
    },
  },
  right: {
    position: 'right-0 top-0 h-full',
    animation: {
      open: 'slide-in-from-right',
      close: 'slide-out-to-right',
    },
  },
  bottom: {
    position: 'bottom-0 left-0 w-full',
    animation: {
      open: 'slide-in-from-bottom',
      close: 'slide-out-to-bottom',
    },
  },
};

const sizeStyles = {
  left: {
    sm: 'w-72',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[680px] max-w-full',
    full: 'w-full',
  },
  right: {
    sm: 'w-72',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[680px] max-w-full',
    full: 'w-full',
  },
  bottom: {
    sm: 'h-1/3',
    md: 'h-1/2',
    lg: 'h-3/4',
    xl: 'h-5/6',
    full: 'h-full',
  },
};

export const DrawerContent = forwardRef<HTMLDivElement, DrawerContentProps>(
  ({ children, className = '', side = 'right', size = 'lg' }, ref) => {
    const sideConfig = sideStyles[side];
    const sizeClass = sizeStyles[side][size];

    return (
      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed inset-0 z-[var(--z-modal-backdrop)]
            bg-[rgba(8,27,43,0.6)]
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0
            data-[state=open]:fade-in-0
            duration-300
          "
        />
        <Dialog.Content
          ref={ref}
          className={`
            fixed
            ${sideConfig.position}
            ${sizeClass}
            z-[var(--z-modal)]
            bg-[var(--color-surface)]
            shadow-[var(--shadow-xl)]
            overflow-hidden
            focus:outline-none
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:${sideConfig.animation.close}
            data-[state=open]:${sideConfig.animation.open}
            duration-300
            ${className}
          `.trim().replace(/\s+/g, ' ')}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    );
  }
);

DrawerContent.displayName = 'DrawerContent';

interface DrawerHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DrawerHeader({ children, className = '' }: DrawerHeaderProps) {
  return (
    <div
      className={`
        flex items-center justify-between
        px-4 py-4
        border-b border-[var(--color-neutral-200)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  );
}

interface DrawerTitleProps {
  children: ReactNode;
  className?: string;
}

export function DrawerTitle({ children, className = '' }: DrawerTitleProps) {
  return (
    <Dialog.Title
      className={`
        text-lg font-semibold text-[var(--color-text)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </Dialog.Title>
  );
}

interface DrawerBodyProps {
  children: ReactNode;
  className?: string;
}

export function DrawerBody({ children, className = '' }: DrawerBodyProps) {
  return (
    <div
      className={`
        flex-1
        overflow-y-auto
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  );
}

interface DrawerFooterProps {
  children: ReactNode;
  className?: string;
}

export function DrawerFooter({ children, className = '' }: DrawerFooterProps) {
  return (
    <div
      className={`
        flex items-center justify-end gap-3
        px-4 py-4
        border-t border-[var(--color-neutral-200)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  );
}

interface DrawerCloseProps {
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
}

export function DrawerClose({ children, className = '', asChild }: DrawerCloseProps) {
  if (children) {
    return (
      <Dialog.Close asChild={asChild} className={className}>
        {children}
      </Dialog.Close>
    );
  }

  // Default close button (X icon) - larger touch target for mobile
  return (
    <Dialog.Close
      className={`
        p-2
        min-w-[44px] min-h-[44px]
        flex items-center justify-center
        text-[var(--color-text-muted)]
        hover:text-[var(--color-text)]
        hover:bg-[var(--color-neutral-100)]
        rounded-[var(--radius-md)]
        transition-colors duration-[var(--duration-fast)]
        focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      aria-label="Close"
    >
      <X className="w-5 h-5" />
    </Dialog.Close>
  );
}

export default Drawer;
