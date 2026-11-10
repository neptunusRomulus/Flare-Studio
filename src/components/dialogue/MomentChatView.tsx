import React, { useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import useListReorder from '@/hooks/useListReorder';
import { removeDialogueLine, reorderDialogueLines } from '@/editor/dialogueLines';
import { applyMomentToTopic, type RoleMoment } from '@/editor/roleMoments';
import type { DialogueLine, DialogueReward, DialogueTree, DialogueWorldEffect } from '@/types';
import SearchablePalette from '@/components/ui/searchable-palette';
import Tooltip from '@/components/ui/tooltip';
import {
  actionChipLabel,
  actionChipTooltip,
  chipsFromActions,
  DIALOG_ACTION_CATALOG,
  type DialogActionChip,
} from '@/editor/dialogActionChips';

type Props = {
  trees: DialogueTree[];
  visibleTrees: DialogueTree[];
  setTrees: (trees: DialogueTree[]) => void;
  moment: RoleMoment;
};

const newId = () => `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function patchTree(trees: DialogueTree[], id: string, next: DialogueTree): DialogueTree[] {
  return trees.map((tree) => ((tree.dialogueId || tree.id) === id ? next : tree));
}

const Bubble = ({
  line,
  index,
  onChange,
  onRemove,
  dragHandle,
  dropProps,
  reorderClass,
}: {
  line: DialogueLine;
  index: number;
  onChange: (text: string) => void;
  onRemove: () => void;
  dragHandle: React.HTMLAttributes<HTMLButtonElement>;
  dropProps: React.HTMLAttributes<HTMLDivElement>;
  reorderClass: string;
}) => {
  const npc = line.speaker !== 'player';
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={`flex ${npc ? 'justify-start' : 'justify-end'} ${reorderClass}`} {...dropProps}>
      <div className={`max-w-[80%] flex items-start gap-1 ${npc ? '' : 'flex-row-reverse'}`}>
        <button type="button" className="mt-2 text-muted-foreground cursor-grab active:cursor-grabbing" aria-label="Reorder line" {...dragHandle}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div
          className={`rounded-2xl px-3 py-2 text-sm ${
            npc ? 'bg-muted rounded-tl-sm' : 'bg-blue-500/15 text-foreground rounded-tr-sm'
          }`}
        >
          <textarea
            value={line.text || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={Math.min(6, Math.max(1, (line.text || '').split('\n').length))}
            className="w-full min-w-[12rem] resize-none bg-transparent outline-none text-sm leading-relaxed"
            placeholder={npc ? 'NPC line' : 'Player line'}
          />
        </div>
        <InlineConfirm open={confirm} onCancel={() => setConfirm(false)} onConfirm={onRemove} message="Remove this line?">
          <button type="button" className="mt-2 text-muted-foreground hover:text-foreground" aria-label="Remove line" onClick={() => setConfirm(true)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </InlineConfirm>
      </div>
    </div>
  );
};


const ActionChip = ({
  chip,
  onChange,
  onRemove,
}: {
  chip: DialogActionChip;
  onChange: (chip: DialogActionChip) => void;
  onRemove: () => void;
}) => {
  const [editing, setEditing] = useState(!chip.value && chip.type !== 'restore' && chip.type !== 'stash' && chip.type !== 'save_game');
  const needsValue = !['stash', 'save_game'].includes(chip.type);
  return (
    <Tooltip content={actionChipTooltip(chip)}>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px]">
        {editing && needsValue ? (
          <input
            autoFocus
            className="h-5 w-24 bg-transparent text-[11px] outline-none"
            value={chip.value}
            onChange={(e) => onChange({ ...chip, value: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditing(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)}>
            {actionChipLabel(chip)}
          </button>
        )}
        <button type="button" aria-label="Remove" className="text-muted-foreground hover:text-foreground" onClick={onRemove}>
          <X className="w-3 h-3" />
        </button>
      </span>
    </Tooltip>
  );
};

const ActionChips = ({
  tree,
  onPatch,
}: {
  tree: DialogueTree;
  onPatch: (next: DialogueTree) => void;
}) => {
  const chips = chipsFromActions(tree.rewards, tree.worldEffects);
  const catalog = DIALOG_ACTION_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    tooltip: `${entry.flareKey} — ${entry.description}`,
    searchText: `${entry.label} ${entry.flareKey} ${entry.description} ${entry.type}`,
  }));

  const writeChip = (chip: DialogActionChip) => {
    if (chip.group === 'reward') {
      const rewards = [...(tree.rewards || [])];
      rewards[chip.index] = { ...(rewards[chip.index] || {}), id: chip.id, type: chip.type as DialogueReward['type'], value: chip.value, quantity: chip.quantity };
      onPatch({ ...tree, rewards });
    } else {
      const worldEffects = [...(tree.worldEffects || [])];
      worldEffects[chip.index] = { ...(worldEffects[chip.index] || {}), id: chip.id, type: chip.type as DialogueWorldEffect['type'], value: chip.value };
      onPatch({ ...tree, worldEffects });
    }
  };

  const removeChip = (chip: DialogActionChip) => {
    if (chip.group === 'reward') onPatch({ ...tree, rewards: (tree.rewards || []).filter((_, i) => i !== chip.index) });
    else onPatch({ ...tree, worldEffects: (tree.worldEffects || []).filter((_, i) => i !== chip.index) });
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
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <ActionChip key={`${chip.group}-${chip.index}-${chip.id}`} chip={chip} onChange={writeChip} onRemove={() => removeChip(chip)} />
      ))}
      <SearchablePalette buttonLabel="Add property" entries={catalog} onSelect={addFromCatalog} />
    </div>
  );
};

const TopicThread = ({
  tree,
  allTrees,
  onPatch,
}: {
  tree: DialogueTree;
  allTrees: DialogueTree[];
  onPatch: (next: DialogueTree) => void;
}) => {
  const lines = tree.dialogues || [];
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

  const removeLine = (index: number) => {
    onPatch(removeDialogueLine(tree, index));
  };

  const responseButtons = (tree.responses || []).map((id) => {
    const target = allTrees.find((entry) => entry.dialogueId === id);
    const playerLine = target?.dialogues?.find((line) => line.speaker === 'player')?.text;
    return { id, label: playerLine || target?.topic || id };
  });

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2 pr-6">
        <input
          className="flex-1 bg-transparent text-sm font-semibold outline-none"
          value={tree.topic}
          onChange={(e) => onPatch({ ...tree, topic: e.target.value })}
          placeholder="Topic"
        />
      </div>
      {lines.map((line, index) => (
        <Bubble
          key={line.id || `${tree.dialogueId}-${index}`}
          line={line}
          index={index}
          onChange={(text) => setLineText(index, text)}
          onRemove={() => removeLine(index)}
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
      {responseButtons.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${lines.some((line) => line.speaker === 'player') ? 'justify-end' : 'justify-start'}`}>
          {responseButtons.map((response) => (
            <span key={response.id} className="inline-flex rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs">
              {response.label}
            </span>
          ))}
        </div>
      )}
      <ActionChips tree={tree} onPatch={onPatch} />
      <div className="flex items-center gap-1.5 pt-1">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addLine('npc')}>
          <Plus className="w-3 h-3" />
          NPC
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addLine('player')}>
          <Plus className="w-3 h-3" />
          Player
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

const MomentChatView = ({ trees, visibleTrees, setTrees, moment }: Props) => {
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
        <div key={tree.dialogueId || tree.id} className="relative">
          <TopicDeleteButton onConfirm={() => removeTopic(tree.dialogueId || tree.id)} />
          <TopicThread
            tree={tree}
            allTrees={trees}
            onPatch={(next) => setTrees(patchTree(trees, tree.dialogueId || tree.id, next))}
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
