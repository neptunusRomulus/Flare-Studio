import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X, Save } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { type QuestDraft } from '@/hooks/useAppMainState';
import { askConfirm } from '@/components/ui/inline-confirm';
import QuestStepCards from '@/components/QuestStepCards';
import {
  completeStatusKey,
  flattenFirstStep,
  slugQuestId,
  stepsFromImported,
  type QuestStep,
} from '@/editor/questSteps';

export type { QuestDraft };

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
    [itemsList],
  );

  const questId = slugQuestId(questDraft.id || questDraft.name || 'quest');
  const completeStatus = questDraft.complete_status || completeStatusKey(questId);
  const steps: QuestStep[] = React.useMemo(() => {
    if (Array.isArray(questDraft.steps) && questDraft.steps.length) return questDraft.steps;
    const flat = stepsFromImported([{ ...questDraft, blockIndex: 0 }]);
    return questDraft.quest_text || questDraft.requires_status ? flat : [];
  }, [questDraft]);

  const setSteps = (next: QuestStep[]) => {
    const first = flattenFirstStep(next);
    setQuestDraft((prev) => ({
      ...prev,
      ...first,
      complete_status: prev.complete_status || completeStatus,
      steps: next,
    }));
  };

  const [nameError, setNameError] = React.useState('');
  const nameIsValid = Boolean(questDraft.name?.trim());

  const questBaseline = React.useRef('');
  React.useEffect(() => {
    if (!open) {
      setNameError('');
      return;
    }
    questBaseline.current = JSON.stringify(questDraft);
  }, [open]);

  const requestClose = async () => {
    if (JSON.stringify(questDraft) !== questBaseline.current) {
      if (!(await askConfirm('Discard changes?'))) return;
    }
    onOpenChange(false);
  };

  const saveQuest = () => {
    if (!nameIsValid) {
      setNameError('Name is required.');
      return;
    }
    onSave();
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
        <h3 className="text-lg font-semibold">Quest Editor</h3>
        <div className="flex items-center gap-2">
          <Tooltip content="Close" side="top">
            <Button
              size="icon"
              variant="ghost"
              onClick={requestClose}
              className="h-9 w-9 text-foreground/70 hover:text-foreground"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-5 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-1">
              Name
              <Tooltip content="name — Shown in the quest log.">
                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </Tooltip>
            </label>
            <Input
              value={questDraft.name}
              onChange={(e) => {
                const value = e.target.value;
                setQuestDraft((prev) => ({ ...prev, name: value }));
                if (nameError && value.trim()) setNameError('');
              }}
              placeholder="Quest Name"
              className={`h-10 ${nameError ? 'border-destructive text-destructive focus:border-destructive focus-visible:ring-destructive/30' : ''}`}
            />
            {nameError ? <p className="mt-1 text-sm text-destructive">{nameError}</p> : null}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-1">Start type</label>
            <Select
              value={questDraft.start_type ?? ''}
              onValueChange={(value) => setQuestDraft((prev) => ({ ...prev, start_type: value as 'player' | 'game' }))}
            >
              <SelectTrigger className="h-10 w-full text-sm">
                <SelectValue placeholder="Select start type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player" className="text-xs">Player</SelectItem>
                <SelectItem value="game" className="text-xs">Game</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Steps</h4>
          <QuestStepCards
            steps={steps}
            onChange={setSteps}
            ctx={{
              questId,
              acceptStatus: steps[0]?.requires_status.split(',')[0]?.trim() || `${questId}_started`,
              completeStatus,
            }}
            items={inventoryItems.map((item: any) => ({ id: String(item.id), name: item.name || item.fileName || String(item.id) }))}
            completeStatus={questDraft.complete_status}
            onCompleteStatusChange={(value) => setQuestDraft((prev) => ({ ...prev, complete_status: value }))}
            rewards={questDraft.when_done || {}}
            onRewardsChange={(when_done) => setQuestDraft((prev) => ({ ...prev, when_done }))}
          />
        </div>
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
