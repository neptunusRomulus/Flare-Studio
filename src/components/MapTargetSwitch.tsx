import React, { useEffect } from 'react';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, Eye, EyeOff } from 'lucide-react';
import type { TileLayer } from '@/types';
import { MAP_GROUP, groupOfType, rememberGroupTarget, tabTargetFor, type TargetGroup } from '@/components/targetGroups';
import { rememberTarget, isMapTarget } from '@/components/mapTargets';
import { TARGET_ICON } from '@/components/targetIcons';
import SlidingSwitch, { type SwitchItem } from '@/components/SlidingSwitch';

/** Per-layer visibility (corner eye) and opacity (wheel) on the sub-switch buttons. */
export type LayerVisibilityControls = {
  onToggleVisibility: (id: number) => void;
  onTransparencyChange: (id: number, delta: number) => void;
};

type Props = {
  group?: TargetGroup;
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
  visibility?: LayerVisibilityControls;
};

export function visibilityTooltip(label: string, visible: boolean, transparency: number): string {
  return `${label} · ${visible ? 'visible' : 'hidden'} · opacity ${Math.round((1 - transparency) * 100)}% (wheel)`;
}

/** Sub-target switch (e.g. Ground / Object / Collision) with a sliding orange highlighter; Tab cycles targets. */
const MapTargetSwitch: React.FC<Props> = ({ group = MAP_GROUP, layers, activeLayer, onSelectLayer, visibility }) => {
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

  const withVis = !!visibility && group.hasVisibility !== false;
  const items: SwitchItem[] = group.targets.map(t => {
    const label = group.labels[t];
    const l = layers.find(x => x.type === t);
    if (!withVis || !l || !visibility) return { key: t, icon: TARGET_ICON[t], label, tooltip: label };
    const tr = l.transparency || 0;
    const EyeIcon = l.visible ? Eye : EyeOff;
    return {
      key: t,
      icon: TARGET_ICON[t],
      label,
      tooltip: visibilityTooltip(label, l.visible, tr),
      dimmed: !l.visible,
      onWheel: (e) => { e.preventDefault(); visibility.onTransparencyChange(l.id, e.deltaY > 0 ? 0.1 : -0.1); },
      corner: (
        <button
          type="button"
          aria-label={`${l.visible ? 'Hide' : 'Show'} ${label}`}
          aria-pressed={!l.visible}
          onClick={(e) => { e.stopPropagation(); visibility.onToggleVisibility(l.id); }}
          className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-foreground"
        >
          <EyeIcon className="w-2.5 h-2.5" />
        </button>
      ),
    };
  });

  return (
    <div className="flex items-center justify-center gap-1.5 pt-2">
      <SlidingSwitch items={items} selected={current} onSelect={select} ariaLabel={group.label} />
      <Tooltip content={group.help}>
        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" aria-hidden />
      </Tooltip>
    </div>
  );
};

export default MapTargetSwitch;
