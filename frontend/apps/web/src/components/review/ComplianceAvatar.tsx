interface ComplianceAvatarProps {
  size?: number;
  className?: string;
}

/**
 * Stylized avatar for the Compliance Issues feature — a clipboard
 * with checklist items and a magnifying glass accent.
 */
export function ComplianceAvatar({ size = 40, className = '' }: ComplianceAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Compliance issues avatar"
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="58" fill="#FEF3E2" stroke="#F5C882" strokeWidth="2" />

      {/* Clipboard body */}
      <rect x="32" y="28" width="48" height="64" rx="5" fill="white" stroke="#D4915A" strokeWidth="2.5" />

      {/* Clipboard clip */}
      <rect x="46" y="22" width="20" height="12" rx="3" fill="#E8A44E" stroke="#D4915A" strokeWidth="2" />
      <rect x="52" y="26" width="8" height="4" rx="2" fill="#FEF3E2" />

      {/* Checklist lines */}
      {/* Row 1 - checked */}
      <rect x="40" y="42" width="8" height="8" rx="2" stroke="#D4915A" strokeWidth="1.5" fill="#FFF7ED" />
      <path d="M42 46l2 2 4-4" stroke="#E8A44E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="52" y="44" width="20" height="3" rx="1.5" fill="#E0D4C8" />

      {/* Row 2 - warning */}
      <rect x="40" y="56" width="8" height="8" rx="2" stroke="#D4915A" strokeWidth="1.5" fill="#FFF7ED" />
      <path d="M44 58l-0.5 4h1l-0.5-4z" fill="#E8A44E" />
      <circle cx="44" cy="62.5" r="0.8" fill="#E8A44E" />
      <rect x="52" y="58" width="20" height="3" rx="1.5" fill="#E0D4C8" />

      {/* Row 3 - unchecked */}
      <rect x="40" y="70" width="8" height="8" rx="2" stroke="#D4915A" strokeWidth="1.5" fill="#FFF7ED" />
      <rect x="52" y="72" width="16" height="3" rx="1.5" fill="#E0D4C8" />

      {/* Magnifying glass */}
      <g transform="translate(68, 68)">
        <circle cx="12" cy="12" r="11" fill="white" stroke="#D4915A" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="7" stroke="#E8A44E" strokeWidth="1.5" fill="none" />
        <line x1="20" y1="20" x2="28" y2="28" stroke="#D4915A" strokeWidth="3" strokeLinecap="round" />
        {/* Glint */}
        <path d="M8 9c1-1.5 3-2.5 5-2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      </g>

      {/* Sparkle accents */}
      <g className="animate-pulse">
        <path d="M18 18l1.5 4 1.5-4 1.5 4-1.5-4" stroke="#E8A44E" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="19.5" cy="18" r="1.2" fill="#E8A44E" />
      </g>
      <g className="animate-pulse" style={{ animationDelay: '0.7s' }}>
        <path d="M100 40l1.5 4 1.5-4 1.5 4-1.5-4" stroke="#D4915A" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="101.5" cy="40" r="1.2" fill="#D4915A" />
      </g>
    </svg>
  );
}

export default ComplianceAvatar;
