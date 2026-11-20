import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Tooltip from '@/components/ui/tooltip';
import type { TileLayer } from '@/types';
import type { LayerVisibilityControls } from '@/components/MapTargetSwitch';
import { GROUP_ICON, TARGET_ICON } from '@/components/targetIcons';
import { groupOfType, railGroups, railHelpFor, railTypeOf, rememberGroupTarget, visibilityTargets } from '@/components/targetGroups';
import { isMapTarget, rememberTarget } from '@/components/mapTargets';
import { SIDEBAR_RAIL_WIDTH } from '@/components/paletteLayout';

type Props = {
  layers: TileLayer[];
  activeLayer: TileLayer | null;
  onSelectLayer: (id: number) => void;
  cardOpen: boolean;
  onCardOpenChange: (open: boolean) => void;
  visibility?: LayerVisibilityControls;
  shown: boolean;
  animMs: number;
};

function railIconTooltip(label: string, selected: boolean, cardOpen: boolean, layer: TileLayer | undefined, hasVisibility: boolean): string {
  const base = selected && cardOpen ? `${label} · click to close` : label;
  if (!hasVisibility || !layer) return base;
  const parts = [base];
  if (!layer.visible) parts.push('hidden');
  const opacity = Math.round((1 - (layer.transparency || 0)) * 100);
  if (opacity < 100) parts.push(`opacity ${opacity}%`);
  return parts.join(' · ');
}

const PaletteRail: React.FC<Props> = ({
  layers,
  activeLayer,
  onSelectLayer,
  cardOpen,
  onCardOpenChange,
  visibility,
  shown,
  animMs,
}) => {
  const groups = railGroups(layers);
  const visTypes = new Set(visibility ? visibilityTargets(layers).map((item) => item.type) : []);
  const activeType = activeLayer?.type ?? '';
  const railActiveType = railTypeOf(activeType) ?? '';
  const activeHelp = railHelpFor(activeType);

  const selectTarget = (type: string) => {
    const layer = layers.find((item) => item.type === type);
    if (!layer) return;
    const group = groupOfType(type);
    if (group) rememberGroupTarget(group, type);
    if (isMapTarget(type)) rememberTarget(type);
    onSelectLayer(layer.id);
    onCardOpenChange(true);
  };

  return (
    <aside
      aria-label="Sidebar"
      className="h-full min-h-0 flex-shrink-0 flex flex-col items-center bg-muted/40 border-l border-orange-600/70"
      style={{
        width: SIDEBAR_RAIL_WIDTH,
        transform: shown ? 'translateX(0)' : 'translateX(100%)',
        opacity: shown ? 1 : 0,
        transition: animMs ? `transform ${animMs}ms cubic-bezier(0, 0, 0.2, 1), opacity ${animMs}ms cubic-bezier(0, 0, 0.2, 1)` : 'none',
      }}
    >
      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden py-1.5 flex flex-col items-center gap-2">
        {groups.map((group, index) => (
          <React.Fragment key={group.id}>
            {index > 0 ? <div className="w-6 h-px bg-border/80" aria-hidden /> : null}
            <ToggleGroup
              type="single"
              orientation="vertical"
              value={railActiveType}
              onValueChange={(value) => {
                if (!value) {
                  if (activeType === 'strings') {
                    selectTarget('gameSettings');
                    return;
                  }
                  onCardOpenChange(!cardOpen);
                  return;
                }
                selectTarget(value);
              }}
              aria-label={group.label}
              className="flex flex-col gap-0.5"
            >
              {group.targets.map((target) => {
                const Icon = TARGET_ICON[target.type] ?? GROUP_ICON[target.type] ?? GROUP_ICON[group.id];
                const selected = target.type === railActiveType;
                const layer = layers.find((item) => item.type === target.type);
                const hasVisibility = visTypes.has(target.type);
                const hidden = Boolean(hasVisibility && layer && !layer.visible);
                const tip = railIconTooltip(target.label, selected, cardOpen, layer, hasVisibility);
                return (
                  <Tooltip key={target.type} content={tip} side="left">
                    <ToggleGroupItem
                      value={target.type}
                      aria-label={target.label}
                      aria-pressed={selected}
                      aria-expanded={selected && cardOpen}
                      title={target.label}
                      onPointerDown={(event) => {
                        if (!(event.ctrlKey || event.metaKey) || !visibility || !layer || !hasVisibility) return;
                        event.preventDefault();
                        event.stopPropagation();
                        visibility.onToggleVisibility(layer.id);
                      }}
                      onClick={(event) => {
                        if (!(event.ctrlKey || event.metaKey) || !hasVisibility) return;
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onWheel={(event) => {
                        if (!visibility || !layer || !hasVisibility) return;
                        event.preventDefault();
                        event.stopPropagation();
                        visibility.onTransparencyChange(layer.id, event.deltaY > 0 ? 0.1 : -0.1);
                      }}
                      className={`h-8 w-8 p-0 min-w-0 rounded-md ${hidden ? 'opacity-40' : ''} ${selected ? 'bg-orange-600 text-white hover:bg-orange-600 hover:text-white data-[state=on]:bg-orange-600 data-[state=on]:text-white' : 'text-muted-foreground'}`}
                    >
                      {Icon ? <Icon className="w-4 h-4" /> : null}
                      <span className="sr-only">{target.label}</span>
                    </ToggleGroupItem>
                  </Tooltip>
                );
              })}
            </ToggleGroup>
          </React.Fragment>
        ))}
      </div>

      <div className="flex-shrink-0 w-full flex justify-center py-1.5 border-t border-border/80">
        <Tooltip
          content={(
            <div className="space-y-0.5">
              {activeHelp.split('\n').map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          )}
          side="left"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Sidebar help"
            className="h-7 w-7 text-muted-foreground"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>
    </aside>
  );
};

export default PaletteRail;
