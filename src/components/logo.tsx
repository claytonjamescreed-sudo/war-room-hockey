// The WG Hockey Pool mark: a skate in full stride across a red ring, speed stripes trailing. Our
// own drawing, in the site's black, gold and red. public/logo.svg is the same artwork on a black
// tile (the browser tab icon); the home-screen icons are made from it.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <circle cx="100" cy="100" r="80" fill="none" stroke="#C8102E" strokeWidth="10" />
      <g transform="rotate(14 100 100) translate(-8 -8)">
        <rect x="22" y="50" width="76" height="6" fill="#FFE066" />
        <rect x="10" y="60" width="88" height="6" fill="#FFD23F" />
        <rect x="4" y="70" width="94" height="6" fill="#FFB81C" />
        <rect x="8" y="80" width="90" height="6" fill="#F9A01B" />
        <rect x="16" y="90" width="82" height="6" fill="#F7941D" />
        <rect x="28" y="100" width="70" height="6" fill="#F26A1B" />
        <rect x="42" y="110" width="56" height="6" fill="#E03A1E" />
        <rect x="58" y="120" width="40" height="6" fill="#C8102E" />
        <rect x="30" y="134" width="54" height="4" fill="#F4EFE6" />
        <path
          d="M98 46 L128 46 L131 84 L160 97 Q172 102 172 114 L172 124 L94 124 L94 52 Q94 46 98 46 Z"
          fill="#FFB81C"
        />
        <path d="M94 54 L129 54 L130 65 L94 65 Z" fill="#C8102E" />
        <g
          transform="translate(101,90) scale(0.36)"
          fill="none"
          stroke="#15130F"
          strokeWidth="14"
          strokeLinejoin="miter"
        >
          <polyline points="0,0 9,68 22,20 35,68 44,0" />
          <path d="M92 12 A30 30 0 1 0 92 56 L92 36 L76 36" />
        </g>
        <rect x="104" y="124" width="9" height="9" fill="#F4EFE6" />
        <rect x="154" y="124" width="9" height="9" fill="#F4EFE6" />
        <rect x="88" y="133" width="94" height="8" rx="4" fill="#F4EFE6" />
      </g>
    </svg>
  );
}
