import React from 'react';
import { MapPinPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Tooltip from '@/components/ui/tooltip';
import { ACTIVATION_COLORS } from '@/editor/eventActivationColors';
import EventSectionShell from './EventSectionShell';
import { HintLabel } from '@/components/ui/field-hint';
import {
  ACTIVATION_CONFIG,
  ACTIVATION_OPTIONS,
  getSafeCoord,
  getSafeSize,
  type EventActivation,
  type EventSectionProps,
} from './eventDialogModel';

type Props = EventSectionProps & {
  setActivation: (_activation: EventActivation) => void;
  isEditing: boolean;
  eventPlaced: boolean;
  isLocEnabled: boolean;
  isHotspotEnabled: boolean;
  mapWidth: number;
  mapHeight: number;
};

/** Activation type, area, hotspot, cooldown and delay. */
export default function EventPositioningSection({
  eventData,
  setEventData,
  expandedSections,
  toggleSection,
  setActivation,
  isEditing,
  eventPlaced,
  isLocEnabled,
  isHotspotEnabled,
  mapWidth,
  mapHeight,
}: Props) {
  return (
    <EventSectionShell
      title="Positioning and Timing"
      icon={MapPinPlus}
      id="positioning-and-timing"
      isExpanded={expandedSections.positioning}
      onToggle={() => toggleSection('positioning')}
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Positioning and Timing</h3>

        {/* Activation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HintLabel className="text-xs font-medium text-foreground/80" hint={"When this event executes"}>Activation</HintLabel>
          </div>
          <div className="flex flex-wrap gap-1 items-start">
            {ACTIVATION_OPTIONS.map(activation => {
              const config = ACTIVATION_CONFIG[activation];
              const IconComponent = config.icon;
              const isActive = eventData.timing.activeActivation === activation;
              return (
                <Tooltip key={activation} content={config.tooltip} side="right">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={isActive}
                    onClick={() => setActivation(activation)}
                    className={`h-auto rounded-md border p-2 transition-colors hover:bg-muted/50 ${
                      isActive
                        ? (ACTIVATION_COLORS[activation]?.active ?? 'border-orange-500/50 bg-orange-500/10 text-orange-600')
                        : 'border-border/50 bg-muted/30 text-foreground/60 hover:bg-muted/50'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                  </Button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <div className="relative space-y-6">
          {!eventData.timing.activeActivation && (
            <div className="absolute -inset-4 z-50 bg-black/50 backdrop-blur-[1px] rounded-lg flex items-start justify-center pt-20 pointer-events-auto">
              <div className="bg-background border border-border/50 shadow-lg px-6 py-3 rounded-xl flex items-center justify-center">
                <span className="text-sm font-medium text-foreground">Select an activation type</span>
              </div>
            </div>
          )}

          <div className="space-y-4 border-b border-border/50 pb-4">
          {/* Area/hotspot belong to the map instance: set by placing (dragging an area) on the map, edited here afterwards */}
          {isEditing && !eventPlaced && (
            <div className="flex items-center gap-2 h-7">
              <Label className="text-xs font-medium text-foreground/80">Location</Label>
              <Tooltip content="Place it from the Entities dock: click its pin, then drag an area on the map.">
                <span className="text-xs text-muted-foreground italic cursor-help">Not placed</span>
              </Tooltip>
            </div>
          )}
          {isEditing && eventPlaced && (<>
          {/* Location and Size */}
          <div className={`space-y-2 transition-opacity ${!isLocEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <HintLabel className="text-xs font-medium text-foreground/80" hint={"Defines the physical area of the event"}>Location and Size</HintLabel>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">X</Label>
                <Input
                  type="number"
                  min="0"
                  max={mapWidth - 1}
                  value={eventData.positioning.coordinates.x}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        coordinates: { 
                          ...prev.positioning.coordinates, 
                          x: getSafeCoord(parseInt(e.target.value), mapWidth)
                        },
                        size: {
                          ...prev.positioning.size,
                          width: getSafeSize(prev.positioning.size.width, getSafeCoord(parseInt(e.target.value), mapWidth), mapWidth)
                        }
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Y</Label>
                <Input
                  type="number"
                  min="0"
                  max={mapHeight - 1}
                  value={eventData.positioning.coordinates.y}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        coordinates: { 
                          ...prev.positioning.coordinates, 
                          y: getSafeCoord(parseInt(e.target.value), mapHeight)
                        },
                        size: {
                          ...prev.positioning.size,
                          height: getSafeSize(prev.positioning.size.height, getSafeCoord(parseInt(e.target.value), mapHeight), mapHeight)
                        }
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Width</Label>
                <Input
                  type="number"
                  min="1"
                  max={mapWidth - eventData.positioning.coordinates.x}
                  value={eventData.positioning.size.width}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        size: { 
                          ...prev.positioning.size, 
                          width: getSafeSize(parseInt(e.target.value), prev.positioning.coordinates.x, mapWidth)
                        },
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Height</Label>
                <Input
                  type="number"
                  min="1"
                  max={mapHeight - eventData.positioning.coordinates.y}
                  value={eventData.positioning.size.height}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        size: { 
                          ...prev.positioning.size, 
                          height: getSafeSize(parseInt(e.target.value), prev.positioning.coordinates.y, mapHeight)
                        },
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Hotspot */}
          <div className={`space-y-2 transition-opacity ${!isHotspotEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <HintLabel className="text-xs font-medium text-foreground/80" hint={"Property determines the specific clickable area for an interaction"}>Hotspot</HintLabel>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">X</Label>
                <Input
                  type="number"
                  min="0"
                  value={eventData.positioning.hotspot.x}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        hotspot: { ...prev.positioning.hotspot, x: Math.max(0, parseInt(e.target.value) || 0) },
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Y</Label>
                <Input
                  type="number"
                  min="0"
                  value={eventData.positioning.hotspot.y}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        hotspot: { ...prev.positioning.hotspot, y: Math.max(0, parseInt(e.target.value) || 0) },
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Width</Label>
                <Input
                  type="number"
                  min="1"
                  value={eventData.positioning.hotspot.width}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        hotspot: { ...prev.positioning.hotspot, width: Math.max(1, parseInt(e.target.value) || 1) },
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Height</Label>
                <Input
                  type="number"
                  min="1"
                  value={eventData.positioning.hotspot.height}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      positioning: {
                        ...prev.positioning,
                        hotspot: { ...prev.positioning.hotspot, height: Math.max(1, parseInt(e.target.value) || 1) },
                      },
                    }))
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>
          </>)}

          {/* Cooldown */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HintLabel className="text-xs font-medium text-foreground/80" hint={"Adds a waiting period between activations"}>Cooldown (ms)</HintLabel>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  type="range"
                  min="0"
                  max="10000"
                  step="500"
                  list="cooldown-ticks"
                  value={Math.min(eventData.timing.cooldown, 10000)}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      timing: { ...prev.timing, cooldown: parseInt(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
                <datalist id="cooldown-ticks">
                  {[0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000].map(v => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <Input
                type="number"
                min="0"
                value={eventData.timing.cooldown}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    timing: { ...prev.timing, cooldown: Math.max(0, parseInt(e.target.value) || 0) },
                  }))
                }
                className="h-7 text-xs font-mono w-20"
              />
              <span className="text-[10px] text-muted-foreground">ms</span>
            </div>
          </div>

          {/* Delay */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HintLabel className="text-xs font-medium text-foreground/80" hint={"Postpones the event's execution after it is triggered"}>Delay (ms)</HintLabel>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  type="range"
                  min="0"
                  max="10000"
                  step="500"
                  list="delay-ticks"
                  value={Math.min(eventData.timing.delay, 10000)}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      timing: { ...prev.timing, delay: parseInt(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
                <datalist id="delay-ticks">
                  {[0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000].map(v => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <Input
                type="number"
                min="0"
                value={eventData.timing.delay}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    timing: { ...prev.timing, delay: Math.max(0, parseInt(e.target.value) || 0) },
                  }))
                }
                className="h-7 text-xs font-mono w-20"
              />
              <span className="text-[10px] text-muted-foreground">ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </EventSectionShell>
  );
}
