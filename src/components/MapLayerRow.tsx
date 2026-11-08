import React from 'react';
import Tooltip from '@/components/ui/tooltip';
import { Image as MapImage, Box, Grid, Map as MapIcon, Mouse, Users, Locate, Clock, Shapes } from 'lucide-react';
import type { TileLayer } from '@/types';
import { MAP_GROUP, lastGroupTarget, type TargetGroup } from '@/components/targetGroups';

type IconC = React.ComponentType<{ className?: string }>;
/** Icons per target layer type (same icons the old individual rows used). */
export const TARGET_ICON: Record<string, IconC> = {
  background: MapImage,
  object: Box,
  collision: Grid,
  npc: Users,
  enemy: Locate,
  event: Clock,
};
export const MAP_TARGET_ICON = TARGET_ICON;
export const GROUP_ICON: Record<string, IconC> = { map: MapIcon, entities: Shapes };

type Props = {
  group?: TargetGroup;
  targets: TileLayer[];
  activeLayerId: number | null;
  leftCollapsed: boolean;
  onSelect: (id: number) => void;
  onToggleVisibility: (id: number) => void;
  onTransparencyChange: (id: number, delta: number) => void;
  showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
  hideTooltip: () => void;
};

/** Single "Map" sidebar entry; its three mini toggles keep per-layer visibility (click) and opacity (wheel). */
const MapLayerRow: React.FC<Props> = ({ group = MAP_GROUP, targets, activeLayerId, leftCollapsed, onSelect, onToggleVisibility, onTransparencyChange, showTooltipWithDelay, hideTooltip }) => {
  const active = targets.some(t => t.id === activeLayerId);
  const select = () => {
    const want = lastGroupTarget(group);
    const layer = targets.find(t => t.type === want) ?? targets[0];
    if (layer) onSelect(layer.id);
  };
  const tip = (l: TileLayer, transparency: number) => (
    <div className="flex items-center gap-1 text-xs">
      <Mouse className="w-3 h-3" />
      {group.labels[l.type] ?? l.name}: {l.visible ? 'visible' : 'hidden'} · opacity {Math.round((1 - transparency) * 100)}%
    </div>
  );
  return (
    <div
      className={`block w-full max-w-xs px-2 py-1 rounded text-xs ${active ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-transparent hover:bg-orange-100/50 dark:hover:bg-orange-800/15'}`}
      style={{ boxShadow: active ? '0 6px 12px rgba(15,23,42,0.06)' : 'none' }}
    >
      <div
        className="cursor-pointer w-full flex items-center gap-2"
        role="button"
        tabIndex={0}
        onClick={select}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } }}
      >
        <div className={`flex items-center gap-1 ${active ? 'opacity-100' : 'opacity-80'}`} onClick={(e) => e.stopPropagation()}>
          {targets.map(l => {
            const Icon = TARGET_ICON[l.type] ?? MapIcon;
            return (
              <button
                key={l.id}
                type="button"
                aria-label={`${group.labels[l.type] ?? l.name} visibility`}
                className="w-5 h-5 inline-flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                style={{ opacity: l.visible ? Math.max(0.35, 1 - (l.transparency || 0)) : 1 }}
                onClick={() => onToggleVisibility(l.id)}
                onMouseEnter={(e) => showTooltipWithDelay(tip(l, l.transparency || 0), e.currentTarget)}
                onMouseLeave={hideTooltip}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? 0.1 : -0.1;
                  onTransparencyChange(l.id, delta);
                  const next = Math.max(0, Math.min(1, (l.transparency || 0) + delta));
                  showTooltipWithDelay(tip(l, next), e.currentTarget);
                }}
              >
                <Icon className={`w-4 h-4 ${l.visible ? '' : 'text-gray-400 dark:text-gray-500 line-through'}`} />
                {!l.visible && <span className="sr-only">hidden</span>}
              </button>
            );
          })}
        </div>
        <Tooltip content={group.label}>
          <span className="flex items-center">{React.createElement(GROUP_ICON[group.id] ?? MapIcon, { className: 'w-4 h-4' })}</span>
        </Tooltip>
        <span className={leftCollapsed ? 'sr-only text-xs font-medium' : 'text-xs font-medium truncate'}>{group.label}</span>
      </div>
    </div>
  );
};

export default MapLayerRow;
