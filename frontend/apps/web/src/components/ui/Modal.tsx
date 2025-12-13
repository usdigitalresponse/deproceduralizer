'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ReactNode, forwardRef } from 'react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Modal({ open, onOpenChange, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

interface ModalTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export function ModalTrigger({ children, asChild }: ModalTriggerProps) {
  return (
    <Dialog.Trigger asChild={asChild}>
      {children}
    </Dialog.Trigger>
  );
}

interface ModalContentProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
};

export const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(
  ({ children, className = '', size = 'lg' }, ref) => {
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
          "
        />
        <Dialog.Content
          ref={ref}
          className={`
            fixed
            left-1/2 top-1/2
            z-[var(--z-modal)]
            w-full ${sizeStyles[size]}
            max-h-[85vh]
            -translate-x-1/2 -translate-y-1/2
            bg-[var(--color-surface)]
            rounded-[var(--radius-xl)]
            shadow-[var(--shadow-xl)]
            overflow-hidden
            focus:outline-none
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0
            data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:zoom-in-95
            data-[state=closed]:slide-out-to-left-1/2
            data-[state=closed]:slide-out-to-top-[48%]
            data-[state=open]:slide-in-from-left-1/2
            data-[state=open]:slide-in-from-top-[48%]
            ${className}
          `.trim().replace(/\s+/g, ' ')}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    );
  }
);

ModalContent.displayName = 'ModalContent';

interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

export function ModalHeader({ children, className = '' }: ModalHeaderProps) {
  return (
    <div
      className={`
        flex items-center justify-between
        px-6 py-4
        border-b border-[var(--color-neutral-200)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  );
}

interface ModalTitleProps {
  children: ReactNode;
  className?: string;
}

export function ModalTitle({ children, className = '' }: ModalTitleProps) {
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

interface ModalDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function ModalDescription({ children, className = '' }: ModalDescriptionProps) {
  return (
    <Dialog.Description
      className={`
        text-sm text-[var(--color-text-muted)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </Dialog.Description>
  );
}

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div
      className={`
        px-6 py-4
        overflow-y-auto
        max-h-[calc(85vh-8rem)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div
      className={`
        flex items-center justify-end gap-3
        px-6 py-4
        border-t border-[var(--color-neutral-200)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  );
}

interface ModalCloseProps {
  children?: ReactNode;
  className?: string;
  asChild?: boolean;
}

export function ModalClose({ children, className = '', asChild }: ModalCloseProps) {
  if (children) {
    return (
      <Dialog.Close asChild={asChild} className={className}>
        {children}
      </Dialog.Close>
    );
  }

  // Default close button (X icon)
  return (
    <Dialog.Close
      className={`
        p-1
        text-[var(--color-text-muted)]
        hover:text-[var(--color-text)]
        hover:bg-[var(--color-neutral-100)]
        rounded-[var(--radius-sm)]
        transition-colors duration-[var(--duration-fast)]
        focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      aria-label="Close"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 4L4 12M4 4L12 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Dialog.Close>
  );
}

export default Modal;
