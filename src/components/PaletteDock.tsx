import React, { useCallback, useEffect, useRef, useState } from 'react';
import TilesetPanel from '@/components/TilesetPanel';
import { clampPanelWidth, PALETTE_PANEL_DEFAULT, PALETTE_PANEL_KEY } from '@/components/paletteLayout';

type Props = React.ComponentProps<typeof TilesetPanel> & { open: boolean; content?: React.ReactNode };

export const DOCK_ANIM_MS = 200; // matches left sidebar (duration-200)

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function readWidth(): number {
  try {
    const v = Number(localStorage.getItem(PALETTE_PANEL_KEY));
    return clampPanelWidth(v > 0 ? v : PALETTE_PANEL_DEFAULT, window.innerWidth);
  } catch {
    return PALETTE_PANEL_DEFAULT;
  }
}

/** Right-side dock holding the tileset palette + brush toolbar on drawing layers. */
const PaletteDock: React.FC<Props> = ({ open, content, ...props }) => {
  const [width, setWidth] = useState<number>(readWidth);
  // Initial mount: no animation (also avoids a slide behind the loading overlay)
  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(open);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (open) {
      setRendered(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setRendered(false), prefersReducedMotion() ? 0 : DOCK_ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onResize = () => setWidth(w => clampPanelWidth(w, window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startW: width };
    setDragging(true);
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidth(clampPanelWidth(drag.current.startW + (drag.current.startX - e.clientX), window.innerWidth));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setWidth(w => {
      try { localStorage.setItem(PALETTE_PANEL_KEY, String(w)); } catch { /* ignore */ }
      return w;
    });
  }, []);

  if (!rendered) return null;
  const ms = dragging || prefersReducedMotion() ? 0 : DOCK_ANIM_MS;
  const ease = shown ? 'cubic-bezier(0, 0, 0.2, 1)' : 'cubic-bezier(0.4, 0, 1, 1)';
  return (
    <div
      className="h-full min-h-0 flex-shrink-0 overflow-hidden"
      style={{ width: shown ? width : 0, transition: ms ? `width ${ms}ms ${ease}` : 'none' }}
      aria-hidden={!open}
    >
    <aside
      className="relative h-full min-h-0 border-l border-border bg-muted/30 flex flex-col"
      style={{
        width,
        transform: shown ? 'translateX(0)' : 'translateX(24px)',
        opacity: shown ? 1 : 0,
        transition: ms ? `transform ${ms}ms ${ease}, opacity ${ms}ms ${ease}` : 'none',
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize palette"
        className="absolute top-0 left-0 h-full w-2 -ml-1 z-10 cursor-col-resize touch-none hover:bg-border/40"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="flex flex-col flex-1 min-h-0 p-2">
        {content ?? <TilesetPanel {...props} fitToWidth />}
      </div>
    </aside>
    </div>
  );
};

export default PaletteDock;
