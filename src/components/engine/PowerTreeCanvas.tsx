import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { HintLabel } from '@/components/ui/field-hint';
import { menuToTabPoint, type PowersMenuLayout, tabToMenuPosition } from '@/editor/menuLayout';
import { parsePosition, powersOnTab, type PowerTreeFile, type PowerTreeNode } from '@/editor/powerTree';
import { formatPowerLabel } from '@/editor/powerCatalog';

const ICON = 32;
const GRID = 16;

function fileStyle(url: string | null, extra: CSSProperties = {}): CSSProperties {
  if (!url) return extra;
  return { backgroundImage: `url("${url}")`, backgroundRepeat: 'no-repeat', ...extra };
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
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [snap, setSnap] = useState(true);
  const drag = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const { pos, tabArea } = layout;
  const powers = powersOnTab(tree, tabIndex);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      const next = Math.min(width / Math.max(tabArea.w, 1), height / Math.max(tabArea.h, 1));
      setScale(next > 0 && Number.isFinite(next) ? Math.min(next, 2) : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabArea.w, tabArea.h]);

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

  const width = Math.max(1, tabArea.w * scale);
  const height = Math.max(1, tabArea.h * scale);

  const onPointerMove = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / scale;
    const dy = (event.clientY - current.startY) / scale;
    onMove(current.index, tabToMenuPosition({ x: current.origX + dx, y: current.origY + dy }, tabArea, snap ? GRID : 0));
  };

  const endDrag = (event: ReactPointerEvent) => {
    if (drag.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      drag.current = null;
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full gap-1">
      <div className="flex items-center gap-3 px-0.5">
        <HintLabel className="flex items-center gap-2 text-xs font-normal" hint="Snap dragged icons to a 16-pixel grid, matching typical Flare icon spacing.">
          <Checkbox checked={snap} onCheckedChange={(value) => setSnap(value === true)} />
          Snap to grid
        </HintLabel>
        <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Flare does not draw lines between powers. The dashed links are a Studio preview of requires_power on this tab only.">
          Editor-only links
        </HintLabel>
      </div>
      <div
        ref={frameRef}
        className="relative flex-1 min-h-[240px] rounded-md border border-border bg-muted/30 overflow-hidden"
        onPointerDown={() => onSelect(null)}
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black/40 pb-4"
          style={{ width, height }}
        >
          {menuArt ? (
            <div
              className="absolute inset-0"
              style={fileStyle(menuArt, {
                backgroundSize: `${pos.w * scale}px ${pos.h * scale}px`,
                backgroundPosition: `${-tabArea.x * scale}px ${-tabArea.y * scale}px`,
              })}
            />
          ) : null}
          {tabArt ? (
            <div
              className="absolute inset-0"
              style={fileStyle(tabArt, { backgroundSize: '100% 100%' })}
            />
          ) : null}
          <svg className="absolute inset-0 pointer-events-none" width={width} height={height} viewBox={`0 0 ${tabArea.w} ${tabArea.h}`}>
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
                  left: point.x * scale,
                  top: point.y * scale,
                  width: ICON * scale,
                  height: ICON * scale,
                }}
                title={formatPowerLabel({ id: power.id, name: names?.[power.id] || '' })}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const orig = menuToTabPoint(parsePosition(power.position), tabArea);
                  drag.current = { index: power.index, startX: event.clientX, startY: event.clientY, origX: orig.x, origY: orig.y };
                  onSelect(power.index);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <span className="pointer-events-none truncate px-0.5">{names?.[power.id] || power.id || '?'}</span>
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
