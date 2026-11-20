import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { clampPanelWidth, PALETTE_CARD_BOTTOM, PALETTE_CARD_GAP, PALETTE_CARD_TOP, PALETTE_PANEL_KEY } from '@/components/paletteLayout';

type Props = {
  /** Closed cards stay mounted so the slide-out animates; they are inert and invisible. */
  open: boolean;
  width: number;
  onWidthChange: (width: number | ((current: number) => number)) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  animMs: number;
  /** Span most of the canvas (used by the Strings translation table). */
  wide?: boolean;
};

/** Floating list card over the canvas, anchored to the rail and inset clear of zoom / minimap. */
const PaletteCard: React.FC<Props> = ({ open, width, onWidthChange, children, footer, animMs, wide }) => {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // A closed card stays mounted for the slide-out, so keep it out of the tab order and the a11y tree.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (open) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [open]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startW: width };
    setDragging(true);
  }, [width]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onWidthChange(clampPanelWidth(drag.current.startW + (drag.current.startX - event.clientX), window.innerWidth));
  }, [onWidthChange]);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    onWidthChange((current) => {
      try { localStorage.setItem(PALETTE_PANEL_KEY, String(current)); } catch { /* ignore */ }
      return current;
    });
  }, [onWidthChange]);

  const ms = dragging ? 0 : animMs;

  return (
    <Card
      ref={cardRef}
      aria-label={wide ? "Sidebar panel" : "Sidebar list"}
      aria-hidden={!open}
      className="absolute z-[5] flex flex-col min-h-0 overflow-hidden rounded-xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm border border-border shadow-lg"
      style={{
        top: `calc(${PALETTE_CARD_TOP}px + var(--window-controls-offset, 0px))`,
        bottom: PALETTE_CARD_BOTTOM,
        right: PALETTE_CARD_GAP,
        left: wide ? 24 : undefined,
        width: wide ? undefined : width,
        opacity: open ? 1 : 0,
        transform: open ? 'translateX(0)' : 'translateX(16px)',
        pointerEvents: open ? undefined : 'none',
        transition: ms
          ? `opacity ${ms}ms cubic-bezier(0, 0, 0.2, 1), transform ${ms}ms cubic-bezier(0, 0, 0.2, 1), top ${ms}ms cubic-bezier(0, 0, 0.2, 1)`
          : 'none',
      }}
    >
      {wide ? null : (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar list"
        className="absolute top-0 left-0 h-full w-2 -ml-1 z-10 cursor-col-resize touch-none hover:bg-border/40"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      )}
      <div className="flex flex-col flex-1 min-h-0 p-2">
        {children}
        {footer}
      </div>
    </Card>
  );
};

export default PaletteCard;
