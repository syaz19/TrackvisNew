export default function TrackvisLogo() {
  return (
    <svg viewBox="0 0 64 72" width="100%" height="100%" role="img" aria-label="TrackVis logo">
      <defs>
        <linearGradient id="trackvis-coral" x1="12" y1="8" x2="52" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#fda4af" />
        </linearGradient>
        <linearGradient id="trackvis-teal" x1="19" y1="20" x2="46" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <path
        d="M32 3C19.3 3 9 13.2 9 25.8c0 16.2 15.1 27.5 21 40.2.8 1.7 3.2 1.7 4 0 5.9-12.7 21-24 21-40.2C55 13.2 44.7 3 32 3Z"
        fill="url(#trackvis-coral)"
      />
      <circle cx="32" cy="26" r="13" fill="#11152b" opacity="0.96" />
      <circle cx="32" cy="26" r="5" fill="url(#trackvis-teal)" />
      <path d="M18 26a14 14 0 0 1 28 0M22 18a14 14 0 0 1 20 0" fill="none" stroke="#5eead4" strokeLinecap="round" strokeWidth="2.5" opacity="0.9" />
      <path d="M32 47c6 0 11 2.6 14.5 6.8M32 47c-6 0-11 2.6-14.5 6.8" fill="none" stroke="#11152b" strokeLinecap="round" strokeWidth="2.5" opacity="0.9" />
    </svg>
  );
}
