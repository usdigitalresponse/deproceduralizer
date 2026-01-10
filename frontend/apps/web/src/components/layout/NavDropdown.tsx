'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, type LucideIcon } from 'lucide-react';

interface NavDropdownProps {
  label: string;
  icon: LucideIcon;
  items: {
    key: string;
    label: string;
    href: string;
    isActive: boolean;
    icon?: LucideIcon;
  }[];
}

export function NavDropdown({ label, icon: Icon, items }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const anyActive = items.some(item => item.isActive);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)]
          transition-colors duration-[var(--duration-fast)]
          ${anyActive
            ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)]'
          }
        `}
        aria-expanded={isOpen}
      >
        <Icon className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] shadow-lg py-1 z-50">
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm transition-colors
                  ${item.isActive
                    ? 'bg-[var(--color-primary-faint)] text-[var(--color-primary)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-text)]'
                  }
                `}
              >
                {ItemIcon && <ItemIcon className="w-4 h-4 opacity-70" />}
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
