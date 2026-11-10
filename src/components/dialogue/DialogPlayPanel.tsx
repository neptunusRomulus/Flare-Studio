import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import type { DialogueTree } from '@/types';
import {
  applyTopicActions,
  emptyPlayState,
  togglePlayStatus,
  visibleTopics,
  type PlayState,
} from '@/editor/dialogPlay';

type Props = {
  trees: DialogueTree[];
  onClose: () => void;
};

const knownStatuses = (trees: DialogueTree[]): string[] => {
  const values: string[] = [];
  for (const tree of trees) {
    for (const req of tree.requirements || []) {
      if (req.type === 'status' || req.type === 'not_status') values.push(...String(req.value || '').split(','));
    }
    for (const effect of tree.worldEffects || []) {
      if (effect.type === 'set_status' || effect.type === 'unset_status') values.push(...String(effect.value || '').split(','));
    }
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const DialogPlayPanel = ({ trees, onClose }: Props) => {
  const [state, setState] = useState<PlayState>(() => emptyPlayState());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [customStatus, setCustomStatus] = useState('');
  const offered = useMemo(() => visibleTopics(trees, state), [trees, state]);
  const active = trees.find((tree) => (tree.dialogueId || tree.id) === activeId) || null;
  const statuses = useMemo(() => {
    const list = new Set([...knownStatuses(trees), ...state.statuses]);
    return [...list];
  }, [trees, state.statuses]);

  const openTopic = (tree: DialogueTree) => {
    setActiveId(tree.dialogueId || tree.id);
  };

  const finishTopic = (responseId?: string) => {
    if (!active) return;
    const next = applyTopicActions(active, state);
    setState(next);
    if (responseId) {
      const target = trees.find((tree) => tree.dialogueId === responseId);
      setActiveId(target && visibleTopics([target], next).length ? (target.dialogueId || target.id) : null);
    } else {
      setActiveId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex gap-2 overflow-hidden">
      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto space-y-3 pr-1">
        {!active && (
          <div className="space-y-1.5">
            {offered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No topics</p>
            ) : (
              offered.map((tree) => (
                <button
                  key={tree.dialogueId || tree.id}
                  type="button"
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                  onClick={() => openTopic(tree)}
                >
                  {tree.topic || tree.dialogueId}
                </button>
              ))
            )}
          </div>
        )}
        {active && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{active.topic || active.dialogueId}</p>
            {(active.dialogues || []).map((line) => (
              <div key={line.id} className={`flex ${line.speaker === 'player' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${line.speaker === 'player' ? 'bg-blue-500/15 rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                  {line.text}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 justify-end">
              {(active.responses || []).map((id) => {
                const target = trees.find((tree) => tree.dialogueId === id);
                const label = target?.dialogues?.find((line) => line.speaker === 'player')?.text || target?.topic || id;
                return (
                  <button
                    key={id}
                    type="button"
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted"
                    onClick={() => finishTopic(id)}
                  >
                    {label}
                  </button>
                );
              })}
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => finishTopic()}>
                Continue
              </Button>
            </div>
          </div>
        )}
      </div>
      <aside className="w-44 shrink-0 border-l border-border pl-2 overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Play</span>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Stop" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <label className="block text-[11px]">
          Level
          <Input className="h-7 mt-1 text-xs" type="number" min={1} value={state.level} onChange={(e) => setState((prev) => ({ ...prev, level: Math.max(1, Number(e.target.value) || 1) }))} />
        </label>
        <label className="block text-[11px]">
          Currency
          <Input className="h-7 mt-1 text-xs" type="number" min={0} value={state.currency} onChange={(e) => setState((prev) => ({ ...prev, currency: Math.max(0, Number(e.target.value) || 0) }))} />
        </label>
        <div className="space-y-1">
          <p className="text-[11px] font-medium">Statuses</p>
          {statuses.map((status) => (
            <label key={status} className="flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={state.statuses.includes(status)}
                onChange={() => setState((prev) => togglePlayStatus(prev, status))}
              />
              <Tooltip content={status}>
                <span className="truncate">{status.replace(/[_-]+/g, ' ')}</span>
              </Tooltip>
            </label>
          ))}
          <div className="flex gap-1">
            <Input className="h-7 text-xs" value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder="Status" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                const value = customStatus.trim();
                if (!value) return;
                setState((prev) => togglePlayStatus(prev, value, true));
                setCustomStatus('');
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default DialogPlayPanel;
