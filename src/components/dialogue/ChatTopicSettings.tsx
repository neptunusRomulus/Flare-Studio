import React, { useEffect, useState } from 'react';
import { Link2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Tooltip from '@/components/ui/tooltip';
import {
  allowMovementOf,
  groundLootCountOf,
  lootCountOf,
  takePartyOf,
  withAllowMovement,
  withGroundLootCount,
  withLootCount,
  withTakeParty,
} from '@/editor/dialoguePassthrough';
import type { DialogueTree } from '@/types';

const EMPTY = '__empty__';

const CountFields = ({
  label,
  tooltip,
  min,
  max,
  onChange,
}: {
  label: string;
  tooltip: string;
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}) => (
  <div className="flex items-center gap-1.5">
    <Tooltip content={tooltip}>
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
    </Tooltip>
    <Input
      className="h-6 w-12 px-1 text-xs"
      value={min}
      inputMode="numeric"
      placeholder="min"
      aria-label={`${label} min`}
      onChange={(e) => onChange(e.target.value, max)}
    />
    <span className="text-[10px] text-muted-foreground">–</span>
    <Input
      className="h-6 w-12 px-1 text-xs"
      value={max}
      inputMode="numeric"
      placeholder="max"
      aria-label={`${label} max`}
      onChange={(e) => onChange(min, e.target.value)}
    />
  </div>
);

const ChatTopicSettings = ({
  tree,
  allTrees,
  onPatch,
  onRenameId,
}: {
  tree: DialogueTree;
  allTrees: DialogueTree[];
  onPatch: (next: DialogueTree) => void;
  onRenameId: (nextId: string) => void;
}) => {
  const [draftId, setDraftId] = useState(tree.dialogueId || '');
  useEffect(() => {
    setDraftId(tree.dialogueId || '');
  }, [tree.dialogueId]);

  const commitId = () => onRenameId(draftId);
  const loot = lootCountOf(tree);
  const ground = groundLootCountOf(tree);
  const responses = tree.responses || [];
  const targets = allTrees.filter((entry) => (entry.dialogueId || entry.id) !== (tree.dialogueId || tree.id));

  const setResponse = (index: number, value: string) => {
    const next = [...responses];
    next[index] = value;
    onPatch({ ...tree, responses: next });
  };

  return (
    <Popover>
      <Tooltip content="Topic settings">
        <PopoverTrigger>
          <Button type="button" variant="ghost" size="sm" className="h-auto py-0 px-1 text-muted-foreground/80" aria-label="Topic settings">
            <Settings2 className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-72 space-y-2 text-left">
        <div className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">Topic</div>
        <div className="flex items-center gap-1.5 px-1">
          <Label htmlFor={`dialogue-id-${tree.id}`} className="w-28 shrink-0 text-[11px] font-normal text-muted-foreground">ID</Label>
          <Input
            id={`dialogue-id-${tree.id}`}
            className="h-6 flex-1 px-1 text-xs"
            value={draftId}
            placeholder="dlg_xxxx"
            onChange={(e) => setDraftId(e.target.value)}
            onBlur={commitId}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>
        <div className="flex items-center gap-2 px-1">
          <Switch
            id={`response-only-${tree.id}`}
            checked={!!tree.responseOnly}
            onCheckedChange={(checked) => onPatch({ ...tree, responseOnly: checked })}
            className="scale-75"
          />
          <Tooltip content="Hidden from the topic list, only reachable via a response link">
            <Label htmlFor={`response-only-${tree.id}`} className="text-[11px] font-normal text-muted-foreground">Response only</Label>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 px-1">
          <Switch
            id={`allow-movement-${tree.id}`}
            checked={allowMovementOf(tree)}
            onCheckedChange={(checked) => onPatch({ ...tree, passthrough: withAllowMovement(tree, checked) })}
            className="scale-75"
          />
          <Tooltip content="allow_movement: when off, the player can't move while this dialog is open.">
            <Label htmlFor={`allow-movement-${tree.id}`} className="text-[11px] font-normal text-muted-foreground">Allow movement</Label>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 px-1">
          <Switch
            id={`take-party-${tree.id}`}
            checked={takePartyOf(tree)}
            onCheckedChange={(checked) => onPatch({ ...tree, passthrough: withTakeParty(tree, checked) })}
            className="scale-75"
          />
          <Tooltip content="take_a_party: the NPC joins or leaves the player's party while this dialog runs.">
            <Label htmlFor={`take-party-${tree.id}`} className="text-[11px] font-normal text-muted-foreground">Take a party</Label>
          </Tooltip>
        </div>
        <CountFields
          label="Reward loot count"
          tooltip="reward_loot_count: how many items the reward_loot drop can roll."
          min={loot.min}
          max={loot.max}
          onChange={(min, max) => onPatch({ ...tree, passthrough: withLootCount(tree, min, max) })}
        />
        <CountFields
          label="Drop loot count"
          tooltip="loot_count: how many items a ground loot= drop can roll."
          min={ground.min}
          max={ground.max}
          onChange={(min, max) => onPatch({ ...tree, passthrough: withGroundLootCount(tree, min, max) })}
        />
        <div className="space-y-1">
          <div className="flex items-center gap-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Link2 className="h-3 w-3" /> Responses
          </div>
          {responses.map((id, index) => (
            <div key={`${id}-${index}`} className="flex items-center gap-1">
              <Select
                value={id || EMPTY}
                onValueChange={(value) => setResponse(index, value === EMPTY ? '' : value)}
              >
                <SelectTrigger className="h-6 flex-1 px-2 text-xs">
                  <SelectValue placeholder="Choose topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Choose topic</SelectItem>
                  {targets.map((entry) => {
                    const value = entry.dialogueId || entry.id;
                    return (
                      <SelectItem key={value} value={value}>
                        {entry.topic || value}
                      </SelectItem>
                    );
                  })}
                  {id && !targets.some((entry) => (entry.dialogueId || entry.id) === id) && (
                    <SelectItem value={id}>{id}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                aria-label="Remove response"
                onClick={() => onPatch({ ...tree, responses: responses.filter((_, i) => i !== index) })}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onPatch({ ...tree, responses: [...responses, ''] })}
          >
            Add response
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ChatTopicSettings;
