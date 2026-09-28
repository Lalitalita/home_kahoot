// The site's mark: a ringed badge (cyan-to-magenta gradient) around a
// four-point sparkle. Used anywhere the brand needs to show up as itself
// rather than as the generic 🎂 emoji — nav bars, loading screens, the
// party join/screen headers.
export function LogoMark({ size = 28, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logoRing" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#39e3e3" />
          <stop offset="1" stopColor="#bb39e3" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="17.5" fill="#181818" stroke="url(#logoRing)" strokeWidth="2.5" />
      <path
        d="M20 9 L22.6 17.4 L31 20 L22.6 22.6 L20 31 L17.4 22.6 L9 20 L17.4 17.4 Z"
        fill="url(#logoRing)"
      />
    </svg>
  );
}

export default function Logo({ size = 28, wordmark = true, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {wordmark && (
        <span className="font-display font-bold text-ink-50 tracking-tight" style={{ fontSize: size * 0.5 }}>
          Kahoot Anniv Lana
        </span>
      )}
    </span>
  );
}
