import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, HelpCircle, X, Save } from 'lucide-react';
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
  start_type?: 'player' | 'game';
};

type QuestEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questDraft: QuestDraft;
  setQuestDraft: React.Dispatch<React.SetStateAction<QuestDraft>>;
  onSave: () => void;
};

const CollapsibleSection = ({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  className = ''
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={`space-y-3 border-b border-border/50 pb-4 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between group py-1"
      >
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-orange-500" />
          {title}
        </h4>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>
      {isOpen && <div className="animate-in fade-in slide-in-from-top-1 duration-200">{children}</div>}
    </div>
  );
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

  const [nameError, setNameError] = React.useState('');
  const nameIsValid = Boolean(questDraft.name?.trim());

  React.useEffect(() => {
    if (!open) {
      setNameError('');
    }
  }, [open]);

  const saveQuest = () => {
    if (!nameIsValid) {
      setNameError('Name is required.');
      return;
    }
    onSave();
  };

  const itemRequirements = questDraft.itemRequirements ?? [];

  const startTypeOptions = [
    { value: 'player', label: 'Player' },
    { value: 'game', label: 'Game' },
  ] as const;
  const parseStatuses = (value: string) => value.split(/\s*,\s*/).filter(Boolean);
  const requiredStatuses = parseStatuses(questDraft.requires_status);
  const excludedStatuses = parseStatuses(questDraft.requires_not_status);
  const flowSummary = [
    `Quest name: ${questDraft.name || 'Unnamed quest'}`,
    questDraft.start_type ? `Start type: ${questDraft.start_type}` : 'Start type: not selected',
    questDraft.complete_status ? `Complete status: ${questDraft.complete_status}` : 'Complete status: not set',
    requiredStatuses.length ? `Available when statuses are set: ${requiredStatuses.join(', ')}` : 'No required statuses defined',
    excludedStatuses.length ? `Unavailable when statuses are set: ${excludedStatuses.join(', ')}` : 'No excluded statuses defined',
    itemRequirements.length ? `Item requirements: ${itemRequirements.map((req) => `${req.type === 'requires_item' ? 'Needs' : 'Must not have'} ${req.itemQuantity}x ${req.itemId || 'Unknown item'}`).join('; ')}` : 'No item requirements defined',
  ];

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
          <CollapsibleSection title="Identity" icon={HelpCircle} className="rounded-xl border border-border bg-muted/50 p-4" defaultOpen={false}>
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
                  onChange={(e) => {
                    const value = e.target.value;
                    updateField('name', value);
                    if (nameError && value.trim()) {
                      setNameError('');
                    }
                  }}
                  placeholder="Quest Name"
                  className={`h-10 ${nameError ? 'border-destructive text-destructive focus:border-destructive focus-visible:ring-destructive/30' : ''}`}
                />
                {nameError ? <p className="mt-1 text-sm text-destructive">{nameError}</p> : null}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  Start Type
                  <Tooltip content="Choose whether this quest is triggered by player action or game events.">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Select
                  value={questDraft.start_type ?? ''}
                  onValueChange={(value) => updateField('start_type', value)}
                >
                  <SelectTrigger className="h-10 w-full text-sm">
                    <SelectValue placeholder="Select start type" />
                  </SelectTrigger>
                  <SelectContent>
                    {startTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          </CollapsibleSection>

          <CollapsibleSection title="Requirements" icon={HelpCircle} className="rounded-xl border border-border bg-muted/50 p-4" defaultOpen={false}>
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
          </CollapsibleSection>

          <CollapsibleSection title="Quest Flow" icon={HelpCircle} className="rounded-xl border border-border bg-muted/50 p-4" defaultOpen={false}>
            <p className="text-sm text-muted-foreground mb-4">This flow is inferred from quest requirements, start type, and completion status. Use it to understand how statuses, item requirements, and completion are connected.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Availability</p>
                <p className="text-sm">{requiredStatuses.length ? requiredStatuses.join(', ') : 'No required statuses'}</p>
                <p className="text-sm text-muted-foreground mt-2">Requires all of these statuses to be set.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Exclusion</p>
                <p className="text-sm">{excludedStatuses.length ? excludedStatuses.join(', ') : 'No excluded statuses'}</p>
                <p className="text-sm text-muted-foreground mt-2">Quest is hidden when any of these statuses are active.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Completion</p>
                <p className="text-sm">{questDraft.complete_status || 'Completion status not set'}</p>
                <p className="text-sm text-muted-foreground mt-2">Quest is considered complete when this status is set.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Requirements</p>
                <p className="text-sm">
                  {itemRequirements.length
                    ? itemRequirements.map((req) => `${req.type === 'requires_item' ? 'Needs' : 'Must not have'} ${req.itemQuantity}× ${req.itemId || 'Unknown item'}`).join('; ')
                    : 'No item requirements'}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm">
              <p className="font-semibold mb-2">Flow summary</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {flowSummary.map((line, index) => (
                  <li key={`flow-summary-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          </CollapsibleSection>
        </div>

        <div className="flex justify-end border-t border-border/50 bg-background px-4 py-4">
          <Button
            size="icon"
            variant="default"
            onClick={saveQuest}
            disabled={!nameIsValid}
            className="h-10 w-10 rounded-full bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-400 disabled:bg-orange-200 disabled:text-white/60"
            type="button"
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>

        <div
          className="h-5 w-5 self-end cursor-se-resize rounded-br-lg"
          onMouseDown={handleResizeMouseDown}
        />
      </div>
  );
};

export default QuestEditDialog;
