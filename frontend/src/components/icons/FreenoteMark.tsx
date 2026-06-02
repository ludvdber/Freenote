/**
 * Freenote brand mark — an open book with a rising constellation, in the violet→cyan gradient.
 * Inline SVG (not the raster logo.png) so it stays crisp at any size and blends on any background
 * without a dark tile. Same artwork as `public/favicon.svg`. Used in the Navbar lockup.
 */
export default function FreenoteMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Freenote"
      focusable="false"
    >
      <defs>
        <linearGradient id="freenoteMark" x1="6" y1="8" x2="58" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M19 13 L32 6 L45 12"
        fill="none"
        stroke="#cdd6ff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <circle cx="19" cy="13" r="2.2" fill="#bcd0ff" />
      <circle cx="32" cy="6" r="2.8" fill="#ffffff" />
      <circle cx="45" cy="12" r="2.2" fill="#8af0ff" />
      <path
        d="M32 20 C22 14 10 14 4 18 L4 48 C10 44 22 44 32 50 C42 44 54 44 60 48 L60 18 C54 14 42 14 32 20 Z"
        fill="url(#freenoteMark)"
      />
      <path d="M32 20 L32 50" stroke="#0a0a1a" strokeWidth="2.4" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
