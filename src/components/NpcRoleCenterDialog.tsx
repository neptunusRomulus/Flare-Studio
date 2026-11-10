import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, HandCoins, MessageCircleQuestionMark, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import type { DialogueTree, MapObject } from '@/types';
import type { ItemSummary } from '@/utils/items';
import DialogueTreeDialog from '@/components/dialogue/DialogueTreeDialog';
import NpcVendorSettingsDialog from '@/components/NpcVendorSettingsDialog';
import NpcQuestSettingsDialog from '@/components/NpcQuestSettingsDialog';
import { dialogueSummary, questSummary, vendorSummary } from '@/editor/roleSummary';
import { readQuestFlowTrees } from '@/editor/questFlow';
import {
  addCustomMoment,
  assignTopicsToMoments,
  buildMoments,
  OTHER_MOMENT_ID,
  type RoleMoment,
} from '@/editor/roleMoments';
import { stepsFromImported, type QuestStep } from '@/editor/questSteps';
import { importQuestText, contentSlug } from '@/adapters/flare/flareAdapter.cjs';
import { projectRoot } from '@/editor/projectFiles';
import MomentsStrip from '@/components/MomentsStrip';
import ResizeHandle from '@/components/ResizeHandle';

export type RoleCenterTab = 'dialogue' | 'vendor' | 'quest';

type Props = {
  tab: RoleCenterTab | null;
  onTabChange: (tab: RoleCenterTab | null) => void;
  editingObject: MapObject | null;
  itemsList: ItemSummary[];
  projectPath?: string | null;
  projectMaps?: string[];
  dialogueTrees: DialogueTree[];
  setDialogueTrees: (trees: DialogueTree[]) => void;
  activeDialogueTab: number;
  setActiveDialogueTab: (index: number) => void;
  dialogueTabToDelete: number | null;
  setDialogueTabToDelete: (index: number | null) => void;
  onCreateVendorStockGroup: (stockType: 'constant' | 'status' | 'random', selectedGroupId: string | null, npcName: string) => Promise<ItemSummary | null>;
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
};

const tabMeta: Record<RoleCenterTab, { label: string; tone: string; Icon: React.ComponentType<{ className?: string }> }> = {
  dialogue: { label: 'Dialogue', tone: 'text-blue-600 dark:text-blue-400 bg-blue-500/15 border-blue-500/40', Icon: MessageSquare },
  vendor: { label: 'Shop', tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/40', Icon: HandCoins },
  quest: { label: 'Quest', tone: 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/40', Icon: MessageCircleQuestionMark },
};

/** One window for the three NPC roles; each tab is the same editor as before, without its own frame. */
const NpcRoleCenterDialog = ({
  tab,
  onTabChange,
  editingObject,
  itemsList,
  projectPath = null,
  projectMaps,
  dialogueTrees,
  setDialogueTrees,
  activeDialogueTab,
  setActiveDialogueTab,
  dialogueTabToDelete,
  setDialogueTabToDelete,
  onCreateVendorStockGroup,
  getEditingObjectProperty,
  updateEditingObjectProperty,
}: Props) => {
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'npc_role_center_dialog', initialWidth: 900, initialHeight: 660, minWidth: 720, minHeight: 520 });

  const [customMoments, setCustomMoments] = useState<RoleMoment[]>([]);
  const [journalSteps, setJournalSteps] = useState<QuestStep[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<string>('');
  const npcKey = editingObject?.id || editingObject?.name || '';

  useEffect(() => {
    setCustomMoments([]);
    setJournalSteps([]);
    setSelectedMomentId('');
  }, [npcKey]);

  const questFlow = useMemo(() => readQuestFlowTrees(dialogueTrees), [dialogueTrees]);

  useEffect(() => {
    let cancelled = false;
    const questId = questFlow?.questId;
    if (!projectPath || !questId) {
      setJournalSteps([]);
      return;
    }
    const api = window.electronAPI;
    if (!api?.readFile) return;
    const root = projectRoot(projectPath);
    const file = `${root}/quests/${contentSlug(questId, 'quest')}.txt`;
    void api.readFile(file).then((text) => {
      if (cancelled) return;
      if (!text) {
        setJournalSteps([]);
        return;
      }
      const parsed = importQuestText(text) as { steps?: unknown[] };
      setJournalSteps(stepsFromImported(parsed.steps));
    }).catch(() => {
      if (!cancelled) setJournalSteps([]);
    });
    return () => { cancelled = true; };
  }, [projectPath, questFlow?.questId]);

  const moments = useMemo(
    () => buildMoments({ npcName: editingObject?.name || 'npc', quest: questFlow, steps: journalSteps, custom: customMoments }),
    [editingObject?.name, questFlow, journalSteps, customMoments],
  );
  const assignment = useMemo(() => assignTopicsToMoments(dialogueTrees, moments), [dialogueTrees, moments]);
  const allMomentCards = useMemo(() => [...moments, assignment.other], [moments, assignment.other]);

  useEffect(() => {
    if (selectedMomentId && (allMomentCards.some((moment) => moment.id === selectedMomentId))) return;
    setSelectedMomentId(moments[0]?.id || OTHER_MOMENT_ID);
  }, [allMomentCards, moments, selectedMomentId]);

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const moment of allMomentCards) {
      counts[moment.id] = dialogueTrees.filter((tree) => assignment.topicMoment[tree.dialogueId || tree.id] === moment.id).length;
    }
    return counts;
  }, [allMomentCards, assignment, dialogueTrees]);

  const visibleDialogueIds = useMemo(() => {
    const id = selectedMomentId || OTHER_MOMENT_ID;
    return dialogueTrees
      .filter((tree) => assignment.topicMoment[tree.dialogueId || tree.id] === id)
      .map((tree) => tree.dialogueId || tree.id);
  }, [assignment, dialogueTrees, selectedMomentId]);

  if (!tab) return null;

  const roleProps = editingObject?.properties as Record<string, unknown> | undefined;
  const counts: Record<RoleCenterTab, string> = {
    dialogue: `${dialogueSummary(roleProps).topics} topics`,
    vendor: `${vendorSummary(roleProps).products} items`,
    quest: questSummary(roleProps)?.name || 'No quest',
  };

  return (
    <div
      ref={dialogRef}
      className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 55,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{editingObject?.name || 'NPC'} roles</span>
        </div>
        <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-transparent" onClick={() => onTabChange(null)}>
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-40 shrink-0 border-r border-border p-2 space-y-1">
          {(Object.keys(tabMeta) as RoleCenterTab[]).map((key) => {
            const { label, tone, Icon } = tabMeta[key];
            const active = key === tab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                  active ? tone : 'border-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </span>
                <span className="text-[10px] opacity-80 truncate block">{counts[key]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 min-h-0 p-3 flex flex-col gap-2">
          <MomentsStrip
            moments={moments}
            other={assignment.other}
            selectedId={selectedMomentId || OTHER_MOMENT_ID}
            topicCounts={topicCounts}
            onSelect={setSelectedMomentId}
            onAdd={() => {
              const next = addCustomMoment(moments, editingObject?.name || 'npc');
              const added = next[next.length - 1];
              setCustomMoments((prev) => [...prev, added]);
              setSelectedMomentId(added.id);
            }}
          />
          {tab === 'dialogue' && (
            <DialogueTreeDialog
              embedded
              showDialogueTreeDialog
              visibleDialogueIds={visibleDialogueIds}
              selectedMoment={[...moments, assignment.other].find((moment) => moment.id === (selectedMomentId || OTHER_MOMENT_ID)) || assignment.other}
              dialogueTrees={dialogueTrees}
              setDialogueTrees={setDialogueTrees as React.Dispatch<React.SetStateAction<DialogueTree[]>>}
              activeDialogueTab={activeDialogueTab}
              setActiveDialogueTab={setActiveDialogueTab as React.Dispatch<React.SetStateAction<number>>}
              dialogueTabToDelete={dialogueTabToDelete}
              setDialogueTabToDelete={setDialogueTabToDelete as React.Dispatch<React.SetStateAction<number | null>>}
              onClose={() => onTabChange(null)}
              editingObject={editingObject}
              updateEditingObjectProperty={updateEditingObjectProperty}
              projectMaps={projectMaps}
            />
          )}
          {tab === 'vendor' && (
            <NpcVendorSettingsDialog
              embedded
              isOpen
              onClose={() => onTabChange(null)}
              onCreateVendorStockGroup={onCreateVendorStockGroup}
              itemsList={itemsList}
              properties={roleProps}
              getEditingObjectProperty={getEditingObjectProperty}
              updateEditingObjectProperty={updateEditingObjectProperty}
            />
          )}
          {tab === 'quest' && (
            <NpcQuestSettingsDialog
              embedded
              isOpen
              onClose={() => onTabChange(null)}
              itemsList={itemsList}
              npcName={editingObject?.name || ''}
              projectPath={projectPath}
              dialogueTrees={dialogueTrees}
              setDialogueTrees={setDialogueTrees}
              getEditingObjectProperty={getEditingObjectProperty}
              updateEditingObjectProperty={updateEditingObjectProperty}
            />
          )}
        </div>
      </div>

      <ResizeHandle onMouseDown={handleResizeMouseDown} />
    </div>
  );
};

export default NpcRoleCenterDialog;
