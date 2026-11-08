import React, { useEffect } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import type { TileLayer } from '@/types';
import { MAP_GROUP, groupOfType, rememberGroupTarget, tabTargetFor, type TargetGroup } from '@/components/targetGroups';
import { rememberTarget, isMapTarget } from '@/components/mapTargets';
import { TARGET_ICON } from '@/components/MapLayerRow';

const BTN = 28; // px, square buttons
const GAP = 4;

type Props = {
  group?: TargetGroup;
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
};

/** Ground / Object / Collision switch with a sliding orange highlighter; Tab cycles targets. */
const MapTargetSwitch: React.FC<Props> = ({ group = MAP_GROUP, layers, activeLayer, onSelectLayer }) => {
  const current: string | null = activeLayer && group.targets.includes(activeLayer.type) ? activeLayer.type : null;
  const select = (t: string) => {
    const l = layers.find(x => x.type === t);
    if (!l) return;
    rememberGroupTarget(group, t);
    if (isMapTarget(t)) rememberTarget(t);
    onSelectLayer(l.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (groupOfType(activeLayer?.type) !== group) return;
      const next = tabTargetFor(e, activeLayer?.type, e.target as HTMLElement | null);
      if (!next) return;
      e.preventDefault();
      select(next);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  useEffect(() => {
    if (!current) return;
    rememberGroupTarget(group, current);
    if (isMapTarget(current)) rememberTarget(current);
  }, [current, group]);

  const idx = current ? group.targets.indexOf(current) : -1;
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
        {group.targets.map(t => {
          const Icon = TARGET_ICON[t];
          const selected = t === current;
          return (
            <Tooltip key={t} content={group.labels[t]} side="bottom">
              <button
                type="button"
                aria-label={group.labels[t]}
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
      <Tooltip content={group.help}>
        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" aria-hidden />
      </Tooltip>
    </div>
  );
};

export default MapTargetSwitch;
