import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CornerDownRight, GripVertical, Image as ImageIcon, ListFilter, Plus, SendHorizontal, Sparkles, Trash2, User, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import SearchablePalette from '@/components/ui/searchable-palette';
import Tooltip from '@/components/ui/tooltip';
import useListReorder from '@/hooks/useListReorder';
import { cn } from '@/lib/utils';
import { removeDialogueLine, reorderDialogueLines } from '@/editor/dialogueLines';
import { applyMomentToTopic, type RoleMoment } from '@/editor/roleMoments';
import type { DialogueLine, DialogueRequirement, DialogueReward, DialogueTree, DialogueWorldEffect } from '@/types';
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
  /** NPC name (avatar tooltip and fallback initial). */
  npcName?: string;
  /** NPC portrait (project-relative, absolute or data URL) used until a line sets another. */
  npcPortrait?: string;
  projectPath?: string | null;
};

const NPC_BG = 'hsl(var(--muted))';
const PLAYER_BG = 'rgb(16 185 129 / 0.22)';

const newId = () => `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const topicKey = (tree: DialogueTree) => tree.dialogueId || tree.id;
const topicDomId = (id: string) => `chat-topic-${id}`;

function patchTree(trees: DialogueTree[], id: string, next: DialogueTree): DialogueTree[] {
  return trees.map((tree) => (topicKey(tree) === id ? next : tree));
}

const CONDITION_ENTRIES = DIALOG_CONDITION_CATALOG.map((entry) => ({
  id: entry.type,
  label: entry.label,
  tooltip: entry.flareKey,
  searchText: `${entry.flareKey} ${entry.type} requires condition`,
}));
const EFFECT_ENTRIES = DIALOG_ACTION_CATALOG.map((entry) => ({
  id: entry.id,
  label: entry.label,
  tooltip: `${entry.flareKey} — ${entry.description}`,
  searchText: `${entry.label} ${entry.flareKey} ${entry.description} ${entry.type}`,
}));

function addEffect(tree: DialogueTree, id: string): DialogueTree {
  const entry = DIALOG_ACTION_CATALOG.find((item) => item.id === id);
  if (!entry) return tree;
  if (entry.group === 'reward') {
    return { ...tree, rewards: [...(tree.rewards || []), { id: `reward-${Date.now()}`, type: entry.type as DialogueReward['type'], value: '' }] };
  }
  const value = entry.type === 'stash' || entry.type === 'save_game' ? 'true' : '';
  return { ...tree, worldEffects: [...(tree.worldEffects || []), { id: `effect-${Date.now()}`, type: entry.type as DialogueWorldEffect['type'], value }] };
}

function writeEffect(tree: DialogueTree, chip: DialogActionChip, value: string): DialogueTree {
  if (chip.group === 'reward') {
    const rewards = [...(tree.rewards || [])];
    rewards[chip.index] = { ...(rewards[chip.index] || {}), id: chip.id, type: chip.type as DialogueReward['type'], value, quantity: chip.quantity };
    return { ...tree, rewards };
  }
  const worldEffects = [...(tree.worldEffects || [])];
  worldEffects[chip.index] = { ...(worldEffects[chip.index] || {}), id: chip.id, type: chip.type as DialogueWorldEffect['type'], value };
  return { ...tree, worldEffects };
}

/** Portrait path → loadable image src (project file, Flare install, or data URL). */
function usePortraitSrc(portrait: string, projectPath?: string | null): string | null {
  const [src, setSrc] = useState<string | null>(portrait.startsWith('data:') ? portrait : null);
  useEffect(() => {
    let cancelled = false;
    if (!portrait) { setSrc(null); return; }
    if (portrait.startsWith('data:')) { setSrc(portrait); return; }
    resolveNpcPreviewPaths({ portraitPath: portrait, projectPath })
      .then(async ({ portrait: path }) => {
        if (!path) return null;
        if (path.startsWith('data:')) return path;
        return (await window.electronAPI?.readFileAsDataURL?.(path)) || null;
      })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [portrait, projectPath]);
  return src;
}

const NpcAvatar = ({ portrait, name, projectPath, className }: { portrait: string; name: string; projectPath?: string | null; className?: string }) => {
  const src = usePortraitSrc(portrait, projectPath);
  const initial = (name || 'N').trim().charAt(0).toUpperCase() || 'N';
  return (
    <Tooltip content={name || 'NPC'}>
      <Avatar className={cn('h-6 w-6', className)}>
        {src && <AvatarImage src={src} alt={name} style={{ imageRendering: 'pixelated' }} />}
        <AvatarFallback className="text-[10px] font-semibold text-muted-foreground">{initial}</AvatarFallback>
      </Avatar>
    </Tooltip>
  );
};

/** Textarea that grows to its content: on mount, on input and when its width changes. */
const AutoGrowTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, forwarded) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [props.value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <Textarea
      ref={(el) => {
        ref.current = el;
        if (typeof forwarded === 'function') forwarded(el);
        else if (forwarded) forwarded.current = el;
      }}
      rows={1}
      {...props}
      onInput={(e) => { fit(); props.onInput?.(e); }}
      style={{ ...props.style, overflow: 'hidden' }}
    />
  );
});
AutoGrowTextarea.displayName = 'AutoGrowTextarea';

const BUBBLE_TEXT = 'text-[13px] leading-snug whitespace-pre-wrap break-words';

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
  const [editWidth, setEditWidth] = useState<number | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bg = npc ? NPC_BG : PLAYER_BG;
  const text = line.text || '';
  const meta = [
    line.voice ? { icon: Volume2, tip: `voice=${line.voice}` } : null,
    line.portrait ? { icon: ImageIcon, tip: `${line.portraitKey || (npc ? 'portrait_him' : 'portrait_you')}=${line.portrait}` } : null,
  ].filter(Boolean) as Array<{ icon: typeof Volume2; tip: string }>;

  const actions = (
    <div className={cn('flex items-center self-center transition-opacity', confirm ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}>
      <Button type="button" variant="ghost" size="icon" className="h-5 w-5 cursor-grab text-muted-foreground active:cursor-grabbing" aria-label="Reorder line" {...dragHandle}>
        <GripVertical className="h-3 w-3" />
      </Button>
      <InlineConfirm open={confirm} onCancel={() => setConfirm(false)} onConfirm={onRemove} message="Remove this line?">
        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" aria-label="Remove line" onClick={() => setConfirm(true)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </InlineConfirm>
    </div>
  );

  return (
    <div className={cn('group flex items-start gap-1', npc ? 'justify-start' : 'justify-end', startsRun ? 'mt-2' : 'mt-0.5', reorderClass)} {...dropProps}>
      {npc && (
        <div className="w-6 shrink-0">
          {startsRun && <NpcAvatar portrait={portrait} name={npcName} projectPath={projectPath} />}
        </div>
      )}
      {!npc && actions}
      <div
        ref={bubbleRef}
        className={cn('relative max-w-[75%] rounded-lg px-2.5 pb-1 pt-1 shadow-sm', startsRun && (npc ? 'rounded-tl-none' : 'rounded-tr-none'))}
        style={{ background: bg, width: editWidth ?? undefined }}
      >
        {startsRun && (
          <span
            aria-hidden
            className={cn('absolute top-0 h-0 w-0', npc ? '-left-2' : '-right-2')}
            style={npc
              ? { borderTop: `8px solid ${bg}`, borderLeft: '8px solid transparent' }
              : { borderTop: `8px solid ${bg}`, borderRight: '8px solid transparent' }}
          />
        )}
        {editWidth != null ? (
          <AutoGrowTextarea
            autoFocus
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditWidth(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
            className={cn(BUBBLE_TEXT, 'min-h-0 w-full resize-none rounded-none border-0 bg-transparent p-0 shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0')}
          />
        ) : (
          <div
            role="textbox"
            tabIndex={0}
            className={cn(BUBBLE_TEXT, 'cursor-text', !text && 'text-muted-foreground italic')}
            onClick={() => setEditWidth(Math.max(bubbleRef.current?.offsetWidth || 0, 120))}
            onFocus={() => setEditWidth(Math.max(bubbleRef.current?.offsetWidth || 0, 120))}
          >
            {text || (npc ? 'NPC says…' : 'Player says…')}
          </div>
        )}
        {meta.length > 0 && (
          <div className="flex justify-end gap-1 text-muted-foreground/80">
            {meta.map(({ icon: Icon, tip }) => (
              <Tooltip key={tip} content={tip}>
                <Icon className="h-2.5 w-2.5" />
              </Tooltip>
            ))}
          </div>
        )}
      </div>
      {npc && actions}
    </div>
  );
};

/** One editable row inside a popover: label, inline value, remove. */
const DetailRow = ({ label, tooltip, value, placeholder, needsValue = true, onChange, onRemove }: {
  label: string; tooltip: string; value: string; placeholder?: string; needsValue?: boolean;
  onChange: (value: string) => void; onRemove: () => void;
}) => (
  <div className="group/row flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/60">
    <Tooltip content={tooltip}>
      <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">{label}</span>
    </Tooltip>
    {needsValue ? (
      <input
        className="h-6 min-w-0 flex-1 rounded border-0 bg-transparent px-1 text-xs shadow-none outline-none focus:bg-background focus:ring-0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : <span className="flex-1" />}
    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/row:opacity-100" aria-label="Remove" onClick={onRemove}>
      <X className="h-3 w-3" />
    </Button>
  </div>
);

const TopicMeta = ({ tree, onPatch }: { tree: DialogueTree; onPatch: (next: DialogueTree) => void }) => {
  const reqs = tree.requirements || [];
  const chips = chipsFromActions(tree.rewards, tree.worldEffects);
  const condTip = reqs.length ? reqs.map(conditionChipLabel).join(' · ') : 'Always shown';
  const effTip = chips.length ? chips.map((chip) => actionChipLabel(chip)).join(' · ') : 'No effects';
  return (
    <span className="inline-flex items-center gap-0.5">
      <Popover>
        <Tooltip content={condTip}>
          <PopoverTrigger>
            <button type="button" className={cn('inline-flex items-center gap-0.5 rounded px-1 hover:bg-background/60', reqs.length ? 'text-amber-500' : 'text-muted-foreground/60')} aria-label="Conditions">
              <ListFilter className="h-3 w-3" />
              {reqs.length > 0 && <span className="text-[10px] tabular-nums">{reqs.length}</span>}
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent className="space-y-1 text-left">
          <div className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">Shows when</div>
          {reqs.map((req: DialogueRequirement, index) => (
            <DetailRow
              key={`${req.id || 'req'}-${index}`}
              label={conditionEntry(req.type)?.label || req.type}
              tooltip={conditionChipTooltip(req)}
              value={req.value || ''}
              placeholder={conditionEntry(req.type)?.placeholder}
              onChange={(value) => onPatch(updateCondition(tree, index, value))}
              onRemove={() => onPatch(removeCondition(tree, index))}
            />
          ))}
          <SearchablePalette buttonLabel="Condition" placeholder="Search conditions…" entries={CONDITION_ENTRIES} onSelect={(type) => onPatch(addCondition(tree, type as DialogueRequirement['type']))} />
        </PopoverContent>
      </Popover>
      <Popover>
        <Tooltip content={effTip}>
          <PopoverTrigger>
            <button type="button" className={cn('inline-flex items-center gap-0.5 rounded px-1 hover:bg-background/60', chips.length ? 'text-emerald-500' : 'text-muted-foreground/60')} aria-label="Effects">
              <Sparkles className="h-3 w-3" />
              {chips.length > 0 && <span className="text-[10px] tabular-nums">{chips.length}</span>}
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent className="space-y-1 text-left">
          <div className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">Then</div>
          {chips.map((chip) => (
            <DetailRow
              key={`${chip.group}-${chip.index}-${chip.id}`}
              label={DIALOG_ACTION_CATALOG.find((entry) => entry.type === chip.type && entry.group === chip.group)?.label || chip.type}
              tooltip={actionChipTooltip(chip)}
              value={chip.value}
              needsValue={!['stash', 'save_game', 'respec'].includes(chip.type)}
              onChange={(value) => onPatch(writeEffect(tree, chip, value))}
              onRemove={() => onPatch(removeAction(tree, chip.group, chip.index))}
            />
          ))}
          <SearchablePalette buttonLabel="Effect" placeholder="Search effects…" entries={EFFECT_ENTRIES} onSelect={(id) => onPatch(addEffect(tree, id))} />
        </PopoverContent>
      </Popover>
    </span>
  );
};

const TopicThread = ({
  tree,
  allTrees,
  active,
  onActivate,
  onPatch,
  onRemove,
  npcName,
  npcPortrait,
  projectPath,
}: {
  tree: DialogueTree;
  allTrees: DialogueTree[];
  active: boolean;
  onActivate: () => void;
  onPatch: (next: DialogueTree) => void;
  onRemove: () => void;
  npcName: string;
  npcPortrait: string;
  projectPath?: string | null;
}) => {
  const lines = tree.dialogues || [];
  const meta = chatBubbleMeta(lines, npcPortrait);
  const [confirm, setConfirm] = useState(false);
  const reorder = useListReorder(lines, (line) => line.id || line.text || 'line', (from, to) => {
    onPatch(reorderDialogueLines(tree, from, to));
  });
  const responses = chatResponses(tree, allTrees);
  const chips = chipsFromActions(tree.rewards, tree.worldEffects);

  return (
    <section id={topicDomId(topicKey(tree))} className="pb-1" onMouseDown={onActivate} onFocus={onActivate}>
      <div className="group sticky top-0 z-10 flex justify-center py-1.5">
        <div className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] shadow-sm backdrop-blur', active ? 'bg-muted text-foreground' : 'bg-muted/70 text-muted-foreground')}>
          <Tooltip content="topic — what the player picks to start this talk">
            <span className="inline-grid">
              <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre font-medium">{tree.topic || 'Topic'}</span>
              <input
                size={1}
                className="col-start-1 row-start-1 w-full min-w-0 border-0 bg-transparent p-0 text-center text-[11px] font-medium shadow-none outline-none focus:ring-0"
                value={tree.topic}
                onChange={(e) => onPatch({ ...tree, topic: e.target.value })}
                placeholder="Topic"
              />
            </span>
          </Tooltip>
          <TopicMeta tree={tree} onPatch={onPatch} />
          <InlineConfirm open={confirm} onCancel={() => setConfirm(false)} onConfirm={() => { onRemove(); setConfirm(false); }} message="Remove this topic?">
            <Button type="button" variant="ghost" size="icon" className={cn('h-4 w-4 text-muted-foreground hover:text-destructive', confirm ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} aria-label="Remove topic" onClick={() => setConfirm(true)}>
              <X className="h-3 w-3" />
            </Button>
          </InlineConfirm>
        </div>
      </div>
      {lines.map((line, index) => (
        <Bubble
          key={line.id || `${topicKey(tree)}-${index}`}
          line={line}
          side={meta[index].side}
          startsRun={meta[index].startsRun}
          portrait={meta[index].portrait}
          npcName={npcName}
          projectPath={projectPath}
          onChange={(text) => onPatch({ ...tree, dialogues: lines.map((entry, i) => (i === index ? { ...entry, text } : entry)) })}
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
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {chips.map((chip) => (
            <Tooltip key={`${chip.group}-${chip.index}-${chip.id}`} content={actionChipTooltip(chip)}>
              <Badge variant="secondary" className="border-0 px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
                {actionChipLabel(chip)}
              </Badge>
            </Tooltip>
          ))}
        </div>
      )}
      {responses.length > 0 && (
        <div className="mt-1.5 flex flex-wrap justify-end gap-1 pl-8">
          {responses.map((response) => (
            <Tooltip key={response.id} content={response.missing ? `response=${response.id} (topic not found)` : `response=${response.id}`}>
              <Badge
                variant="outline"
                role="button"
                className={cn('cursor-pointer gap-1 px-2 py-0.5 text-[11px] font-normal', response.missing ? 'border-destructive/50 text-destructive' : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400')}
                onClick={() => document.getElementById(topicDomId(response.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <CornerDownRight className="h-3 w-3" />
                {response.label}
              </Badge>
            </Tooltip>
          ))}
        </div>
      )}
    </section>
  );
};

/** WhatsApp-style input bar: speaker toggle, auto-growing line field, + menu, send. */
const Composer = ({ speaker, setSpeaker, onSend, onAddCondition, onAddEffect, onAddTopic, npcName, npcPortrait, projectPath, topicLabel }: {
  speaker: 'npc' | 'player';
  setSpeaker: (s: 'npc' | 'player') => void;
  onSend: (text: string) => void;
  onAddCondition: (type: string) => void;
  onAddEffect: (id: string) => void;
  onAddTopic: () => void;
  npcName: string;
  npcPortrait: string;
  projectPath?: string | null;
  topicLabel: string;
}) => {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <div className="flex items-end gap-1 border-t border-border/50 px-2 pb-1 pt-1.5">
      <Popover>
        <Tooltip content={`Add to “${topicLabel}”`}>
          <PopoverTrigger>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground" aria-label="Add">
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent side="top" align="start" className="w-56 space-y-1">
          <Button type="button" variant="ghost" className="h-7 w-full justify-start px-2 text-xs" onClick={onAddTopic}>
            <Plus className="mr-1 h-3 w-3" /> New topic
          </Button>
          <div className="flex gap-1">
            <SearchablePalette buttonLabel="Condition" placeholder="Search conditions…" entries={CONDITION_ENTRIES} onSelect={onAddCondition} />
            <SearchablePalette buttonLabel="Effect" placeholder="Search effects…" entries={EFFECT_ENTRIES} onSelect={onAddEffect} />
          </div>
        </PopoverContent>
      </Popover>
      <Tooltip content={speaker === 'npc' ? 'Speaking as the NPC (click for Player)' : 'Speaking as the Player (click for NPC)'}>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" aria-label="Switch speaker" onClick={() => setSpeaker(speaker === 'npc' ? 'player' : 'npc')}>
          {speaker === 'npc'
            ? <NpcAvatar portrait={npcPortrait} name={npcName} projectPath={projectPath} />
            : <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: PLAYER_BG }}><User className="h-3.5 w-3.5" /></span>}
        </Button>
      </Tooltip>
      <AutoGrowTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={speaker === 'npc' ? 'Type NPC line…' : 'Type player line…'}
        className="max-h-32 min-h-0 flex-1 resize-none rounded-2xl border-0 bg-muted px-3 py-1.5 text-[13px] leading-snug shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Tooltip content="Add line (Enter)">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-emerald-500" aria-label="Add line" onClick={send} disabled={!text.trim()}>
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
};

const MomentChatView = ({ trees, visibleTrees, setTrees, moment, npcName = '', npcPortrait = '', projectPath }: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState<'npc' | 'player'>('npc');
  const active = visibleTrees.find((tree) => topicKey(tree) === activeId) || visibleTrees[visibleTrees.length - 1] || null;

  const patchActive = (fn: (tree: DialogueTree) => DialogueTree) => {
    if (!active) return;
    setTrees(patchTree(trees, topicKey(active), fn(active)));
  };

  const addTopic = () => {
    const id = `dlg_${Math.random().toString(36).slice(2, 6)}`;
    const blank: DialogueTree = { id, dialogueId: id, topic: '', responses: [], requirements: [], dialogues: [], rewards: [], worldEffects: [] };
    setTrees([...trees, applyMomentToTopic(blank, moment)]);
    setActiveId(id);
    requestAnimationFrame(() => document.getElementById(topicDomId(id))?.scrollIntoView({ block: 'end' }));
  };

  const removeTopic = (id: string) => {
    setTrees(trees.filter((tree) => topicKey(tree) !== id).map((tree) => ({
      ...tree,
      responses: (tree.responses || []).filter((response) => response !== id),
    })));
  };

  const send = (text: string) => {
    if (!active) {
      const id = `dlg_${Math.random().toString(36).slice(2, 6)}`;
      const blank: DialogueTree = { id, dialogueId: id, topic: '', responses: [], requirements: [], dialogues: [{ id: newId(), speaker, text }], rewards: [], worldEffects: [] };
      setTrees([...trees, applyMomentToTopic(blank, moment)]);
      setActiveId(id);
      return;
    }
    patchActive((tree) => ({ ...tree, dialogues: [...(tree.dialogues || []), { id: newId(), speaker, text }] }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-background">
      <div className="minimal-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {visibleTrees.map((tree) => (
          <TopicThread
            key={topicKey(tree)}
            tree={tree}
            allTrees={trees}
            active={!!active && topicKey(active) === topicKey(tree)}
            onActivate={() => setActiveId(topicKey(tree))}
            onPatch={(next) => setTrees(patchTree(trees, topicKey(tree), next))}
            onRemove={() => removeTopic(topicKey(tree))}
            npcName={npcName}
            npcPortrait={npcPortrait}
            projectPath={projectPath}
          />
        ))}
        {visibleTrees.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No topics yet</div>
        )}
      </div>
      <Composer
        speaker={speaker}
        setSpeaker={setSpeaker}
        onSend={send}
        onAddCondition={(type) => patchActive((tree) => addCondition(tree, type as DialogueRequirement['type']))}
        onAddEffect={(id) => patchActive((tree) => addEffect(tree, id))}
        onAddTopic={addTopic}
        npcName={npcName}
        npcPortrait={npcPortrait}
        projectPath={projectPath}
        topicLabel={active?.topic || 'new topic'}
      />
    </div>
  );
};

export default MomentChatView;
