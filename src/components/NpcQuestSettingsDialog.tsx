import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { toast } from '@/hooks/use-toast';
import { Check, HelpCircle, Plus, Save, Trash2, X } from 'lucide-react';
import type { DialogueTree } from '@/types';
import type { ItemSummary } from '@/utils/items';
import ResizeHandle from '@/components/ResizeHandle';
import {
  buildQuestFlowTrees,
  questAcceptDialogueId,
  questFlowFromLegacy,
  questTurnInDialogueId,
  readQuestFlowTrees,
  type QuestFlowInput,
  type QuestTurnInMode,
} from '@/editor/questFlow';
import { canonicalJson, contentSlug, importQuestText, mergeQuestText } from '@/adapters/flare/flareAdapter.cjs';
import { projectRoot, writeProjectFiles } from '@/editor/projectFiles';
import QuestStepCards from '@/components/QuestStepCards';
import {
  alignStepsWithRole,
  createFirstStep,
  stepsFromImported,
  type QuestStep,
} from '@/editor/questSteps';

type NpcQuestSettingsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  itemsList: ItemSummary[];
  npcName?: string;
  projectPath?: string | null;
  dialogueTrees: DialogueTree[];
  setDialogueTrees: (trees: DialogueTree[]) => void;
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
  /** Render inside the role center instead of a floating window. */
  embedded?: boolean;
};

const cleanTrees = (trees: DialogueTree[]) =>
  trees.map((tree) => Object.fromEntries(Object.entries(tree).filter(([key]) => !key.startsWith('_'))));

const NpcQuestSettingsDialog = ({
  isOpen,
  onClose,
  itemsList,
  npcName = '',
  projectPath = null,
  dialogueTrees,
  setDialogueTrees,
  getEditingObjectProperty,
  updateEditingObjectProperty,
  embedded = false,
}: NpcQuestSettingsDialogProps) => {
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'npc_quest_settings_dialog', initialWidth: 720, initialHeight: 600, minWidth: 580, minHeight: 460 });

  const [flow, setFlow] = useState<QuestFlowInput>(() => questFlowFromLegacy('', {}));
  const [journalSteps, setJournalSteps] = useState<QuestStep[]>([]);
  const [writeJournal, setWriteJournal] = useState(true);
  const roleSnapshot = useRef({ acceptStatus: '', completeStatus: '' });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!isOpen && !embedded) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;

    const stored = readQuestFlowTrees(dialogueTrees);
    const legacy = {
      requires: getEditingObjectProperty('questRequiresStatus', ''),
      set: getEditingObjectProperty('questSetStatus', ''),
      loot: getEditingObjectProperty('quest_loot', ''),
    };
    const fallback = questFlowFromLegacy(npcName || 'NPC', legacy);
    const next = stored ? { ...fallback, ...stored } : fallback;
    setFlow({
      ...next,
      questId: contentSlug(next.questId || npcName || 'quest', 'quest'),
      questName: next.questName || fallback.questName,
      items: next.items?.length ? next.items : fallback.items,
    });
    setJournalSteps([]);
    setWriteJournal(true);
    setConfirmRemove(false);
    setSaving(false);

    roleSnapshot.current = {
      acceptStatus: next.acceptStatus || '',
      completeStatus: next.completeStatus || '',
    };

    const loadJournal = async () => {
      const questId = contentSlug(next.questId || npcName || 'quest', 'quest');
      if (!projectPath || !questId) return;
      const api = window.electronAPI;
      if (!api?.readFile) return;
      const root = projectRoot(projectPath);
      const existingText = (await api.readFile(`${root}/quests/${questId}.txt`)) || '';
      if (!existingText.trim()) return;
      const parsed = importQuestText(existingText) as { steps?: unknown[] };
      setJournalSteps(stepsFromImported(parsed.steps));
    };
    void loadJournal();
  }, [isOpen, embedded, dialogueTrees, npcName, getEditingObjectProperty, projectPath]);

  if (!isOpen && !embedded) return null;

  const set = <K extends keyof QuestFlowInput>(key: K, value: QuestFlowInput[K]) =>
    setFlow((prev) => ({ ...prev, [key]: value }));

  const setItem = (index: number, patch: { id?: string; quantity?: string }) =>
    setFlow((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const removeItem = (index: number) =>
    setFlow((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const writeJournalEntry = async (input: QuestFlowInput) => {
    if (!projectPath) {
      toast({ title: 'Quest file not written', description: 'Open a project folder first.', variant: 'destructive' });
      return;
    }
    const api = window.electronAPI;
    const root = projectRoot(projectPath);
    const rel = `quests/${input.questId}.txt`;
    const existingText = api?.readFile ? ((await api.readFile(`${root}/${rel}`)) || '') : '';
    const aligned = alignStepsWithRole(
      journalSteps.length
        ? journalSteps
        : [createFirstStep(
            { questId: input.questId, acceptStatus: input.acceptStatus, completeStatus: input.completeStatus },
            input.questName,
          )],
      {
        acceptStatus: input.acceptStatus,
        completeStatus: input.completeStatus,
        previousAccept: roleSnapshot.current.acceptStatus,
        previousComplete: roleSnapshot.current.completeStatus,
      },
      input.questId,
    );
    const text = mergeQuestText(existingText, {
      name: input.questName,
      complete_status: input.completeStatus,
      steps: aligned,
    });
    roleSnapshot.current = { acceptStatus: input.acceptStatus, completeStatus: input.completeStatus };

    let stored: Record<string, unknown> = {};
    if (api?.readFile) {
      try {
        const raw = await api.readFile(`${root}/content/quests/${input.questId}.json`);
        if (raw) stored = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        stored = {};
      }
    }
    const payload = {
      ...stored,
      id: input.questId,
      name: input.questName,
      complete_status: input.completeStatus,
      requires_status: input.acceptStatus,
      ...(aligned[0]?.quest_text ? { quest_text: aligned[0].quest_text } : {}),
    };
    const saved = await writeProjectFiles(projectPath, [
      { path: rel, content: text },
      { path: `content/quests/${input.questId}.json`, content: canonicalJson('quest', payload) },
    ]);
    if (!saved) {
      toast({ title: 'Quest file not written', description: 'Could not write the quests folder.', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const questName = flow.questName.trim();
    const acceptStatus = flow.acceptStatus.trim();
    if (!questName || !acceptStatus) {
      toast({ title: 'Quest needs a name and an accept status', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const input: QuestFlowInput = {
      ...flow,
      questId: contentSlug(flow.questId || questName, 'quest'),
      questName,
      acceptStatus,
      completeStatus: flow.completeStatus.trim() || `${contentSlug(flow.questId || questName, 'quest')}_complete`,
    };
    const trees = buildQuestFlowTrees(input, dialogueTrees);
    setDialogueTrees(trees);
    updateEditingObjectProperty('dialogueTrees', JSON.stringify(cleanTrees(trees)));
    updateEditingObjectProperty('talker', 'true');
    updateEditingObjectProperty('questGiver', 'true');
    if (writeJournal) await writeJournalEntry(input);
    setSaving(false);
    onClose();
  };

  const removeQuestTopics = () => {
    const questId = contentSlug(flow.questId || flow.questName, 'quest');
    const keep = dialogueTrees.filter(
      (tree) => tree.dialogueId !== questAcceptDialogueId(questId) && tree.dialogueId !== questTurnInDialogueId(questId),
    );
    setDialogueTrees(keep);
    updateEditingObjectProperty('dialogueTrees', keep.length ? JSON.stringify(cleanTrees(keep)) : null);
    setConfirmRemove(false);
    onClose();
  };

  const fieldLabel = (label: string, tooltip: string) => (
    <label className="flex items-center gap-1 text-sm font-medium mb-1">
      {label}
      <Tooltip content={tooltip}>
        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
      </Tooltip>
    </label>
  );

  const frame = (
    <div
      ref={dialogRef}
      className={embedded ? 'flex flex-col w-full h-full min-h-0' : 'bg-background border border-border/70 rounded-lg flex flex-col shadow-xl'}
      style={embedded ? { pointerEvents: 'auto' } : {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 60,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!embedded && (
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Quest</h3>
        </div>
        <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-transparent" onClick={onClose}>
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              {fieldLabel('Quest name', 'name — Shown in the quest log and as the dialogue topic.')}
              <Input
                className="h-10 text-sm"
                value={flow.questName}
                onChange={(e) => set('questName', e.target.value)}
                placeholder="The Old Mill"
              />
            </div>
            <div>
              {fieldLabel('Quest file', 'quests/<id>.txt — Journal entry file for this quest.')}
              <Input
                className="h-10 text-sm"
                value={flow.questId}
                onChange={(e) => set('questId', e.target.value)}
                placeholder="old_mill"
              />
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border p-3 space-y-2">
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-semibold">Quest flow</h4>
            <Tooltip content="Flare has no quest keys: the journal entry requires the accept status, and the turn-in topic sets the complete status. Each step here writes those statuses.">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </Tooltip>
          </div>
          <div className="flex items-stretch gap-1">
            {[
              {
                title: 'Not started',
                hint: 'requires_status on the accept topic. Empty means the quest is always offered.',
                value: flow.prereqStatus,
                onChange: (value: string) => set('prereqStatus', value),
                placeholder: 'optional',
                tone: 'text-muted-foreground',
              },
              {
                title: 'In progress',
                hint: 'set_status written when the player accepts; also the quest file requires_status.',
                value: flow.acceptStatus,
                onChange: (value: string) => set('acceptStatus', value),
                placeholder: 'mill_started',
                tone: 'text-sky-600 dark:text-sky-400',
              },
              {
                title: 'Ready',
                hint: 'complete_status. Gameplay (events, kills) sets this; the turn-in topic waits for it in "Objective complete" mode.',
                value: flow.completeStatus,
                onChange: (value: string) => set('completeStatus', value),
                placeholder: 'mill_complete',
                tone: 'text-amber-600 dark:text-amber-400',
              },
            ].map((step, index) => (
              <React.Fragment key={step.title}>
                <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/20 p-1.5">
                  <div className={`text-[10px] font-semibold ${step.tone} flex items-center gap-1`}>
                    {index + 1}. {step.title}
                    <Tooltip content={step.hint}>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </Tooltip>
                  </div>
                  <Input
                    className="h-7 mt-1 text-xs font-mono"
                    value={step.value}
                    onChange={(e) => step.onChange(e.target.value)}
                    placeholder={step.placeholder}
                  />
                </div>
                <div className="flex items-center text-muted-foreground shrink-0">
                  <span className="text-xs">›</span>
                </div>
              </React.Fragment>
            ))}
            <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/20 p-1.5">
              <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                4. Done
                <Tooltip content="Status set after the reward when one-time reward is on; a second turn-in is blocked by it.">
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </Tooltip>
              </div>
              <div className="h-7 mt-1 flex items-center text-xs font-mono truncate text-muted-foreground">
                {flow.oneTimeReward ? `${contentSlug(flow.questId || flow.questName, 'quest')}_rewarded` : '—'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {flow.turnInMode === 'complete'
              ? 'Turn-in waits for the Ready status; the NPC only completes the quest once gameplay sets it.'
              : 'Turn-in works as soon as the quest is accepted and sets the Ready status itself.'}
          </p>
        </section>

        <section className="rounded-md border border-border p-3 space-y-3">
          <h4 className="text-sm font-semibold">Give quest</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              {fieldLabel('Player must have', 'requires_status — Optional status the player needs before this topic appears.')}
              <Input
                className="h-10 text-sm"
                value={flow.prereqStatus}
                onChange={(e) => set('prereqStatus', e.target.value)}
                placeholder="met_miller"
              />
            </div>
            <div>
              {fieldLabel('Status set on accept', 'set_status — Written as a dialog action when the player accepts.')}
              <Input
                className="h-10 text-sm"
                value={flow.acceptStatus}
                onChange={(e) => set('acceptStatus', e.target.value)}
                placeholder="mill_started"
              />
            </div>
          </div>
          <div>
            {fieldLabel('NPC line', 'him — First line of the accept topic.')}
            <Input
              className="h-10 text-sm"
              value={flow.acceptLine}
              onChange={(e) => set('acceptLine', e.target.value)}
              placeholder="I have a task for you."
            />
          </div>
        </section>

        <section className="rounded-md border border-border p-3 space-y-3">
          <h4 className="text-sm font-semibold">Turn in</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              {fieldLabel('Available when', 'requires_status — "Quest accepted" lets the player finish right away; "Objective complete" waits for the complete status.')}
              <select
                className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                value={flow.turnInMode}
                onChange={(e) => set('turnInMode', e.target.value as QuestTurnInMode)}
              >
                <option value="accept">Quest accepted</option>
                <option value="complete">Objective complete</option>
              </select>
            </div>
            <div>
              {fieldLabel('Complete status', 'complete_status — Status that marks the quest as complete.')}
              <Input
                className="h-10 text-sm"
                value={flow.completeStatus}
                onChange={(e) => set('completeStatus', e.target.value)}
                placeholder="mill_complete"
              />
            </div>
          </div>
          <div>
            {fieldLabel('NPC line', 'him — First line of the turn-in topic.')}
            <Input
              className="h-10 text-sm"
              value={flow.turnInLine}
              onChange={(e) => set('turnInLine', e.target.value)}
              placeholder="Well done. Here is your reward."
            />
          </div>
        </section>

        <section className="rounded-md border border-border p-3 space-y-3">
          <h4 className="text-sm font-semibold">Rewards</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              {fieldLabel('XP', 'reward_xp — Experience given on turn-in.')}
              <Input className="h-10 text-sm" value={flow.xp} onChange={(e) => set('xp', e.target.value)} placeholder="150" />
            </div>
            <div>
              {fieldLabel('Currency', 'reward_currency — Gold given on turn-in.')}
              <Input className="h-10 text-sm" value={flow.currency} onChange={(e) => set('currency', e.target.value)} placeholder="40" />
            </div>
          </div>

          <div className="space-y-2">
            {flow.items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  className="h-9 flex-1 px-2 rounded-md border border-input bg-background text-sm"
                  value={item.id}
                  onChange={(e) => setItem(index, { id: e.target.value })}
                >
                  <option value="">Pick an item</option>
                  {itemsList.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name || `Item ${entry.id}`}</option>
                  ))}
                </select>
                <Input
                  className="h-9 w-20 text-sm"
                  value={item.quantity}
                  onChange={(e) => setItem(index, { quantity: e.target.value })}
                  placeholder="1"
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeItem(index)}>
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setFlow((prev) => ({ ...prev, items: [...prev.items, { id: '', quantity: '1' }] }))}
            >
              <Plus className="w-3 h-3" />
              Add item
            </Button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={flow.oneTimeReward}
              onChange={(e) => set('oneTimeReward', e.target.checked)}
            />
            One-time reward
            <Tooltip content={`Adds a status guard (${flow.questId || 'quest'}_rewarded / complete status) so the reward cannot be claimed twice.`}>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </Tooltip>
          </label>
        </section>

        <section className="rounded-md border border-border p-3 space-y-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={writeJournal}
              onChange={(e) => setWriteJournal(e.target.checked)}
            />
            Write quest log entry
            <Tooltip content="Creates or merges quests/<id>.txt. Accept and turn-in statuses line up with the steps. Other keys and comments stay.">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </Tooltip>
          </label>
          {writeJournal && (
            <QuestStepCards
              steps={journalSteps}
              onChange={setJournalSteps}
              ctx={{
                questId: contentSlug(flow.questId || flow.questName || 'quest', 'quest'),
                acceptStatus: flow.acceptStatus,
                completeStatus: flow.completeStatus,
              }}
              items={itemsList.map((entry) => ({ id: entry.id, name: entry.name || `Item ${entry.id}` }))}
            />
          )}
        </section>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <InlineConfirm
          open={confirmRemove}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={removeQuestTopics}
          message="Remove quest topics?"
        >
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive"
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
        </InlineConfirm>
        <Button size="sm" className="gap-1" onClick={() => void handleSave()} disabled={saving}>
          <Save className="w-4 h-4" />
          Save
        </Button>
      </div>

      {!embedded && (
      <ResizeHandle onMouseDown={handleResizeMouseDown} />
      )}
    </div>
  );

  if (embedded) return frame;
  return createPortal(frame, document.body);
};

export default NpcQuestSettingsDialog;
