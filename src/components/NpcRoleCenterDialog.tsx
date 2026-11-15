import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cleanDialogueTreesForSave } from '@/editor/dialogueTreesClean';
import { MessageSquare, HandCoins, MessageCircleQuestionMark, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import type { DialogueTree, MapObject } from '@/types';
import type { ItemSummary } from '@/utils/items';
import DialogueTreeDialog from '@/components/dialogue/DialogueTreeDialog';
import NpcVendorSettingsDialog from '@/components/NpcVendorSettingsDialog';
import NpcQuestSettingsDialog from '@/components/NpcQuestSettingsDialog';
import { NPC_ROLE_META_LOOKUP } from '@/editor/actorRoles';
import { readQuestFlowTrees } from '@/editor/questFlow';
import {
  addCustomMoment,
  assignTopicsToMoments,
  buildMoments,
  OTHER_MOMENT_ID,
  shopOpenInMoment,
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
  /** Saves the whole NPC and closes only this window; the NPC window stays open. */
  onSave?: () => void | Promise<void>;
  dirty?: boolean;
};

const tabMeta: Record<RoleCenterTab, { label: string; badgeClass: string; Icon: React.ComponentType<{ className?: string }> }> = {
  dialogue: { label: 'Dialogue', badgeClass: NPC_ROLE_META_LOOKUP.isTalker.badgeClass, Icon: MessageSquare },
  vendor: { label: 'Shop', badgeClass: NPC_ROLE_META_LOOKUP.isVendor.badgeClass, Icon: HandCoins },
  quest: { label: 'Quest', badgeClass: NPC_ROLE_META_LOOKUP.isQuestGiver.badgeClass, Icon: MessageCircleQuestionMark },
};

/** One role window at a time: no tab column, only the requested role's editor. */
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
  onSave,
  dirty = false,
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

  // Dialogue edits live in dialogueTrees; copy them onto the NPC so the one Save button keeps them.
  const treesBaselineRef = useRef<string | null>(null);
  const isOpen = tab !== null;
  useEffect(() => {
    treesBaselineRef.current = null;
  }, [isOpen, npcKey]);
  useEffect(() => {
    if (!isOpen) return;
    const json = JSON.stringify(dialogueTrees);
    if (treesBaselineRef.current === null) {
      treesBaselineRef.current = json;
      return;
    }
    if (json === treesBaselineRef.current) return;
    const clean = cleanDialogueTreesForSave(dialogueTrees);
    const next = clean.length ? JSON.stringify(clean) : null;
    if (next !== (getEditingObjectProperty('dialogueTrees', '') || null)) {
      updateEditingObjectProperty('dialogueTrees', next);
    }
  }, [isOpen, dialogueTrees, getEditingObjectProperty, updateEditingObjectProperty]);

  // Save: apply the quest tab first (state updates), then save the NPC on the next render so it sees them.
  const questSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const registerQuestSave = useCallback((fn: (() => Promise<boolean>) | null) => { questSaveRef.current = fn; }, []);
  const [pendingSave, setPendingSave] = useState(false);
  const [savingNow, setSavingNow] = useState(false);
  const handleSaveClick = async () => {
    if (!onSave || savingNow) return;
    setSavingNow(true);
    if (tab === 'quest' && questSaveRef.current) {
      const ok = await questSaveRef.current();
      if (!ok) { setSavingNow(false); return; }
    }
    setPendingSave(true);
  };
  useEffect(() => {
    if (!pendingSave || !onSave) return;
    setPendingSave(false);
    void Promise.resolve(onSave()).finally(() => setSavingNow(false));
  }, [pendingSave, onSave]);

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

  const vendorRequires = {
    requiresStatus: getEditingObjectProperty('vendor_requires_status', ''),
    requiresNotStatus: getEditingObjectProperty('vendor_requires_not_status', ''),
  };
  const shopOpen = getEditingObjectProperty('vendor', '') === 'true' || Boolean(vendorRequires.requiresStatus || vendorRequires.requiresNotStatus);
  const shopBadges = shopOpen
    ? Object.fromEntries(moments.filter((moment) => shopOpenInMoment(moment, vendorRequires)).map((moment) => [moment.id, 'Shop open']))
    : undefined;

  if (!tab) return null;

  const { label, badgeClass, Icon } = tabMeta[tab];
  const roleProps = editingObject?.properties as Record<string, unknown> | undefined;

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
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center rounded-md border p-1 ${badgeClass}`}>
            <Icon className="w-4 h-4" />
          </span>
          <span className="font-semibold truncate">{editingObject?.name || 'NPC'} · {label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-transparent" onClick={() => onTabChange(null)}>
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 min-h-0 p-3 flex flex-col gap-2">
          <MomentsStrip
            moments={moments}
            other={assignment.other}
            selectedId={selectedMomentId || OTHER_MOMENT_ID}
            topicCounts={topicCounts}
            onSelect={setSelectedMomentId}
            badges={tab === 'vendor' ? shopBadges : undefined}
            onAdd={() => {
              const next = addCustomMoment(moments, editingObject?.name || 'npc');
              const added = next[next.length - 1];
              setCustomMoments((prev) => [...prev, added]);
              setSelectedMomentId(added.id);
            }}
          />
          {tab === 'dialogue' ? (
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
          ) : tab === 'vendor' ? (
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
          ) : (
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
              registerSave={registerQuestSave}
            />
          )}
        </div>
      </div>

      {onSave && (
        <div className="flex justify-end border-t border-border p-4">
          <div className="relative flex gap-2">
            {dirty && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-400"
                aria-hidden
                title="Unsaved changes"
              />
            )}
            <Button size="icon" onClick={() => void handleSaveClick()} disabled={savingNow} aria-label="Save">
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ResizeHandle onMouseDown={handleResizeMouseDown} />
    </div>
  );
};

export default NpcRoleCenterDialog;
