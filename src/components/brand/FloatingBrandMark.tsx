import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import BrandMark, { BRAND_MARK_INSET_CLASS, BRAND_MARK_RADIUS_CLASS, BRAND_MARK_SIZE_CLASS } from '@/components/brand/BrandMark';

type Props = {
  /** Tooltip text; the mark itself is a badge, not a button, when there is no menu yet. */
  label?: string;
};

/**
 * Rounded-square Flare Studio mark floating in the top-left corner. The editor puts the logo menu there;
 * the welcome screen has no menu yet, so it shows the same mark without a click target or circular chrome.
 * Sized at 28px with an 8px inset from the top and left so it is not flush with the window edge.
 */
const FloatingBrandMark: React.FC<Props> = ({ label = 'Flare Studio' }) => (
  <div className={`floats-below-window-bar pointer-events-none absolute ${BRAND_MARK_INSET_CLASS} z-10`}>
    <Tooltip content={label} side="bottom">
      <div aria-hidden="true" className={`pointer-events-auto ${BRAND_MARK_SIZE_CLASS} ${BRAND_MARK_RADIUS_CLASS}`}>
        <BrandMark className={`${BRAND_MARK_SIZE_CLASS} ${BRAND_MARK_RADIUS_CLASS}`} />
      </div>
    </Tooltip>
  </div>
);

export default FloatingBrandMark;
