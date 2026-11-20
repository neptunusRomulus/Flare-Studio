import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Tooltip from '@/components/ui/tooltip';
import type { TileLayer } from '@/types';
import type { LayerVisibilityControls } from '@/components/MapTargetSwitch';
import { visibilityTooltip } from '@/components/MapTargetSwitch';
import { GROUP_ICON, TARGET_ICON } from '@/components/targetIcons';
import { groupOfType, railGroups, rememberGroupTarget, visibilityTargets } from '@/components/targetGroups';
import { isMapTarget, mapTargetTooltip, rememberTarget } from '@/components/mapTargets';
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
  const visItems = visibility ? visibilityTargets(layers) : [];
  const activeType = activeLayer?.type ?? '';
  const activeHelp = groupOfType(activeType)?.help
    ?? (activeType === 'gameSettings' || activeType === 'worldSettings' || activeType === 'strings' || activeType === 'titles' || activeType === 'stats' || activeType === 'powerTree' ? 'Shift+Tab: switch main layers.' : 'Tab: switch targets. Shift+Tab: switch main layers.');

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
              value={activeType}
              onValueChange={(value) => {
                if (!value) {
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
                const selected = target.type === activeType;
                const tip = selected && cardOpen ? `${target.label} · click to close` : target.label;
                return (
                  <Tooltip key={target.type} content={tip} side="left">
                    <ToggleGroupItem
                      value={target.type}
                      aria-label={target.label}
                      aria-pressed={selected}
                      aria-expanded={selected && cardOpen}
                      title={target.label}
                      className={`h-8 w-8 p-0 min-w-0 rounded-md ${selected ? 'bg-orange-600 text-white hover:bg-orange-600 hover:text-white data-[state=on]:bg-orange-600 data-[state=on]:text-white' : 'text-muted-foreground'}`}
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

      {visItems.length > 0 && visibility ? (
        <div className="flex-shrink-0 w-full flex flex-col items-center gap-0.5 py-1.5 border-t border-border/80">
          {visItems.map((item) => {
            const layer = layers.find((entry) => entry.type === item.type);
            if (!layer) return null;
            const Icon = TARGET_ICON[item.type];
            const visible = layer.visible;
            const tooltip = mapTargetTooltip(item.type, visibilityTooltip(item.label, visible, layer.transparency || 0));
            return (
              <Tooltip key={item.type} content={tooltip} side="left">
                <Toggle
                  size="sm"
                  pressed={visible}
                  aria-label={`${visible ? 'Hide' : 'Show'} ${item.label}`}
                  aria-pressed={visible}
                  onPressedChange={() => visibility.onToggleVisibility(layer.id)}
                  onWheel={(event) => {
                    event.preventDefault();
                    visibility.onTransparencyChange(layer.id, event.deltaY > 0 ? 0.1 : -0.1);
                  }}
                  className={`h-7 w-7 min-w-0 p-0 rounded-md text-muted-foreground data-[state=on]:bg-transparent data-[state=on]:text-foreground ${visible ? '' : 'opacity-40'}`}
                >
                  {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                </Toggle>
              </Tooltip>
            );
          })}
        </div>
      ) : null}

      <div className="flex-shrink-0 w-full flex justify-center py-1.5 border-t border-border/80">
        <Tooltip content={activeHelp} side="left">
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
