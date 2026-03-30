import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpCircle, X, Save, MapPinPlus, MousePointerClick, MapPinMinus, LogIn, LogOut, SquareCheckBig, Repeat2 } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { useAppContext } from '@/context/AppContext';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';

type EventActivation = 'Trigger' | 'Interact' | 'Load' | 'Leave' | 'MapExit' | 'MapClear' | 'Loop';

type EventData = {
  positioning: {
    mapName: string;
    coordinates: { x: number; y: number };
    size: { width: number; height: number };
    hotspot: { x: number; y: number; width: number; height: number };
  };
  timing: {
    activeActivation: EventActivation | null;
    cooldown: number;
    delay: number;
  };
  requirements: {
    status: string[];
    minLevel: number;
    itemId: string;
    itemQuantity: number;
    currency: number;
  };
  rewards: {
    message: string;
    expReward: number;
    itemReward: string;
    enemySpawn: string;
    teleportMap: string;
    teleportX: number;
    teleportY: number;
    sound: string;
  };
  engine: {
    chance: number;
    autoSave: boolean;
    script: string;
  };
};

type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventLocation: { x: number; y: number } | null;
};

const ACTIVATION_OPTIONS: EventActivation[] = ['Interact', 'Trigger', 'Leave', 'Load', 'MapExit', 'MapClear', 'Loop'];

const ACTIVATION_CONFIG: Record<EventActivation, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; tooltip: string; label: string }> = {
  Interact: {
    icon: MousePointerClick,
    tooltip: 'Interact - Activated specifically when the player interacts with the hotspot',
    label: 'Interact',
  },
  Trigger: {
    icon: MapPinPlus,
    tooltip: 'Trigger - Activated when the player stands in the event area or interacts with a defined hotspot',
    label: 'Trigger',
  },
  Leave: {
    icon: MapPinMinus,
    tooltip: 'Leave - Activated as the player leaves an event spot they were previously inside',
    label: 'Leave',
  },
  Load: {
    icon: LogIn,
    tooltip: 'Load - Activated as the player enters a map',
    label: 'Load',
  },
  MapExit: {
    icon: LogOut,
    tooltip: 'Map Exit - Activated as the player leaves the map',
    label: 'Map Exit',
  },
  MapClear: {
    icon: SquareCheckBig,
    tooltip: 'Map Clear - Activated when all enemies on a map have been defeated',
    label: 'Map Clear',
  },
  Loop: {
    icon: Repeat2,
    tooltip: 'Loop - Activated constantly, every frame',
    label: 'Loop',
  },
};

const EventDialog: React.FC<EventDialogProps> = ({ open, onOpenChange, eventLocation: _eventLocation }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { mapName: currentMapName, mapWidth, mapHeight } = useAppContext() as any;

  const getSafeCoord = (val: number, max: number) => {
    if (isNaN(val)) return 0;
    return Math.max(0, Math.min(max - 1, val));
  };
  
  const getSafeSize = (val: number, pos: number, max: number) => {
    if (isNaN(val)) return 1;
    return Math.max(1, Math.min(max - pos, val));
  };

  const [eventData, setEventData] = useState<EventData>({
    positioning: {
      mapName: '',
      coordinates: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      hotspot: { x: 0, y: 0, width: 1, height: 1 },
    },
    timing: {
      activeActivation: null,
      cooldown: 0,
      delay: 0,
    },
    requirements: {
      status: [],
      minLevel: 0,
      itemId: '',
      itemQuantity: 1,
      currency: 0,
    },
    rewards: {
      message: '',
      expReward: 0,
      itemReward: '',
      enemySpawn: '',
      teleportMap: '',
      teleportX: 0,
      teleportY: 0,
      sound: '',
    },
    engine: {
      chance: 100,
      autoSave: false,
      script: '',
    },
  });

  // Dragging and resizing state
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'event_dialog', initialWidth: 800, initialHeight: 600 });

  useEffect(() => {
    if (!open) return;
    
    // Auto-fill mapName when opening
    if (currentMapName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventData(prev => ({
        ...prev,
        positioning: { ...prev.positioning, mapName: currentMapName }
      }));
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onOpenChange, currentMapName]);

  useEffect(() => {
    if (!open) {
      window.dispatchEvent(new CustomEvent('activeEventPreview', { detail: null }));
      return;
    }
    const { x, y } = eventData.positioning.coordinates;
    const { width, height } = eventData.positioning.size;
    window.dispatchEvent(new CustomEvent('activeEventPreview', { detail: { x, y, width, height } }));
    
    return () => {
      window.dispatchEvent(new CustomEvent('activeEventPreview', { detail: null }));
    };
  }, [open, eventData.positioning.coordinates.x, eventData.positioning.coordinates.y, eventData.positioning.size.width, eventData.positioning.size.height]);

  const setActivation = (activation: EventActivation) => {
    setEventData(prev => ({
      ...prev,
      timing: {
        ...prev.timing,
        activeActivation: prev.timing.activeActivation === activation ? null : activation,
      },
    }));
  };

  const addStatusRequirement = () => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        status: [...prev.requirements.status, ''],
      },
    }));
  };

  const updateStatusRequirement = (index: number, value: string) => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        status: prev.requirements.status.map((s, i) => (i === index ? value : s)),
      },
    }));
  };

  const removeStatusRequirement = (index: number) => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        status: prev.requirements.status.filter((_, i) => i !== index),
      },
    }));
  };

  const isLocEnabled = ['Trigger', 'Leave'].includes(eventData.timing.activeActivation || '');
  const isHotspotEnabled = ['Interact', 'Trigger'].includes(eventData.timing.activeActivation || '');

  if (!open) return null;

  const dialogContent = (
    <>
      <div 
        ref={dialogRef}
        className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 50,
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center justify-between cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <h3 className="text-lg font-semibold flex-1">Add Event</h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 text-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* Positioning and Timing Section */}
          <div className="space-y-4 border-b border-border/50 pb-4">
            <h3 className="text-sm font-semibold text-foreground">Positioning and Timing</h3>

            {/* Activation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Activation</label>
                <Tooltip content="When this event executes">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="flex flex-wrap gap-1 items-start">
                {ACTIVATION_OPTIONS.map(activation => {
                  const config = ACTIVATION_CONFIG[activation];
                  const IconComponent = config.icon;
                  const isActive = eventData.timing.activeActivation === activation;
                  return (
                    <Tooltip key={activation} content={config.tooltip}>
                      <button
                        onClick={() => setActivation(activation)}
                        className={`rounded-md border p-2 transition-colors ${
                          isActive
                            ? 'border-orange-500/50 bg-orange-500/10 text-orange-600'
                            : 'border-border/50 bg-muted/30 text-foreground/60 hover:bg-muted/50'
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
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
            {/* Location and Size */}
            <div className={`space-y-2 transition-opacity ${!isLocEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Location and Size</label>
                <Tooltip content="Defines the physical area of the event">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Map Name</label>
                  <Input
                    value={eventData.positioning.mapName}
                    readOnly
                    disabled
                    placeholder="Map name"
                    className="h-7 text-xs bg-muted/50 cursor-not-allowed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">X</label>
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
                            // Auto-adjust width if x + width exceeds bounds
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
                    <label className="text-[10px] text-muted-foreground">Y</label>
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
                            // Auto-adjust height if y + height exceeds bounds
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
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Width</label>
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
                  <label className="text-[10px] text-muted-foreground">Height</label>
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
                <label className="text-xs font-medium text-foreground/80">Hotspot</label>
                <Tooltip content="Property determines the specific clickable area for an interaction">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">X</label>
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
                  <label className="text-[10px] text-muted-foreground">Y</label>
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
                  <label className="text-[10px] text-muted-foreground">Width</label>
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
                  <label className="text-[10px] text-muted-foreground">Height</label>
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

            {/* Cooldown */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Cooldown (ms)</label>
                <Tooltip content="Adds a waiting period between activations">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="range"
                  min="0"
                  max="9999000"
                  step="100"
                  value={eventData.timing.cooldown}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      timing: { ...prev.timing, cooldown: parseInt(e.target.value) },
                    }))
                  }
                  className="flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground w-16">{eventData.timing.cooldown}ms</span>
              </div>
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Delay (ms)</label>
                <Tooltip content="Postpones the event's execution after it is triggered">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="range"
                  min="0"
                  max="9999000"
                  step="100"
                  value={eventData.timing.delay}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      timing: { ...prev.timing, delay: parseInt(e.target.value) },
                    }))
                  }
                  className="flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground w-16">{eventData.timing.delay}ms</span>
              </div>
            </div>
          </div>

          {/* Requirements Section */}
          <div className="space-y-4 border-b border-border/50 pb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Requirements</h3>
              <Tooltip content="Events can check specific player conditions before firing">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </Tooltip>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground/80">Status Checks</label>
                  <Tooltip content="Checks for specific campaign or quest status">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Button size="sm" variant="outline" onClick={addStatusRequirement} className="h-6 text-xs">
                  Add Status
                </Button>
              </div>
              <div className="space-y-2">
                {eventData.requirements.status.map((status, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={status}
                      onChange={e => updateStatusRequirement(index, e.target.value)}
                      placeholder="Status name"
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeStatusRequirement(index)}
                      className="h-7 w-7"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Level */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Minimum Level</label>
                <Tooltip content="Requires a minimum player level">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="range"
                  min="0"
                  max="999"
                  value={eventData.requirements.minLevel}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      requirements: { ...prev.requirements, minLevel: parseInt(e.target.value) },
                    }))
                  }
                  className="flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground w-12">{eventData.requirements.minLevel}</span>
              </div>
            </div>

            {/* Item */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Item Requirement</label>
                <Tooltip content="Checks for a specific item (and quantity) in the inventory">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={eventData.requirements.itemId}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      requirements: { ...prev.requirements, itemId: e.target.value },
                    }))
                  }
                  placeholder="Item ID"
                  className="h-7 text-xs"
                />
                <div>
                  <label className="text-[10px] text-muted-foreground">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    value={eventData.requirements.itemQuantity}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        requirements: { ...prev.requirements, itemQuantity: Math.max(1, parseInt(e.target.value) || 1) },
                      }))
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Currency Requirement</label>
                <Tooltip content="Checks if the player has enough money">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <Input
                type="number"
                min="0"
                value={eventData.requirements.currency}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    requirements: { ...prev.requirements, currency: Math.max(0, parseInt(e.target.value) || 0) },
                  }))
                }
                placeholder="Currency amount"
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Actions and Rewards Section */}
          <div className="space-y-4 border-b border-border/50 pb-4">
            <h3 className="text-sm font-semibold text-foreground">Actions and Rewards</h3>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">Message</label>
              <Input
                value={eventData.rewards.message}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, message: e.target.value },
                  }))
                }
                placeholder="Display text message"
                className="h-7 text-xs"
              />
            </div>

            {/* EXP Reward */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">EXP Reward</label>
              <Input
                type="number"
                min="0"
                value={eventData.rewards.expReward}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, expReward: Math.max(0, parseInt(e.target.value) || 0) },
                  }))
                }
                placeholder="Experience points"
                className="h-7 text-xs"
              />
            </div>

            {/* Item Reward */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">Item Reward</label>
              <Input
                value={eventData.rewards.itemReward}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, itemReward: e.target.value },
                  }))
                }
                placeholder="Item ID"
                className="h-7 text-xs"
              />
            </div>

            {/* Enemy Spawn */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">Enemy Spawn</label>
              <Input
                value={eventData.rewards.enemySpawn}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, enemySpawn: e.target.value },
                  }))
                }
                placeholder="Enemy category"
                className="h-7 text-xs"
              />
            </div>

            {/* Teleport */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">Teleport</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={eventData.rewards.teleportMap}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      rewards: { ...prev.rewards, teleportMap: e.target.value },
                    }))
                  }
                  placeholder="Map name"
                  className="h-7 text-xs"
                />
                <Input
                  type="number"
                  value={eventData.rewards.teleportX}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      rewards: { ...prev.rewards, teleportX: parseInt(e.target.value) || 0 },
                    }))
                  }
                  placeholder="X"
                  className="h-7 text-xs"
                />
                <Input
                  type="number"
                  value={eventData.rewards.teleportY}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      rewards: { ...prev.rewards, teleportY: parseInt(e.target.value) || 0 },
                    }))
                  }
                  placeholder="Y"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Sound */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">Sound File</label>
              <Input
                value={eventData.rewards.sound}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, sound: e.target.value },
                  }))
                }
                placeholder="Sound path"
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Engine Logic Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Engine Logic</h3>

            {/* Chance */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Chance (%)</label>
                <Tooltip content="Sets a percentage chance for the event to fire">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="range"
                  min="0"
                  max="100"
                  value={eventData.engine.chance}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      engine: { ...prev.engine, chance: parseInt(e.target.value) },
                    }))
                  }
                  className="flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground w-12">{eventData.engine.chance}%</span>
              </div>
            </div>

            {/* Auto Save */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoSave"
                checked={eventData.engine.autoSave}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    engine: { ...prev.engine, autoSave: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-border/70"
              />
              <label htmlFor="autoSave" className="text-xs font-medium text-foreground/80">
                Auto Save Game
              </label>
              <Tooltip content="Automatically saves the game and updates the respawn point">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </Tooltip>
            </div>

            {/* Script */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-foreground/80">Script File</label>
                <Tooltip content="Calls an external script file for complex logic">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>
              <Input
                value={eventData.engine.script}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    engine: { ...prev.engine, script: e.target.value },
                  }))
                }
                placeholder="Script path"
                className="h-7 text-xs"
              />
            </div>
          </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-border/50 bg-background px-6 py-3 flex justify-end">
          <Tooltip content="Save event">
            <Button
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 text-foreground/80 hover:text-foreground hover:bg-muted"
            >
              <Save className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
          title="Drag to resize"
        >
          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
};

export default EventDialog;
