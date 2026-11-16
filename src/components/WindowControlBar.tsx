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

/**
 * Zen mode window bar: the top bar is gone, so minimize / maximize / close live in a slim
 * bar that only slides down when the pointer touches the very top edge of the window.
 * The strip never eats clicks: it is detected from window mousemove events, not a DOM hit area.
 */
const WindowControlBar: React.FC<Props> = ({ onMinimize, onMaximize, onClose }) => {
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);

  const applyShown = useCallback((next: boolean) => {
    if (shownRef.current === next) return;
    shownRef.current = next;
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
        className={`drag-region absolute inset-x-0 top-0 flex h-9 select-none items-center justify-end gap-0.5 border-b border-border bg-white/90 px-1.5 shadow-sm backdrop-blur-sm transition-[transform,opacity] duration-200 ease-out dark:bg-neutral-900/90 ${
          shown ? 'pointer-events-auto translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <WindowControls onMinimize={onMinimize} onMaximize={onMaximize} onClose={onClose} />
      </div>
    </div>
  );
};

export default WindowControlBar;
