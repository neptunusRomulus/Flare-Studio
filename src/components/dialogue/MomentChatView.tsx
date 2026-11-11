import React, { useEffect, useState } from 'react';
import { CornerDownRight, GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import useListReorder from '@/hooks/useListReorder';
import { removeDialogueLine, reorderDialogueLines } from '@/editor/dialogueLines';
import { applyMomentToTopic, type RoleMoment } from '@/editor/roleMoments';
import type { DialogueLine, DialogueRequirement, DialogueReward, DialogueTree, DialogueWorldEffect } from '@/types';
import SearchablePalette from '@/components/ui/searchable-palette';
import Tooltip from '@/components/ui/tooltip';
import NpcAssetThumb from '@/components/NpcAssetThumb';
import { resolveNpcPreviewPaths } from '@/flare/npcPreviewPaths';
import {
  actionChipLabel,
  actionChipTooltip,
  chipsFromActions,
  DIALOG_ACTION_CATALOG,
  type DialogActionChip,
} from '@/editor/dialogActionChips';
import {
  addCondition,
  chatBubbleMeta,
  chatResponses,
  conditionChipLabel,
  conditionChipTooltip,
  conditionEntry,
  DIALOG_CONDITION_CATALOG,
  removeAction,
  removeCondition,
  updateCondition,
} from '@/editor/dialogueChat';

type Props = {
  trees: DialogueTree[];
  visibleTrees: DialogueTree[];
  setTrees: (trees: DialogueTree[]) => void;
  moment: RoleMoment;
  /** NPC name shown above its bubbles. */
  npcName?: string;
  /** NPC portrait (project-relative, absolute or data URL) used until a line sets another. */
  npcPortrait?: string;
  projectPath?: string | null;
};

const newId = () => `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const topicDomId = (id: string) => `chat-topic-${id}`;

function patchTree(trees: DialogueTree[], id: string, next: DialogueTree): DialogueTree[] {
  return trees.map((tree) => ((tree.dialogueId || tree.id) === id ? next : tree));
}

/** Round avatar; resolves project / Flare portraits like the Edit NPC preview. */
const ChatAvatar = ({ portrait, name, projectPath }: { portrait: string; name: string; projectPath?: string | null }) => {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    if (!portrait) return;
    resolveNpcPreviewPaths({ portraitPath: portrait, projectPath })
      .then((paths) => { if (!cancelled) setResolved(paths.portrait); })
      .catch(() => { /* no portrait */ });
    return () => { cancelled = true; };
  }, [portrait, projectPath]);
  const initial = (name || 'N').trim().charAt(0).toUpperCase() || 'N';
  return resolved ? (
    <NpcAssetThumb imagePath={resolved} alt={initial} className="w-8 h-8 rounded-full" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
};

/** Small chip that edits its value inline; X removes it. */
const EditChip = ({
  label,
  tooltip,
  value,
  placeholder,
  needsValue = true,
  tone = 'neutral',
  onChange,
  onRemove,
}: {
  label: string;
  tooltip: string;
  value: string;
  placeholder?: string;
  needsValue?: boolean;
  tone?: 'neutral' | 'condition';
  onChange: (value: string) => void;
  onRemove: () => void;
}) => {
  const [editing, setEditing] = useState(needsValue && !value);
  return (
    <Tooltip content={tooltip}>
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
          tone === 'condition' ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-background/80'
        }`}
      >
        {editing && needsValue ? (
          <input
            autoFocus
            className="h-5 w-24 bg-transparent text-[11px] outline-none"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditing(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)}>
            {label}
          </button>
        )}
        <button type="button" aria-label="Remove" className="text-muted-foreground hover:text-foreground" onClick={onRemove}>
          <X className="w-3 h-3" />
        </button>
      </span>
    </Tooltip>
  );
};

const Bubble = ({
  line,
  side,
  startsRun,
  portrait,
  npcName,
  projectPath,
  onChange,
  onRemove,
  dragHandle,
  dropProps,
  reorderClass,
}: {
  line: DialogueLine;
  side: 'left' | 'right';
  startsRun: boolean;
  portrait: string;
  npcName: string;
  projectPath?: string | null;
  onChange: (text: string) => void;
  onRemove: () => void;
  dragHandle: React.HTMLAttributes<HTMLButtonElement>;
  dropProps: React.HTMLAttributes<HTMLDivElement>;
  reorderClass: string;
}) => {
  const npc = side === 'left';
  const [confirm, setConfirm] = useState(false);
  // Grip and X keep their space and only fade in on hover, so nothing moves.
  const tools = (
    <div className={`flex flex-col items-center gap-1 pt-1 transition-opacity ${confirm ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
      <button type="button" className="text-muted-foreground cursor-grab active:cursor-grabbing" aria-label="Reorder line" {...dragHandle}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <InlineConfirm open={confirm} onCancel={() => setConfirm(false)} onConfirm={onRemove} message="Remove this line?">
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Remove line" onClick={() => setConfirm(true)}>
          <X className="w-3.5 h-3.5" />
        </button>
      </InlineConfirm>
    </div>
  );
  return (
    <div className={`group flex ${npc ? 'justify-start' : 'justify-end'} ${startsRun ? 'mt-2' : 'mt-0.5'} ${reorderClass}`} {...dropProps}>
      <div className={`max-w-[80%] flex items-start gap-1.5 ${npc ? '' : 'flex-row-reverse'}`}>
        {npc && (
          <div className="w-8 shrink-0">
            {startsRun && <ChatAvatar portrait={portrait} name={npcName} projectPath={projectPath} />}
          </div>
        )}
        <div
          className={`relative rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
            npc
              ? `bg-background border border-border ${startsRun ? 'rounded-tl-sm' : ''}`
              : `bg-emerald-500/20 ${startsRun ? 'rounded-tr-sm' : ''}`
          }`}
        >
          {npc && startsRun && (
            <Tooltip content={line.key === 'her' ? 'her' : 'him'}>
              <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 leading-tight">{npcName || 'NPC'}</div>
            </Tooltip>
          )}
          <textarea
            value={line.text || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={Math.min(6, Math.max(1, (line.text || '').split('\n').length))}
            className="block w-full min-w-[12rem] resize-none bg-transparent outline-none text-sm leading-relaxed"
            placeholder={npc ? 'NPC says…' : 'Player says…'}
          />
        </div>
        {tools}
      </div>
    </div>
  );
};

const ConditionChips = ({ tree, onPatch }: { tree: DialogueTree; onPatch: (next: DialogueTree) => void }) => {
  const reqs = tree.requirements || [];
  const catalog = DIALOG_CONDITION_CATALOG.map((entry) => ({
    id: entry.type,
    label: entry.label,
    tooltip: entry.flareKey,
    searchText: `${entry.flareKey} ${entry.type} requires condition`,
  }));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reqs.map((req: DialogueRequirement, index) => (
        <EditChip
          key={`${req.id || 'req'}-${index}`}
          tone="condition"
          label={conditionChipLabel(req)}
          tooltip={conditionChipTooltip(req)}
          value={req.value || ''}
          placeholder={conditionEntry(req.type)?.placeholder}
          onChange={(value) => onPatch(updateCondition(tree, index, value))}
          onRemove={() => onPatch(removeCondition(tree, index))}
        />
      ))}
      <SearchablePalette buttonLabel="Condition" placeholder="Search conditions…" entries={catalog} onSelect={(type) => onPatch(addCondition(tree, type as DialogueRequirement['type']))} />
    </div>
  );
};

const ActionChips = ({ tree, onPatch }: { tree: DialogueTree; onPatch: (next: DialogueTree) => void }) => {
  const chips = chipsFromActions(tree.rewards, tree.worldEffects);
  const catalog = DIALOG_ACTION_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    tooltip: `${entry.flareKey} — ${entry.description}`,
    searchText: `${entry.label} ${entry.flareKey} ${entry.description} ${entry.type}`,
  }));

  const writeChip = (chip: DialogActionChip, value: string) => {
    if (chip.group === 'reward') {
      const rewards = [...(tree.rewards || [])];
      rewards[chip.index] = { ...(rewards[chip.index] || {}), id: chip.id, type: chip.type as DialogueReward['type'], value, quantity: chip.quantity };
      onPatch({ ...tree, rewards });
    } else {
      const worldEffects = [...(tree.worldEffects || [])];
      worldEffects[chip.index] = { ...(worldEffects[chip.index] || {}), id: chip.id, type: chip.type as DialogueWorldEffect['type'], value };
      onPatch({ ...tree, worldEffects });
    }
  };

  const addFromCatalog = (id: string) => {
    const entry = DIALOG_ACTION_CATALOG.find((item) => item.id === id);
    if (!entry) return;
    if (entry.group === 'reward') {
      onPatch({ ...tree, rewards: [...(tree.rewards || []), { id: `reward-${Date.now()}`, type: entry.type as DialogueReward['type'], value: '' }] });
    } else {
      const value = entry.type === 'stash' || entry.type === 'save_game' ? 'true' : '';
      onPatch({ ...tree, worldEffects: [...(tree.worldEffects || []), { id: `effect-${Date.now()}`, type: entry.type as DialogueWorldEffect['type'], value }] });
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {chips.map((chip) => (
        <EditChip
          key={`${chip.group}-${chip.index}-${chip.id}`}
          label={actionChipLabel(chip)}
          tooltip={actionChipTooltip(chip)}
          value={chip.value}
          needsValue={!['stash', 'save_game', 'respec'].includes(chip.type)}
          onChange={(value) => writeChip(chip, value)}
          onRemove={() => onPatch(removeAction(tree, chip.group, chip.index))}
        />
      ))}
      <SearchablePalette buttonLabel="Effect" placeholder="Search effects…" entries={catalog} onSelect={addFromCatalog} />
    </div>
  );
};

const TopicThread = ({
  tree,
  allTrees,
  onPatch,
  npcName,
  npcPortrait,
  projectPath,
}: {
  tree: DialogueTree;
  allTrees: DialogueTree[];
  onPatch: (next: DialogueTree) => void;
  npcName: string;
  npcPortrait: string;
  projectPath?: string | null;
}) => {
  const lines = tree.dialogues || [];
  const meta = chatBubbleMeta(lines, npcPortrait);
  const reorder = useListReorder(lines, (line) => line.id || line.text || 'line', (from, to) => {
    onPatch(reorderDialogueLines(tree, from, to));
  });

  const setLineText = (index: number, text: string) => {
    const dialogues = lines.map((line, i) => (i === index ? { ...line, text } : line));
    onPatch({ ...tree, dialogues });
  };

  const addLine = (speaker: 'npc' | 'player') => {
    const line: DialogueLine = { id: newId(), speaker, text: '' };
    onPatch({ ...tree, dialogues: [...lines, line] });
  };

  const responses = chatResponses(tree, allTrees);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 pr-6">
        <Tooltip content="topic — the player picks this to start the talk">
          <input
            className="flex-1 bg-transparent text-sm font-semibold outline-none"
            value={tree.topic}
            onChange={(e) => onPatch({ ...tree, topic: e.target.value })}
            placeholder="Topic"
          />
        </Tooltip>
      </div>
      <ConditionChips tree={tree} onPatch={onPatch} />
      <div>
        {lines.map((line, index) => (
          <Bubble
            key={line.id || `${tree.dialogueId}-${index}`}
            line={line}
            side={meta[index].side}
            startsRun={meta[index].startsRun}
            portrait={meta[index].portrait}
            npcName={npcName}
            projectPath={projectPath}
            onChange={(text) => setLineText(index, text)}
            onRemove={() => onPatch(removeDialogueLine(tree, index))}
            dragHandle={{
              draggable: true,
              onDragStart: (e) => {
                e.stopPropagation();
                reorder.startReorder(e, index);
              },
              onDragEnd: reorder.endReorder,
            }}
            dropProps={reorder.getItemDropProps(index)}
            reorderClass={reorder.reorderClass(index)}
          />
        ))}
      </div>
      {responses.length > 0 && (
        <div className="flex flex-col items-end gap-1">
          {responses.map((response) => (
            <Tooltip key={response.id} content={response.missing ? `response=${response.id} (topic not found)` : `response=${response.id}`}>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                  response.missing ? 'border-destructive/50 text-destructive' : 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                }`}
                onClick={() => document.getElementById(topicDomId(response.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <CornerDownRight className="w-3 h-3" />
                {response.label}
              </button>
            </Tooltip>
          ))}
        </div>
      )}
      <ActionChips tree={tree} onPatch={onPatch} />
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/60">
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => addLine('npc')}>
          <Plus className="w-3 h-3" />
          NPC line
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => addLine('player')}>
          Player line
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

const TopicDeleteButton = ({ onConfirm }: { onConfirm: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute top-2 right-2 z-10">
      <InlineConfirm open={open} onCancel={() => setOpen(false)} onConfirm={() => { onConfirm(); setOpen(false); }} message="Remove this topic?">
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Remove topic" onClick={() => setOpen(true)}>
          <X className="w-3.5 h-3.5" />
        </button>
      </InlineConfirm>
    </div>
  );
};

const MomentChatView = ({ trees, visibleTrees, setTrees, moment, npcName = '', npcPortrait = '', projectPath }: Props) => {
  const addTopic = () => {
    const id = `dlg_${Math.random().toString(36).slice(2, 6)}`;
    const blank: DialogueTree = {
      id,
      dialogueId: id,
      topic: '',
      responses: [],
      requirements: [],
      dialogues: [{ id: newId(), speaker: 'npc', text: '' }],
      rewards: [],
      worldEffects: [],
    };
    setTrees([...trees, applyMomentToTopic(blank, moment)]);
  };

  const removeTopic = (id: string) => {
    setTrees(trees.filter((tree) => (tree.dialogueId || tree.id) !== id).map((tree) => ({
      ...tree,
      responses: (tree.responses || []).filter((response) => response !== id),
    })));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
      {visibleTrees.map((tree) => (
        <div key={tree.dialogueId || tree.id} id={topicDomId(tree.dialogueId || tree.id)} className="relative">
          <TopicDeleteButton onConfirm={() => removeTopic(tree.dialogueId || tree.id)} />
          <TopicThread
            tree={tree}
            allTrees={trees}
            onPatch={(next) => setTrees(patchTree(trees, tree.dialogueId || tree.id, next))}
            npcName={npcName}
            npcPortrait={npcPortrait}
            projectPath={projectPath}
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={addTopic}>
        <Plus className="w-3.5 h-3.5" />
        Topic
      </Button>
    </div>
  );
};

export default MomentChatView;
