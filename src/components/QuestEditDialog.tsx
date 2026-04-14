import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X, Save } from 'lucide-react';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';

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
  requires_item: string;
  requires_not_item: string;
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
  const updateField = (field: keyof QuestDraft, value: string) => {
    setQuestDraft((prev) => ({ ...prev, [field]: value }));
  };

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
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_item
                  <Tooltip content="Quest requires specific item (not equipped).">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_item}
                  onChange={(e) => updateField('requires_item', e.target.value)}
                  placeholder="comma-separated item IDs"
                  className="h-10"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-1">
                  quest.requires_not_item
                  <Tooltip content="Quest requires not having a specific item (not equipped).">
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
                  </Tooltip>
                </label>
                <Input
                  value={questDraft.requires_not_item}
                  onChange={(e) => updateField('requires_not_item', e.target.value)}
                  placeholder="comma-separated item IDs"
                  className="h-10"
                />
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
