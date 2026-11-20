import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import BrandMark from '@/components/brand/BrandMark';

type Props = {
  /** Tooltip text; the mark itself is a badge, not a button, when there is no menu yet. */
  label?: string;
};

/**
 * Round Flare Studio mark floating in the top-left corner. The editor puts the logo menu there;
 * the welcome screen has no menu yet, so it shows the same badge without a click target.
 */
const FloatingBrandMark: React.FC<Props> = ({ label = 'Flare Studio' }) => (
  <div className="floats-below-window-bar pointer-events-none absolute left-2 top-2 z-10">
    <Tooltip content={label} side="bottom">
      <div
        aria-hidden="true"
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/90 shadow-lg dark:bg-neutral-900/90"
      >
        <BrandMark className="h-5 w-5" />
      </div>
    </Tooltip>
  </div>
);

export default FloatingBrandMark;
