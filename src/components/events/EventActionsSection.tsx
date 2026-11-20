import React from 'react';
import { LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EventSectionShell from './EventSectionShell';
import type { EventItemOption, EventSectionProps } from './eventDialogModel';
import { HintLabel } from '@/components/ui/field-hint';

type Props = EventSectionProps & {
  inventoryItems: EventItemOption[];
  itemGroups: EventItemOption[];
  projectMaps: string[];
  currentMapName: string;
};

/** Message, EXP, inventory/loot effects, spawn, teleport and sound. */
export default function EventActionsSection({
  eventData,
  setEventData,
  expandedSections,
  toggleSection,
  inventoryItems,
  itemGroups,
  projectMaps,
  currentMapName,
}: Props) {
  return (
    <EventSectionShell
      title="Actions and Rewards"
      icon={LogIn}
      id="actions-and-rewards"
      isExpanded={expandedSections.rewards}
      onToggle={() => toggleSection('rewards')}
    >
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Actions and Rewards</h3>

        {/* Message */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground/80">Message</Label>
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
          <Label className="text-xs font-medium text-foreground/80">EXP Reward</Label>
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

        {/* Inventory and Loot Effects */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HintLabel className="text-xs font-medium text-foreground/80" hint={"Take or give items, currency, or item groups when this event triggers"}>Inventory & Loot Effects</HintLabel>
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2">Effect</th>
                  <th className="px-2 py-2">Item / Group</th>
                  <th className="px-2 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-2 py-2">Give gold</td>
                  <td className="px-2 py-2 text-muted-foreground">Currency</td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      value={eventData.rewards.rewardCurrency}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, rewardCurrency: Math.max(0, parseInt(e.target.value) || 0) },
                        }))
                      }
                      className="h-7 text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-2">Take gold</td>
                  <td className="px-2 py-2 text-muted-foreground">Currency</td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      value={eventData.rewards.removeCurrency}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, removeCurrency: Math.max(0, parseInt(e.target.value) || 0) },
                        }))
                      }
                      className="h-7 text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-2">Give item</td>
                  <td className="px-2 py-2">
                    <Select
                      value={eventData.rewards.rewardItemId}
                      onValueChange={(value) =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, rewardItemId: value === '__none__' ? '' : value },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">None</SelectItem>
                        {inventoryItems.map((item) => (
                          <SelectItem key={`give-${item.id}`} value={String(item.id)} className="text-xs">
                            {String(item.id)} {item.name || item.fileName || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="1"
                      value={eventData.rewards.rewardItemQuantity}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, rewardItemQuantity: Math.max(1, parseInt(e.target.value) || 1) },
                        }))
                      }
                      className="h-7 text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-2">Take item</td>
                  <td className="px-2 py-2">
                    <Select
                      value={eventData.rewards.removeItemId}
                      onValueChange={(value) =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, removeItemId: value === '__none__' ? '' : value },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">None</SelectItem>
                        {inventoryItems.map((item) => (
                          <SelectItem key={`take-${item.id}`} value={String(item.id)} className="text-xs">
                            {String(item.id)} {item.name || item.fileName || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="1"
                      value={eventData.rewards.removeItemQuantity}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, removeItemQuantity: Math.max(1, parseInt(e.target.value) || 1) },
                        }))
                      }
                      className="h-7 text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-2">Loot table</td>
                  <td className="px-2 py-2" colSpan={2}>
                    <Select
                      value={eventData.rewards.lootGroup}
                      onValueChange={(value) =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, lootGroup: value === '__none__' ? '' : value },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select loot group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">None</SelectItem>
                        {itemGroups.map((group) => (
                          <SelectItem key={`loot-${group.id}`} value={String(group.id)} className="text-xs">
                            {String(group.id)} {group.name || group.fileName || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-2">Random loot reward</td>
                  <td className="px-2 py-2">
                    <Select
                      value={eventData.rewards.rewardLootGroup}
                      onValueChange={(value) =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, rewardLootGroup: value === '__none__' ? '' : value },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select loot group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">None</SelectItem>
                        {itemGroups.map((group) => (
                          <SelectItem key={`reward-loot-${group.id}`} value={String(group.id)} className="text-xs">
                            {String(group.id)} {group.name || group.fileName || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2 grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      min="1"
                      value={eventData.rewards.rewardLootCountMin}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, rewardLootCountMin: Math.max(1, parseInt(e.target.value) || 1) },
                        }))
                      }
                      className="h-7 text-xs"
                      placeholder="Min"
                    />
                    <Input
                      type="number"
                      min="1"
                      value={eventData.rewards.rewardLootCountMax}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, rewardLootCountMax: Math.max(1, parseInt(e.target.value) || 1) },
                        }))
                      }
                      className="h-7 text-xs"
                      placeholder="Max"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Enemy Spawn */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground/80">Enemy Spawn</Label>
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
          <Label className="text-xs font-medium text-foreground/80">Teleport</Label>
          <div className="flex items-center gap-2">
            <Select
              value={eventData.rewards.teleportMap}
              onValueChange={val =>
                setEventData(prev => ({
                  ...prev,
                  rewards: { ...prev.rewards, teleportMap: val === '__none__' ? '' : val },
                }))
              }
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Select map" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">None</SelectItem>
                {projectMaps.map((mapFile: string) => {
                  const mapLabel = mapFile.replace(/\.(txt|json)$/i, '');
                  const isCurrent = mapLabel === currentMapName;
                  return (
                    <SelectItem key={mapFile} value={mapLabel} className={`text-xs ${isCurrent ? 'text-orange-400' : ''}`}>
                      {mapLabel}{isCurrent ? ' (current)' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div>
              <Label className="text-[10px] text-muted-foreground">X</Label>
              <Input
                type="number"
                value={eventData.rewards.teleportX}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, teleportX: parseInt(e.target.value) || 0 },
                  }))
                }
                placeholder="Coordinate X"
                className="h-7 text-xs w-24"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Y</Label>
              <Input
                type="number"
                value={eventData.rewards.teleportY}
                onChange={e =>
                  setEventData(prev => ({
                    ...prev,
                    rewards: { ...prev.rewards, teleportY: parseInt(e.target.value) || 0 },
                  }))
                }
                placeholder="Coordinate Y"
                className="h-7 text-xs w-24"
              />
            </div>
          </div>
        </div>

        {/* Sound */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground/80">Sound File</Label>
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
    </EventSectionShell>
  );
}
