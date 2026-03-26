import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpCircle, X, Save } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';

type EventActivation = 'Trigger' | 'Interact' | 'Load' | 'Leave' | 'Mapexit' | 'Clear' | 'Static';

type EventData = {
  positioning: {
    mapName: string;
    coordinates: { x: number; y: number };
    size: { width: number; height: number };
    hotspot: { x: number; y: number; width: number; height: number };
  };
  timing: {
    activations: EventActivation[];
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

const ACTIVATION_OPTIONS: EventActivation[] = ['Trigger', 'Interact', 'Load', 'Leave', 'Mapexit', 'Clear', 'Static'];

const EventDialog: React.FC<EventDialogProps> = ({ open, onOpenChange, eventLocation }) => {
  const [eventData, setEventData] = useState<EventData>({
    positioning: {
      mapName: '',
      coordinates: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      hotspot: { x: 0, y: 0, width: 1, height: 1 },
    },
    timing: {
      activations: [],
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

  const toggleActivation = (activation: EventActivation) => {
    setEventData(prev => ({
      ...prev,
      timing: {
        ...prev.timing,
        activations: prev.timing.activations.includes(activation)
          ? prev.timing.activations.filter(a => a !== activation)
          : [...prev.timing.activations, activation],
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

  const titleCoords = eventLocation ? `${eventLocation.x},${eventLocation.y}` : '0,0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col h-[90vh] w-[90vw] sm:h-[90vh] sm:w-auto sm:max-w-6xl bg-background border-border/70 p-0 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Event at {titleCoords}</DialogTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 text-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted/70 [&::-webkit-scrollbar-thumb]:rounded-full">
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ACTIVATION_OPTIONS.map(activation => (
                  <button
                    key={activation}
                    onClick={() => toggleActivation(activation)}
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      eventData.timing.activations.includes(activation)
                        ? 'border-orange-500/50 bg-orange-500/10 text-foreground'
                        : 'border-border/50 bg-muted/30 text-foreground/60 hover:bg-muted/50'
                    }`}
                  >
                    {activation}
                  </button>
                ))}
              </div>
            </div>

            {/* Location and Size */}
            <div className="space-y-2">
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
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        positioning: { ...prev.positioning, mapName: e.target.value },
                      }))
                    }
                    placeholder="Map name"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <Input
                      type="number"
                      value={eventData.positioning.coordinates.x}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          positioning: {
                            ...prev.positioning,
                            coordinates: { ...prev.positioning.coordinates, x: parseInt(e.target.value) || 0 },
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
                      value={eventData.positioning.coordinates.y}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          positioning: {
                            ...prev.positioning,
                            coordinates: { ...prev.positioning.coordinates, y: parseInt(e.target.value) || 0 },
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
                    value={eventData.positioning.size.width}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        positioning: {
                          ...prev.positioning,
                          size: { ...prev.positioning.size, width: Math.max(1, parseInt(e.target.value) || 1) },
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
                    value={eventData.positioning.size.height}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        positioning: {
                          ...prev.positioning,
                          size: { ...prev.positioning.size, height: Math.max(1, parseInt(e.target.value) || 1) },
                        },
                      }))
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Hotspot */}
            <div className="space-y-2">
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
                    value={eventData.positioning.hotspot.x}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        positioning: {
                          ...prev.positioning,
                          hotspot: { ...prev.positioning.hotspot, x: parseInt(e.target.value) || 0 },
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
                    value={eventData.positioning.hotspot.y}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        positioning: {
                          ...prev.positioning,
                          hotspot: { ...prev.positioning.hotspot, y: parseInt(e.target.value) || 0 },
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
      </DialogContent>
    </Dialog>
  );
};

export default EventDialog;
