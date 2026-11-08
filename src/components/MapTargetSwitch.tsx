import React, { useEffect } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import type { TileLayer } from '@/types';
import { MAP_TARGETS, MAP_TARGET_LABEL, MAP_TAB_HELP, isMapTarget, nextTarget, rememberTarget, shouldHandleTabKey, type MapTarget } from '@/components/mapTargets';
import { MAP_TARGET_ICON } from '@/components/MapLayerRow';

const BTN = 28; // px, square buttons
const GAP = 4;

type Props = {
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
};

/** Ground / Object / Collision switch with a sliding orange highlighter; Tab cycles targets. */
const MapTargetSwitch: React.FC<Props> = ({ layers, activeLayer, onSelectLayer }) => {
  const current: MapTarget | null = isMapTarget(activeLayer?.type) ? activeLayer!.type as MapTarget : null;
  const select = (t: MapTarget) => {
    const l = layers.find(x => x.type === t);
    if (!l) return;
    rememberTarget(t);
    onSelectLayer(l.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleTabKey(e, activeLayer?.type, e.target as HTMLElement | null)) return;
      e.preventDefault();
      select(nextTarget(activeLayer!.type as MapTarget, e.shiftKey));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  useEffect(() => { if (current) rememberTarget(current); }, [current]);

  const idx = current ? MAP_TARGETS.indexOf(current) : -1;
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-2">
      <div className="relative flex rounded-md bg-muted p-0.5" style={{ gap: GAP }}>
        <div
          aria-hidden
          className="absolute top-0.5 left-0.5 rounded bg-primary"
          style={{
            width: BTN,
            height: BTN,
            opacity: idx >= 0 ? 1 : 0,
            transform: `translateX(${Math.max(0, idx) * (BTN + GAP)}px)`,
            transition: reduce ? 'none' : 'transform 180ms ease, opacity 180ms ease',
          }}
        />
        {MAP_TARGETS.map(t => {
          const Icon = MAP_TARGET_ICON[t];
          const selected = t === current;
          return (
            <Tooltip key={t} content={MAP_TARGET_LABEL[t]} side="bottom">
              <button
                type="button"
                aria-label={MAP_TARGET_LABEL[t]}
                aria-pressed={selected}
                onClick={() => select(t)}
                className={`relative z-10 inline-flex items-center justify-center rounded ${selected ? 'text-primary-foreground' : 'text-gray-400 dark:text-gray-500 hover:text-gray-500'}`}
                style={{ width: BTN, height: BTN, transition: reduce ? 'none' : 'color 180ms ease' }}
              >
                <Icon className="w-4 h-4" />
              </button>
            </Tooltip>
          );
        })}
      </div>
      <Tooltip content={MAP_TAB_HELP}>
        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" aria-hidden />
      </Tooltip>
    </div>
  );
};

export default MapTargetSwitch;
