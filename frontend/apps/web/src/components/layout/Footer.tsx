'use client';

import { Container } from './Container';

interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`
        bg-[var(--color-primary-stronger)] text-white
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      data-print-hide
    >
      <Container size="2xl">
        <div className="py-8">
          {/* Main footer content */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left side - Branding */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-[var(--radius-sm)]">
                  <svg
                    className="w-4 h-4 text-white"
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
                <span className="font-semibold">Deproceduralizer</span>
              </div>
              <p className="text-sm text-white/70 max-w-md">
                A tool for identifying and reviewing regulatory compliance issues
                and procedural complexity in government regulations.
              </p>
            </div>

            {/* Right side - Links */}
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <h3 className="font-medium mb-2 text-white/90">Resources</h3>
                <ul className="space-y-1 text-white/70">
                  <li>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium mb-2 text-white/90">Legal</h3>
                <ul className="space-y-1 text-white/70">
                  <li>
                    <a
                      href="#"
                      className="hover:text-white transition-colors"
                    >
                      Accessibility
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-white transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-white/60">
              <p>&copy; {currentYear} Deproceduralizer</p>
              <p>
                Built with support from{' '}
                <a
                  href="https://www.recodingamerica.fund"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white underline"
                >
                  Recoding America Fund
                </a>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
