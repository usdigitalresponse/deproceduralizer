'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Share2, LogOut, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { Container } from './Container';
import { MobileNav } from './MobileNav';
import { getStateFromPathname } from '@/hooks';
import { Button } from '@/components/ui';
import {
  getStateNavItems,
  getGlobalNavItems,
  getNavHref,
  isNavActive,
  NAV_GROUPS,
} from '@/lib/constants/navigation';
import { NavDropdown } from './NavDropdown';
import { GlobalSearch } from './GlobalSearch';
import { ShareLinkModal } from '@/components/auth/ShareLinkModal';
import { generateShareToken } from '@/lib/actions/auth';

interface HeaderProps {
  className?: string;
}

export function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();
  const currentState = getStateFromPathname(pathname);
  const stateNavItems = getStateNavItems();
  const globalNavItems = getGlobalNavItems();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authStatus === 'true');
  }, []);

  const handleGenerateShareLink = async () => {
    setIsGenerating(true);
    try {
      const result = await generateShareToken();

      if (result.success && result.token) {
        const url = `${window.location.origin}/auth?token=${result.token}`;
        setShareUrl(url);
        setIsShareModalOpen(true);
        toast.success('Share link generated! Copy and send to grant one-time access.');
      } else {
        toast.error(result.error || 'Failed to generate share link');
      }
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error('An error occurred while generating the share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    toast.success('Logged out successfully.');
    window.location.reload();
  };

  return (
    <>
      <header className={`sticky top-0 z-[var(--z-sticky)] ${className}`} data-print-hide>
        {/* Official bar */}
        <div className="bg-[var(--color-primary)] text-white">
          <Container size="2xl">
            <div className="flex items-center h-8 text-xs">
              <span className="font-medium">
                Regulatory analysis and review tool
              </span>
            </div>
          </Container>
        </div>

        {/* Main header - White background */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-neutral-200)]">
          <Container size="2xl">
            <div className="flex items-center justify-between h-14">
              {/* Logo / Title */}
              <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                {/* Icon */}
                <div className="flex items-center justify-center w-8 h-8 bg-[var(--color-primary)] rounded-[var(--radius-sm)]">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-[var(--color-text)] leading-tight">
                    Deproceduralizer
                  </h1>
                </div>
              </Link>

              {/* Desktop Navigation - hidden on mobile */}
              <nav className="hidden md:flex items-center gap-0.5">
                {/* Explorer Group */}
                <NavDropdown
                  label={NAV_GROUPS.explorer.label}
                  icon={NAV_GROUPS.explorer.icon}
                  items={stateNavItems
                    .filter(item => item.groupId === 'explorer')
                    .map(item => ({
                      key: item.key,
                      label: item.label,
                      href: getNavHref(item, currentState),
                      isActive: isNavActive(item, pathname, currentState),
                      icon: item.icon,
                    }))
                  }
                />

                {/* Metrics Group */}
                <NavDropdown
                  label={NAV_GROUPS.metrics.label}
                  icon={NAV_GROUPS.metrics.icon}
                  items={stateNavItems
                    .filter(item => item.groupId === 'metrics')
                    .map(item => ({
                      key: item.key,
                      label: item.label,
                      href: getNavHref(item, currentState),
                      isActive: isNavActive(item, pathname, currentState),
                      icon: item.icon,
                    }))
                  }
                />

                {/* Highlighted standalone links (Pipeline) */}
                {stateNavItems
                  .filter(item => item.isHighlighted)
                  .map((item) => {
                    const href = getNavHref(item, currentState);
                    const isActive = isNavActive(item, pathname, currentState);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.key}
                        href={href}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold
                          rounded-full border transition-colors duration-[var(--duration-fast)]
                          ${isActive
                            ? 'bg-[var(--color-primary)] !text-white border-[var(--color-primary)]'
                            : 'bg-[var(--color-primary-mid)] !text-white border-[var(--color-primary-mid)] hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)]'
                          }
                        `}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {item.label}
                      </Link>
                    );
                  })
                }

                {/* Review Mode - Direct Link (icon-only below xl) */}
                {stateNavItems
                  .filter(item => item.groupId === 'review')
                  .map((item) => {
                    const href = getNavHref(item, currentState);
                    const isActive = isNavActive(item, pathname, currentState);
                    const ItemIcon = item.icon;

                    return (
                      <Link
                        key={item.key}
                        href={href}
                        title={item.label}
                        className={`
                          flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)]
                          transition-colors duration-[var(--duration-fast)]
                          ${isActive
                            ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)]'
                          }
                        `}
                      >
                        <ItemIcon className="w-4 h-4" />
                        <span className="hidden xl:inline">{item.label}</span>
                      </Link>
                    );
                  })
                }

                {/* Divider */}
                {globalNavItems.length > 0 && (
                  <div className="w-px h-5 bg-[var(--color-neutral-200)] mx-1" />
                )}

                {/* Global nav items (Prompts, etc.) - icon-only below xl */}
                {globalNavItems.map((item) => {
                  const href = getNavHref(item, currentState);
                  const isActive = isNavActive(item, pathname, currentState);
                  const ItemIcon = item.icon;

                  return (
                    <Link
                      key={item.key}
                      href={href}
                      title={item.label}
                      className={`
                        flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)]
                        transition-colors duration-[var(--duration-fast)]
                        ${isActive
                          ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)]'
                        }
                      `}
                    >
                      <ItemIcon className="w-4 h-4" />
                      <span className="hidden xl:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Global Search and Auth Actions - hidden on mobile */}
              <div className="hidden md:flex items-center gap-1.5">
                <GlobalSearch />

                {/* Auth Actions - Only show when authenticated */}
                {isAuthenticated && (
                  <>
                    {/* Share Link Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateShareLink}
                      disabled={isGenerating}
                      className="flex items-center gap-2"
                      title="Generate a shareable link for someone to access the site without needing the password. Each link works only once."
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden xl:inline">Share</span>
                    </Button>

                    {/* Logout Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="flex items-center gap-2"
                      title="Log out of the site"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden xl:inline">Logout</span>
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile Menu Button - visible on mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileNavOpen(true)}
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </div>
          </Container>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Share Link Modal */}
      <ShareLinkModal
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        shareUrl={shareUrl}
      />
    </>
  );
}

export default Header;
