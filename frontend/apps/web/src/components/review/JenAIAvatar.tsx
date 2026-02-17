interface JenAIAvatarProps {
  size?: number;
  className?: string;
}

/**
 * Stylized avatar for the JenAI feature — a friendly face with
 * wavy auburn hair, statement glasses, and AI sparkles.
 */
export function JenAIAvatar({ size = 40, className = '' }: JenAIAvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Jen AI avatar"
    >
      {/* Background circle */}
      <circle cx="60" cy="60" r="58" fill="#E8F4FD" stroke="#B8D8E8" strokeWidth="2" />

      {/* Hair - wavy auburn */}
      <path
        d="M30 58c0-18 12-32 30-32s30 14 30 32c0 2-0.5 4-1 6 2-3 3-8 3-12 0-20-14-34-32-34S28 32 28 52c0 4 1 9 3 12-0.5-2-1-4-1-6z"
        fill="#9B6B4A"
      />
      {/* Hair volume and wave */}
      <path
        d="M28 52c0-18 14-32 32-32s32 14 32 32c0 3-0.3 5.5-1 8"
        stroke="#7D5438"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left wave */}
      <path
        d="M30 55c-2 8-3 14-2 20 0.5 3 1.5 5 3 6"
        stroke="#9B6B4A"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Right wave */}
      <path
        d="M90 55c2 8 3 14 2 20-0.5 3-1.5 5-3 6"
        stroke="#9B6B4A"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Wavy hair detail left */}
      <path
        d="M32 48c-1 5-2 12-1 18s3 10 5 12"
        stroke="#B07D5A"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Wavy hair detail right */}
      <path
        d="M88 48c1 5 2 12 1 18s-3 10-5 12"
        stroke="#B07D5A"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Face */}
      <ellipse cx="60" cy="65" rx="24" ry="28" fill="#F5DCC3" />

      {/* Ears */}
      <ellipse cx="36" cy="62" rx="4" ry="5" fill="#EECFB0" />
      <ellipse cx="84" cy="62" rx="4" ry="5" fill="#EECFB0" />

      {/* Hair bangs overlay */}
      <path
        d="M38 42c4-6 12-10 22-10s18 4 22 10c-2-2-6-4-10-4-3 0-6 1-8 3-1-1-3-2-5-2s-4 1-5 2c-2-2-5-3-8-3-4 0-8 2-8 4z"
        fill="#9B6B4A"
      />

      {/* Eyes */}
      <ellipse cx="50" cy="60" rx="3" ry="3.5" fill="#4A6B7A" />
      <ellipse cx="70" cy="60" rx="3" ry="3.5" fill="#4A6B7A" />
      {/* Eye highlights */}
      <circle cx="51.5" cy="59" r="1.2" fill="white" />
      <circle cx="71.5" cy="59" r="1.2" fill="white" />

      {/* Glasses */}
      <rect x="40" y="53" width="16" height="14" rx="4" stroke="#2C4A52" strokeWidth="2.5" fill="none" />
      <rect x="64" y="53" width="16" height="14" rx="4" stroke="#2C4A52" strokeWidth="2.5" fill="none" />
      {/* Bridge */}
      <path d="M56 59c2-2 6-2 8 0" stroke="#2C4A52" strokeWidth="2" fill="none" />
      {/* Temple arms */}
      <path d="M40 57l-5-1" stroke="#2C4A52" strokeWidth="2" strokeLinecap="round" />
      <path d="M80 57l5-1" stroke="#2C4A52" strokeWidth="2" strokeLinecap="round" />

      {/* Friendly smile */}
      <path
        d="M50 76c3 4 8 5 12 4 3-1 5-3 6-5"
        stroke="#C47A6A"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Nose */}
      <path
        d="M60 65v5c-1 1.5-2 2-3 2"
        stroke="#D4B89A"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Grey top hint */}
      <path
        d="M38 90c4 6 12 10 22 10s18-4 22-10"
        stroke="#B0B8BC"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />

      {/* AI sparkles */}
      <g className="animate-pulse">
        <path d="M98 20l2 5 2-5 2 5-2-5" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="100" cy="20" r="1.5" fill="#60A5FA" />
      </g>
      <g className="animate-pulse" style={{ animationDelay: '0.5s' }}>
        <path d="M15 30l1.5 4 1.5-4 1.5 4-1.5-4" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16.5" cy="30" r="1.5" fill="#818CF8" />
      </g>
      <g className="animate-pulse" style={{ animationDelay: '1s' }}>
        <path d="M105 75l1.5 4 1.5-4 1.5 4-1.5-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="106.5" cy="75" r="1.5" fill="#34D399" />
      </g>
    </svg>
  );
}

export default JenAIAvatar;
