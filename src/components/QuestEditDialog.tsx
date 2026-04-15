import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X, Save } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';

type QuestItemRequirement = {
  id: string;
  type: 'requires_item' | 'requires_not_item';
  itemId: string;
  itemQuantity: number;
};

type QuestDraft = {
  name: string;
  complete_status: string;
  quest_text: string;
  requires_status: string;
  requires_not_status: string;
  requires_level: string;
  requires_not_level: string;
  requires_currency: string;
  requires_not_currency: string;
  itemRequirements: QuestItemRequirement[];
  requires_class: string;
  requires_not_class: string;
};

type QuestEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questDraft: QuestDraft;
  setQuestDraft: React.Dispatch<React.SetStateAction<QuestDraft>>;
  onSave: () => void;
};

const QuestEditDialog = ({ open, onOpenChange, questDraft, setQuestDraft, onSave }: QuestEditDialogProps) => {
  const { itemsList = [] } = useAppContext() as any;
  const inventoryItems = React.useMemo(
    () => (itemsList as any[]).filter((item) => item.role !== 'loot_groups'),
    [itemsList]
  );

  const updateField = (field: keyof QuestDraft, value: string) => {
    setQuestDraft((prev) => ({ ...prev, [field]: value }));
  };

  const addItemRequirement = () => {
    setQuestDraft((prev) => ({
      ...prev,
      itemRequirements: [
        ...prev.itemRequirements,
        {
          id: `item-req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'requires_item',
          itemId: '',
          itemQuantity: 1,
        },
      ],
    }));
  };

  const updateItemRequirement = (id: string, updates: Partial<Omit<QuestItemRequirement, 'id'>>) => {
    setQuestDraft((prev) => ({
      ...prev,
      itemRequirements: (prev.itemRequirements ?? []).map((req) =>
        req.id === id ? { ...req, ...updates } : req
      ),
    }));
  };

  const removeItemRequirement = (id: string) => {
    setQuestDraft((prev) => ({
      ...prev,
      itemRequirements: (prev.itemRequirements ?? []).filter((req) => req.id !== id),
    }));
  };

  const itemRequirements = questDraft.itemRequirements ?? [];

  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'quest_edit_dialog', initialWidth: 860, initialHeight: 680, minWidth: 620, minHeight: 440 });

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="bg-background border border-border/80 rounded-xl flex flex-col shadow-xl"
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
        className="sticky top-0 z-10 border-b border-border/50 bg-background px-5 py-3 flex items-center justify-between gap-3 cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div>
          <h3 className="text-lg font-semibold">Quest Editor</h3>
          <p className="text-sm text-muted-foreground">Define the quest identity and requirements for this layer.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Save Quest" side="top">
            <Button
              size="icon"
              variant="ghost"
              onClick={onSave}
              className="h-9 w-9 text-foreground/70 hover:text-foreground"
              type="button"
            >
              <Save className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Close" side="top">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 text-foreground/70 hover:text-foreground"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-5 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Identity</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  Name
                  <Tooltip content="A displayed name for this quest.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Quest Name"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  Complete Status
                  <Tooltip content="If this status is set, the quest will be displayed as completed.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.complete_status}
                  onChange={(e) => updateField('complete_status', e.target.value)}
                  placeholder="quest_complete"
                  className="h-10"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-1">
                Quest Text
                <Tooltip content="Text that gets displayed in the Quest log when this quest is active.">
                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                </Tooltip>
              </label>
              <textarea
                value={questDraft.quest_text}
                onChange={(e) => updateField('quest_text', e.target.value)}
                placeholder="Enter quest log text"
                className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Requirements</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_status
                  <Tooltip content="Quest requires this campaign status.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_status}
                  onChange={(e) => updateField('requires_status', e.target.value)}
                  placeholder="comma-separated statuses"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_not_status
                  <Tooltip content="Quest requires not having this campaign status.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_not_status}
                  onChange={(e) => updateField('requires_not_status', e.target.value)}
                  placeholder="comma-separated statuses"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_level
                  <Tooltip content="Quest requires hero level.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_level}
                  onChange={(e) => updateField('requires_level', e.target.value)}
                  placeholder="e.g. 5"
                  type="number"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_not_level
                  <Tooltip content="Quest requires not hero level.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_not_level}
                  onChange={(e) => updateField('requires_not_level', e.target.value)}
                  placeholder="e.g. 10"
                  type="number"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_currency
                  <Tooltip content="Quest requires at least this much currency.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_currency}
                  onChange={(e) => updateField('requires_currency', e.target.value)}
                  placeholder="e.g. 100"
                  type="number"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_not_currency
                  <Tooltip content="Quest requires no more than this much currency.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_not_currency}
                  onChange={(e) => updateField('requires_not_currency', e.target.value)}
                  placeholder="e.g. 50"
                  type="number"
                  className="h-10"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-foreground/90">Item Requirements</label>
                    <Tooltip content="Require or forbid a specific inventory item for this quest.">
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" />
                    </Tooltip>
                  </div>
                  <Button size="sm" variant="outline" onClick={addItemRequirement} className="h-8 text-xs">
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
                      {itemRequirements.map((itemReq) => (
                        <tr key={itemReq.id}>
                          <td className="px-2 py-2">
                            <Select
                              value={itemReq.type}
                              onValueChange={(value) => updateItemRequirement(itemReq.id, { type: value as QuestItemRequirement['type'] })}
                            >
                              <SelectTrigger className="h-9 text-xs w-full">
                                <SelectValue placeholder="Condition" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="requires_item" className="text-xs">Requires item</SelectItem>
                                <SelectItem value="requires_not_item" className="text-xs">Requires not item</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <Select
                              value={itemReq.itemId || '__none__'}
                              onValueChange={(value) => updateItemRequirement(itemReq.id, { itemId: value === '__none__' ? '' : value })}
                            >
                              <SelectTrigger className="h-9 text-xs w-full">
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs">None</SelectItem>
                                {inventoryItems.map((item: any) => (
                                  <SelectItem key={`item-${itemReq.id}-${item.id}`} value={String(item.id)} className="text-xs">
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
                                onChange={(e) => updateItemRequirement(itemReq.id, { itemQuantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                className="h-9 text-xs flex-1"
                              />
                              <Button size="icon" variant="ghost" onClick={() => removeItemRequirement(itemReq.id)} className="h-8 w-8">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_class
                  <Tooltip content="Quest requires this base class.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_class}
                  onChange={(e) => updateField('requires_class', e.target.value)}
                  placeholder="Class ID"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_not_class
                  <Tooltip content="Quest requires not this base class.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_not_class}
                  onChange={(e) => updateField('requires_not_class', e.target.value)}
                  placeholder="Class ID"
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="h-5 w-5 self-end cursor-se-resize rounded-br-lg"
          onMouseDown={handleResizeMouseDown}
        />
      </div>
  );
};

export default QuestEditDialog;
