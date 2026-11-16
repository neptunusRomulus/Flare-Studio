import React from 'react';
import { HelpCircle, SquareCheckBig, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import { STORY_FLAG_LIST_ID } from '@/editor/powers/storyFlags';
import EventSectionShell from './EventSectionShell';
import type { EventItemOption, EventItemRequirement, EventSectionProps } from './eventDialogModel';

type Props = EventSectionProps & {
  inventoryItems: EventItemOption[];
  addStatusRequirement: () => void;
  updateStatusRequirement: (_index: number, _value: string) => void;
  removeStatusRequirement: (_index: number) => void;
  addItemRequirement: () => void;
  updateItemRequirement: (_id: string, _updates: Partial<Omit<EventItemRequirement, 'id'>>) => void;
  removeItemRequirement: (_id: string) => void;
};

/** Status checks, minimum level, item requirements and currency. */
export default function EventRequirementsSection({
  eventData,
  setEventData,
  expandedSections,
  toggleSection,
  inventoryItems,
  addStatusRequirement,
  updateStatusRequirement,
  removeStatusRequirement,
  addItemRequirement,
  updateItemRequirement,
  removeItemRequirement,
}: Props) {
  return (
    <EventSectionShell
      title="Requirements"
      icon={SquareCheckBig}
      id="requirements"
      isExpanded={expandedSections.requirements}
      onToggle={() => toggleSection('requirements')}
    >
      <div className="space-y-4">
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
              <Label className="text-xs font-medium text-foreground/80">Status Checks</Label>
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
                  list={STORY_FLAG_LIST_ID}
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

        {/* Minimum Level */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-foreground/80">Minimum Level</Label>
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
            <Input
              type="number"
              min="0"
              value={eventData.requirements.minLevel}
              onChange={e =>
                setEventData(prev => ({
                  ...prev,
                  requirements: { ...prev.requirements, minLevel: Math.max(0, parseInt(e.target.value) || 0) },
                }))
              }
              className="h-7 text-xs font-mono w-16"
            />
          </div>
        </div>

        {/* Item Requirements */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-foreground/80">Item Requirements</Label>
              <Tooltip content="Require or forbid a specific inventory item for this event">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </Tooltip>
            </div>
            <Button size="sm" variant="outline" onClick={addItemRequirement} className="h-6 text-xs">
              + Add
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2">Condition</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventData.requirements.itemRequirements.map((itemReq) => (
                  <tr key={itemReq.id}>
                    <td className="px-2 py-2">
                      <Select
                        value={itemReq.type}
                        onValueChange={(value) => updateItemRequirement(itemReq.id, { type: value as EventItemRequirement['type'] })}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requires_item" className="text-xs">Requires item</SelectItem>
                          <SelectItem value="requires_not_item" className="text-xs">Requires not item</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        value={itemReq.itemId}
                        onValueChange={(value) => updateItemRequirement(itemReq.id, { itemId: value === '__none__' ? '' : value })}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs">None</SelectItem>
                          {inventoryItems.map((item) => (
                            <SelectItem key={`extra-${itemReq.id}-${item.id}`} value={String(item.id)} className="text-xs">
                              {String(item.id)} {item.name || item.fileName || ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={itemReq.itemQuantity}
                          onChange={e => updateItemRequirement(itemReq.id, { itemQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="h-7 text-xs flex-1"
                        />
                        <Button size="icon" variant="ghost" onClick={() => removeItemRequirement(itemReq.id)} className="h-7 w-7">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-foreground/80">Currency Requirement</Label>
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
    </EventSectionShell>
  );
}
