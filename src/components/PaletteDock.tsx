import React, { useCallback, useEffect, useState } from 'react';
import TilesetPanel from '@/components/TilesetPanel';
import PaletteRail from '@/components/PaletteRail';
import PaletteCard from '@/components/PaletteCard';
import { clampPanelWidth, PALETTE_PANEL_DEFAULT, PALETTE_PANEL_KEY, SIDEBAR_RAIL_WIDTH } from '@/components/paletteLayout';
import { useSidebarTabHotkeys } from '@/hooks/useSidebarTabHotkeys';
import type { TileLayer } from '@/types';

type Overlay = React.ReactNode;
type Children = React.ReactNode | ((overlay: Overlay) => React.ReactNode);

type Props = React.ComponentProps<typeof TilesetPanel> & {
  open: boolean;
  content?: React.ReactNode;
  footer?: React.ReactNode;
  children?: Children;
};

export const DOCK_ANIM_MS = 220;

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

/**
 * Hybrid right sidebar: a thin always-visible icon rail, plus a floating list card
 * over the canvas (opened by clicking a rail tab, closed by clicking the active tab again).
 */
const PaletteDock: React.FC<Props> = ({ open, content, footer, children, ...props }) => {
  const layers = (props.mapLayers ?? []) as TileLayer[];
  const activeLayer = props.activeLayer ?? null;
  const onSelectLayer = props.onSelectLayer ?? (() => {});
  const [width, setWidth] = useState<number>(readWidth);
  const [cardOpen, setCardOpen] = useState(true);
  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(open);

  useSidebarTabHotkeys(layers, activeLayer, onSelectLayer);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setCardOpen(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setRendered(false), prefersReducedMotion() ? 0 : DOCK_ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Escape closes the floating list, keeping the rail (and the canvas underneath) as is.
  useEffect(() => {
    if (!open || !cardOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (target?.closest('[role="dialog"],[role="alertdialog"]')) return;
      setCardOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, cardOpen]);

  useEffect(() => {
    const onResize = () => setWidth((w) => clampPanelWidth(w, window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onWidthChange = useCallback((next: number | ((current: number) => number)) => {
    setWidth((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      return clampPanelWidth(value, window.innerWidth);
    });
  }, []);

  const ms = prefersReducedMotion() ? 0 : DOCK_ANIM_MS;
  const overlay = rendered ? (
    <PaletteCard
      open={Boolean(shown && cardOpen)}
      width={width}
      onWidthChange={onWidthChange}
      footer={footer}
      animMs={ms}
      wide={activeLayer?.type === 'strings'}
    >
      {content === undefined ? <TilesetPanel {...props} fitToWidth /> : content}
    </PaletteCard>
  ) : null;

  return (
    <>
      {typeof children === 'function' ? children(overlay) : children}
      {rendered ? (
        <div
          className="h-full min-h-0 flex-shrink-0 overflow-hidden"
          style={{ width: shown ? SIDEBAR_RAIL_WIDTH : 0, transition: ms ? `width ${ms}ms cubic-bezier(0, 0, 0.2, 1)` : 'none' }}
          aria-hidden={!open}
        >
          <PaletteRail
            layers={layers}
            activeLayer={activeLayer}
            onSelectLayer={onSelectLayer}
            cardOpen={cardOpen && shown}
            onCardOpenChange={setCardOpen}
            visibility={props.layerVisibility}
            shown={shown}
            animMs={ms}
          />
        </div>
      ) : null}
    </>
  );
};

export default PaletteDock;
