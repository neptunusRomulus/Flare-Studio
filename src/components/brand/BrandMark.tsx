import React from 'react';

/** Brand colours of the Flare Studio mark (flat, matte). */
export const BRAND_CHARCOAL = '#3A3A3A';
export const BRAND_EMBER = '#E8602C';
/** Flame of the small-size mark; must match assets/brand/flare-studio-icon-small.svg. */
export const BRAND_FLAME_SMALL_D = 'M256 466 C 232 436, 138 384, 136 290 C 134 208, 198 150, 240 98 C 250 86, 258 68, 262 44 C 296 100, 316 152, 314 210 C 334 196, 350 176, 360 146 C 388 190, 392 246, 382 294 C 366 376, 306 430, 256 466 Z';

/** The Flare Studio mark as inline SVG so parts of it (the flame) can animate. */
const BrandMark: React.FC<{ className?: string; flameClassName?: string }> = ({ className, flameClassName }) => (
  <svg viewBox="0 0 512 512" className={`brand-mark ${className ?? ''}`} aria-hidden="true" focusable="false">
    <rect className="brand-mark-bg" width="512" height="512" rx="96" fill={BRAND_CHARCOAL} />
    <path
      d={BRAND_FLAME_SMALL_D}
      fill={BRAND_EMBER}
      className={`brand-mark-flame ${flameClassName ?? ''}`}
      style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
    />
  </svg>
);

export default BrandMark;
