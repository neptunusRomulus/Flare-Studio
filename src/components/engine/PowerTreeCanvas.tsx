import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { HintLabel } from '@/components/ui/field-hint';
import Tooltip from '@/components/ui/tooltip';
import { menuToTabPoint, type PowersMenuLayout, tabToMenuPosition } from '@/editor/menuLayout';
import { parsePosition, powersOnTab, type PowerTreeFile, type PowerTreeNode } from '@/editor/powerTree';
import { formatPowerLabel } from '@/editor/powerCatalog';
import { classifyWheel, pinchFactor } from '@/editor/wheelNav';
import {
  TREE_ZOOM_STEP,
  fitTreeView,
  centerTreeView,
  panTreeByScreen,
  treeZoomPercent,
  zoomTreeAt,
  type TreeView,
} from '@/editor/powerTreeView';

const ICON = 32;
const GRID = 16;

function fileStyle(url: string | null, extra: CSSProperties = {}): CSSProperties {
  if (!url) return extra;
  return { backgroundImage: `url("${url}")`, backgroundRepeat: 'no-repeat', ...extra };
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

export default function PowerTreeCanvas({
  tree,
  tabIndex,
  layout,
  menuArt,
  tabArt,
  names,
  selectedIndex,
  onSelect,
  onMove,
  iconSrcs,
}: {
  tree: PowerTreeFile;
  tabIndex: number;
  layout: PowersMenuLayout;
  menuArt: string | null;
  tabArt: string | null;
  names?: Record<string, string>;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onMove: (index: number, position: string) => void;
  iconSrcs?: Record<string, string>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<TreeView>({ zoom: 1, panX: 0, panY: 0 });
  const [snap, setSnap] = useState(true);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const hover = useRef(false);
  const space = useRef(false);
  const drag = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const fittedFor = useRef('');
  const { pos, tabArea } = layout;
  const powers = powersOnTab(tree, tabIndex);

  const applyFit = () => {
    const el = frameRef.current;
    if (!el || el.clientWidth < 2 || el.clientHeight < 2) return;
    setView(fitTreeView(el.clientWidth, el.clientHeight, tabArea.w, tabArea.h, 8));
    fittedFor.current = `${tabArea.w}x${tabArea.h}`;
  };

  const apply100 = () => {
    const el = frameRef.current;
    if (!el) return;
    setView(centerTreeView(el.clientWidth, el.clientHeight, tabArea.w, tabArea.h, 1));
  };

  const zoomBy = (factor: number) => {
    const el = frameRef.current;
    if (!el) return;
    const cursor = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    setView((current) => zoomTreeAt(current, current.zoom * factor, cursor));
  };

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const maybeFit = () => {
      if (fittedFor.current !== `${tabArea.w}x${tabArea.h}`) applyFit();
    };
    maybeFit();
    const ro = new ResizeObserver(maybeFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabArea.w, tabArea.h]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const kind = classifyWheel(event);
      if (kind === 'pan') {
        setView((current) => panTreeByScreen(current, -event.deltaX, -event.deltaY));
        return;
      }
      const factor = kind === 'pinch' ? pinchFactor(event.deltaY) : (event.deltaY > 0 ? 0.9 : 1.1);
      setView((current) => zoomTreeAt(current, current.zoom * factor, cursor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      if (!hover.current && !space.current) return;
      event.preventDefault();
      space.current = true;
      setSpaceDown(true);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      space.current = false;
      setSpaceDown(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const onTab = useMemo(() => {
    const map = new Map<string, PowerTreeNode & { index: number }>();
    for (const power of powers) {
      if (power.id && !map.has(power.id)) map.set(power.id, power);
    }
    return map;
  }, [powers]);

  const links = useMemo(() => {
    const out: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; key: string }> = [];
    for (const power of powers) {
      const from = menuToTabPoint(parsePosition(power.position), tabArea);
      for (const id of power.requires_power) {
        const target = onTab.get(id);
        if (!target) continue;
        const to = menuToTabPoint(parsePosition(target.position), tabArea);
        out.push({
          from: { x: from.x + ICON / 2, y: from.y + ICON / 2 },
          to: { x: to.x + ICON / 2, y: to.y + ICON / 2 },
          key: `${power.index}-${id}`,
        });
      }
    }
    return out;
  }, [powers, onTab, tabArea]);

  const startPan = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panDrag.current = { startX: event.clientX, startY: event.clientY, panX: view.panX, panY: view.panY };
    setPanning(true);
  };

  const onFramePointerDown = (event: ReactPointerEvent) => {
    const pan = event.button === 1 || space.current || event.button === 0;
    if (event.button === 0) onSelect(null);
    if (pan && event.button !== 2) startPan(event);
  };

  const onFramePointerMove = (event: ReactPointerEvent) => {
    const current = panDrag.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    setView((prev) => ({ ...prev, panX: current.panX + dx / prev.zoom, panY: current.panY + dy / prev.zoom }));
  };

  const endPan = (event: ReactPointerEvent) => {
    if (!panDrag.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panDrag.current = null;
    setPanning(false);
  };

  const onIconMove = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / view.zoom;
    const dy = (event.clientY - current.startY) / view.zoom;
    onMove(current.index, tabToMenuPosition({ x: current.origX + dx, y: current.origY + dy }, tabArea, snap ? GRID : 0));
  };

  const endDrag = (event: ReactPointerEvent) => {
    if (!drag.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  };

  const cursor = panning ? 'grabbing' : (spaceDown ? 'grab' : 'default');

  return (
    <div className="flex flex-col min-h-0 h-full gap-1">
      <div className="flex items-center gap-3 px-0.5 flex-wrap">
        <HintLabel className="flex items-center gap-2 text-xs font-normal" hint="Snap dragged icons to a 16-pixel grid, matching typical Flare icon spacing.">
          <Checkbox checked={snap} onCheckedChange={(value) => setSnap(value === true)} />
          Snap to grid
        </HintLabel>
        <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Flare does not draw lines between powers. The dashed links are a Studio preview of requires_power on this tab only. Wheel zooms under the cursor; drag empty space, middle mouse, or Space+drag to pan.">
          Editor-only links
        </HintLabel>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip content="Zoom out (wheel)" side="bottom">
            <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="Zoom out" onClick={() => zoomBy(1 / TREE_ZOOM_STEP)}>
              <Minus className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Current zoom. Click to set 100%." side="bottom">
            <Button type="button" size="sm" variant="outline" className="h-7 min-w-[3.25rem] px-1.5 text-xs tabular-nums" aria-label="Zoom level" onClick={apply100}>
              {treeZoomPercent(view.zoom)}%
            </Button>
          </Tooltip>
          <Tooltip content="Zoom in (wheel)" side="bottom">
            <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="Zoom in" onClick={() => zoomBy(TREE_ZOOM_STEP)}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Fit to view" side="bottom">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" aria-label="Fit to view" onClick={applyFit}>
              <Maximize2 className="w-3.5 h-3.5 mr-1" />Fit
            </Button>
          </Tooltip>
          <Tooltip content="Reset to 100%" side="bottom">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs tabular-nums" aria-label="Reset to 100 percent" onClick={apply100}>
              100%
            </Button>
          </Tooltip>
        </div>
      </div>
      <div
        ref={frameRef}
        className="relative flex-1 min-h-[240px] rounded-md border border-border bg-muted/30 overflow-hidden"
        style={{ cursor }}
        onMouseEnter={() => { hover.current = true; }}
        onMouseLeave={() => { hover.current = false; }}
        onPointerDown={onFramePointerDown}
        onPointerMove={onFramePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onAuxClick={(event) => event.preventDefault()}
      >
        <div
          className="absolute left-0 top-0 bg-black/40 origin-top-left"
          style={{
            width: tabArea.w,
            height: tabArea.h,
            transform: `translate(${view.panX * view.zoom}px, ${view.panY * view.zoom}px) scale(${view.zoom})`,
          }}
        >
          {menuArt ? (
            <div
              className="absolute inset-0"
              style={fileStyle(menuArt, {
                backgroundSize: `${pos.w}px ${pos.h}px`,
                backgroundPosition: `${-tabArea.x}px ${-tabArea.y}px`,
              })}
            />
          ) : null}
          {tabArt ? (
            <div
              className="absolute inset-0"
              style={fileStyle(tabArt, { backgroundSize: '100% 100%' })}
            />
          ) : null}
          <svg className="absolute inset-0 pointer-events-none" width={tabArea.w} height={tabArea.h} viewBox={`0 0 ${tabArea.w} ${tabArea.h}`}>
            {links.map((link) => (
              <line
                key={link.key}
                x1={link.from.x}
                y1={link.from.y}
                x2={link.to.x}
                y2={link.to.y}
                stroke="rgb(234, 88, 12)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.85}
              />
            ))}
          </svg>
          {powers.map((power) => {
            const point = menuToTabPoint(parsePosition(power.position), tabArea);
            const selected = selectedIndex === power.index;
            return (
              <button
                key={power.index}
                type="button"
                className={`absolute flex items-center justify-center text-[9px] leading-tight font-mono text-center overflow-visible rounded-sm border cursor-grab active:cursor-grabbing select-none ${
                  selected ? 'border-orange-500 ring-2 ring-orange-500 bg-orange-950/80 text-orange-50' : 'border-border bg-background/90 text-foreground'
                }`}
                style={{
                  left: point.x,
                  top: point.y,
                  width: ICON,
                  height: ICON,
                }}
                title={formatPowerLabel({ id: power.id, name: names?.[power.id] || '' })}
                onPointerDown={(event) => {
                  if (event.button === 1 || space.current) return;
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const orig = menuToTabPoint(parsePosition(power.position), tabArea);
                  drag.current = { index: power.index, startX: event.clientX, startY: event.clientY, origX: orig.x, origY: orig.y };
                  onSelect(power.index);
                }}
                onPointerMove={onIconMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {iconSrcs?.[power.id] ? (
                  <span
                    className="pointer-events-none absolute inset-0 bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${iconSrcs[power.id]}")`, backgroundSize: '100% 100%' }}
                  />
                ) : (
                  <span className="pointer-events-none truncate px-0.5">{names?.[power.id] || power.id || '?'}</span>
                )}
                <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-0.5 max-w-[7rem] -translate-x-1/2 truncate rounded bg-background/90 px-0.5 text-[9px] leading-tight text-foreground">
                  {formatPowerLabel({ id: power.id, name: names?.[power.id] || '' })}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
