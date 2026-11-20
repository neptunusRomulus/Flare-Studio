import React, { useCallback, useEffect, useRef, useState } from 'react';
import WindowControls from '@/components/WindowControls';

type Props = {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
};

/** Top edge strip (px) that reveals the window controls. */
export const WINDOW_BAR_HOT_ZONE = 6;
/** Delay before the bar slides back up once the pointer left both the strip and the bar. */
export const WINDOW_BAR_HIDE_MS = 600;
/** Height of the reveal strip (`h-9`); floating chrome shifts down by this while the bar is open. */
export const WINDOW_BAR_HEIGHT_PX = 36;
/** CSS variable on :root that moves logo, map tabs, Play/zoom and the palette card top edge. */
export const WINDOW_BAR_OFFSET_VAR = '--window-controls-offset';

function setWindowBarOffset(shown: boolean) {
  document.documentElement.style.setProperty(
    WINDOW_BAR_OFFSET_VAR,
    shown ? `${WINDOW_BAR_HEIGHT_PX}px` : '0px',
  );
}

/**
 * Zen mode window chrome: minimize / maximize / close live in a compact floating pill
 * at the top-right. The rest of the slim top strip is an invisible drag region for
 * moving the window. The strip is detected from window mousemove events, not a DOM hit
 * area, so it never eats clicks while hidden. While it is visible, floating canvas
 * chrome shifts down via `--window-controls-offset` so nothing is covered.
 */
const WindowControlBar: React.FC<Props> = ({ onMinimize, onMaximize, onClose }) => {
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);

  const applyShown = useCallback((next: boolean) => {
    if (shownRef.current === next) return;
    shownRef.current = next;
    setWindowBarOffset(next);
    setShown(next);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current !== null) return;
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      applyShown(false);
    }, WINDOW_BAR_HIDE_MS);
  }, [applyShown]);

  useEffect(() => {
    const pointerOverBar = (event: MouseEvent) => {
      if (!shownRef.current) return false;
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };
    const onMove = (event: MouseEvent) => {
      if (event.clientY <= WINDOW_BAR_HOT_ZONE || pointerOverBar(event)) {
        cancelHide();
        applyShown(true);
        return;
      }
      scheduleHide();
    };
    const onLeave = () => scheduleHide();
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelHide();
      document.documentElement.style.removeProperty(WINDOW_BAR_OFFSET_VAR);
    };
  }, [applyShown, cancelHide, scheduleHide]);

  // Hidden bar keeps its slide-out, so keep it out of the tab order and the a11y tree.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    if (shown) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [shown]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0" aria-hidden={!shown}>
      <div
        ref={barRef}
        data-testid="window-control-bar"
        data-state={shown ? 'open' : 'closed'}
        className={`drag-region absolute inset-x-0 top-0 flex h-9 select-none items-center justify-end px-2 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
          shown ? 'pointer-events-auto translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div
          data-testid="window-control-pill"
          className="no-drag flex items-center rounded-full border border-border bg-white/90 px-1 shadow-lg dark:bg-neutral-900/90"
        >
          <WindowControls onMinimize={onMinimize} onMaximize={onMaximize} onClose={onClose} />
        </div>
      </div>
    </div>
  );
};

export default WindowControlBar;
