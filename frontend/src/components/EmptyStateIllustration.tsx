/**
 * Playful empty-state illustration for History – scale + progress vibe.
 * Uses CSS vars for accent so it respects theme.
 */
export default function EmptyStateIllustration() {
  return (
    <svg
      className="empty-state__illustration"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Soft background circle */}
      <circle cx="80" cy="60" r="52" fill="var(--accent-subtle)" />
      {/* Scale base */}
      <ellipse cx="80" cy="88" rx="38" ry="8" fill="var(--border)" opacity="0.6" />
      <path
        d="M52 88 L80 52 L108 88 Z"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="var(--accent-soft)"
      />
      {/* Left pan */}
      <circle cx="58" cy="78" r="14" stroke="var(--accent)" strokeWidth="2.5" fill="var(--surface)" />
      <circle cx="58" cy="78" r="8" fill="var(--accent)" opacity="0.4" />
      {/* Right pan */}
      <circle cx="102" cy="78" r="14" stroke="var(--accent)" strokeWidth="2.5" fill="var(--surface)" />
      <circle cx="102" cy="78" r="8" fill="var(--accent)" opacity="0.4" />
      {/* Center pole */}
      <line x1="80" y1="52" x2="80" y2="88" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Small "trend up" spark */}
      <path
        d="M78 38 L80 32 L82 38 L86 34 L84 40 L90 40 L85 44 L87 50 L82 46 L80 52 L78 46 L73 50 L75 44 L70 40 L76 40 L74 34 L78 38 Z"
        fill="var(--accent-secondary)"
        opacity="0.9"
      />
    </svg>
  );
}
