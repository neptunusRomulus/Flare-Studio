import React, { useCallback, useEffect, useRef, useState } from 'react';
import TilesetPanel from '@/components/TilesetPanel';
import { clampPanelWidth, PALETTE_PANEL_DEFAULT, PALETTE_PANEL_KEY } from '@/components/paletteLayout';

type Props = React.ComponentProps<typeof TilesetPanel>;

function readWidth(): number {
  try {
    const v = Number(localStorage.getItem(PALETTE_PANEL_KEY));
    return clampPanelWidth(v > 0 ? v : PALETTE_PANEL_DEFAULT, window.innerWidth);
  } catch {
    return PALETTE_PANEL_DEFAULT;
  }
}

/** Right-side dock holding the tileset palette + brush toolbar on drawing layers. */
const PaletteDock: React.FC<Props> = (props) => {
  const [width, setWidth] = useState<number>(readWidth);
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
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidth(clampPanelWidth(drag.current.startW + (drag.current.startX - e.clientX), window.innerWidth));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setWidth(w => {
      try { localStorage.setItem(PALETTE_PANEL_KEY, String(w)); } catch { /* ignore */ }
      return w;
    });
  }, []);

  return (
    <aside
      className="relative h-full min-h-0 flex-shrink-0 border-l border-border bg-muted/30 flex flex-col"
      style={{ width }}
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
        <TilesetPanel {...props} fitToWidth />
      </div>
    </aside>
  );
};

export default PaletteDock;
