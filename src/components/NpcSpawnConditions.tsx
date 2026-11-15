import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Tooltip from '@/components/ui/tooltip';
import { STORY_FLAG_LIST_ID } from '@/editor/powers/storyFlags';
import { HelpCircle, Plus, X } from 'lucide-react';
import type { MapObject } from '@/types';

type Props = {
  properties: MapObject['properties'];
  get: (key: string, fallback?: string) => string;
  setProp: (key: string, value: string | null) => void;
};

type ConditionKind = 'level' | 'currency' | 'status' | 'item' | 'class';

const KIND_LABEL: Record<ConditionKind, string> = {
  level: 'Level',
  currency: 'Currency',
  status: 'Status',
  item: 'Item',
  class: 'Class',
};

const hasLevel = (p: Record<string, unknown> | undefined) =>
  !!p && ('requires_level' in p || 'requires_not_level' in p);
const hasCurrency = (p: Record<string, unknown> | undefined) =>
  !!p && ('requires_currency' in p || 'requires_not_currency' in p);
const hasStatus = (p: Record<string, unknown> | undefined) =>
  !!p && ('requires_status' in p || 'requires_not_status' in p);
const hasItem = (p: Record<string, unknown> | undefined) =>
  !!p && ('requires_item' in p || 'requires_not_item' in p || 'requires_item_quantity' in p || 'requires_not_item_quantity' in p);
const hasClass = (p: Record<string, unknown> | undefined) =>
  !!p && ('requires_class' in p || 'requires_not_class' in p);

export function countSpawnConditionGroups(properties: Record<string, unknown> | undefined): number {
  let n = 0;
  if (hasLevel(properties)) n += 1;
  if (hasCurrency(properties)) n += 1;
  if (hasStatus(properties)) n += 1;
  if (hasItem(properties)) n += 1;
  if (hasClass(properties)) n += 1;
  return n;
}

const clearKeys = (setProp: Props['setProp'], keys: string[]) => {
  for (const key of keys) setProp(key, null);
};

const polarityToggle = (
  have: boolean,
  onHave: () => void,
  onHaveNot: () => void,
) => (
  <div className="flex rounded-md border border-border overflow-hidden shrink-0">
    <Button
      type="button"
      variant="ghost"
      aria-pressed={have}
      className={`h-7 px-2 text-[10px] rounded-none ${have ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
      onClick={onHave}
    >
      Have
    </Button>
    <Button
      type="button"
      variant="ghost"
      aria-pressed={!have}
      className={`h-7 px-2 text-[10px] rounded-none border-l border-border ${!have ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
      onClick={onHaveNot}
    >
      Have not
    </Button>
  </div>
);

const NpcSpawnConditions = ({ properties, get, setProp }: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const props = properties || {};

  const activeKinds: ConditionKind[] = [];
  if (hasLevel(props)) activeKinds.push('level');
  if (hasCurrency(props)) activeKinds.push('currency');
  if (hasStatus(props)) activeKinds.push('status');
  if (hasItem(props)) activeKinds.push('item');
  if (hasClass(props)) activeKinds.push('class');

  const available = (Object.keys(KIND_LABEL) as ConditionKind[]).filter((k) => !activeKinds.includes(k));

  const addKind = (kind: ConditionKind) => {
    setMenuOpen(false);
    if (kind === 'level') setProp('requires_level', '');
    else if (kind === 'currency') setProp('requires_currency', '');
    else if (kind === 'status') setProp('requires_status', '');
    else if (kind === 'item') setProp('requires_item', '');
    else if (kind === 'class') setProp('requires_class', '');
  };

  const statusHave = 'requires_status' in props || !('requires_not_status' in props);
  const itemHave = 'requires_item' in props || 'requires_item_quantity' in props
    || (!('requires_not_item' in props) && !('requires_not_item_quantity' in props));
  const classHave = 'requires_class' in props || !('requires_not_class' in props);

  return (
    <div className="space-y-2">
      {activeKinds.includes('level') && (
        <div className="flex items-center gap-1.5">
          <Tooltip content="requires_level / requires_not_level — Player level range to load this NPC. Empty side = no limit.">
            <Label className="text-[10px] font-normal text-muted-foreground w-16 shrink-0 flex items-center gap-0.5">
              Level
              <HelpCircle className="w-3 h-3" />
            </Label>
          </Tooltip>
          <Input
            type="number"
            className="h-7 text-xs w-16"
            value={get('requires_level', '')}
            onChange={(e) => setProp('requires_level', e.target.value === '' ? null : e.target.value)}
            placeholder="Min"
            min={0}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            className="h-7 text-xs w-16"
            value={get('requires_not_level', '')}
            onChange={(e) => setProp('requires_not_level', e.target.value === '' ? null : e.target.value)}
            placeholder="Max"
            min={0}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 flex items-center justify-center rounded hover:bg-muted p-0"
            aria-label="Remove level condition"
            onClick={() => clearKeys(setProp, ['requires_level', 'requires_not_level'])}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {activeKinds.includes('currency') && (
        <div className="flex items-center gap-1.5">
          <Tooltip content="requires_currency / requires_not_currency — Player currency range to load this NPC. Empty side = no limit.">
            <Label className="text-[10px] font-normal text-muted-foreground w-16 shrink-0 flex items-center gap-0.5">
              Currency
              <HelpCircle className="w-3 h-3" />
            </Label>
          </Tooltip>
          <Input
            type="number"
            className="h-7 text-xs w-16"
            value={get('requires_currency', '')}
            onChange={(e) => setProp('requires_currency', e.target.value === '' ? null : e.target.value)}
            placeholder="Min"
            min={0}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            className="h-7 text-xs w-16"
            value={get('requires_not_currency', '')}
            onChange={(e) => setProp('requires_not_currency', e.target.value === '' ? null : e.target.value)}
            placeholder="Max"
            min={0}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 flex items-center justify-center rounded hover:bg-muted p-0"
            aria-label="Remove currency condition"
            onClick={() => clearKeys(setProp, ['requires_currency', 'requires_not_currency'])}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {activeKinds.includes('status') && (
        <div className="flex items-center gap-1.5">
          <Tooltip content="requires_status / requires_not_status — Campaign statuses that must (or must not) be active.">
            <Label className="text-[10px] font-normal text-muted-foreground w-16 shrink-0 flex items-center gap-0.5">
              Status
              <HelpCircle className="w-3 h-3" />
            </Label>
          </Tooltip>
          {polarityToggle(
            statusHave,
            () => {
              const v = get('requires_not_status', '') || get('requires_status', '');
              clearKeys(setProp, ['requires_not_status']);
              setProp('requires_status', v);
            },
            () => {
              const v = get('requires_status', '') || get('requires_not_status', '');
              clearKeys(setProp, ['requires_status']);
              setProp('requires_not_status', v);
            },
          )}
          <Input
            className="h-7 text-xs flex-1"
            value={statusHave ? get('requires_status', '') : get('requires_not_status', '')}
            onChange={(e) => setProp(statusHave ? 'requires_status' : 'requires_not_status', e.target.value)}
            placeholder="e.g. quest_started"
            list={STORY_FLAG_LIST_ID}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted p-0"
            aria-label="Remove status condition"
            onClick={() => clearKeys(setProp, ['requires_status', 'requires_not_status'])}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {activeKinds.includes('item') && (
        <div className="flex items-center gap-1.5">
          <Tooltip content="requires_item / requires_not_item — Item that must (or must not) be in the player inventory.">
            <Label className="text-[10px] font-normal text-muted-foreground w-16 shrink-0 flex items-center gap-0.5">
              Item
              <HelpCircle className="w-3 h-3" />
            </Label>
          </Tooltip>
          {polarityToggle(
            itemHave,
            () => {
              const id = get('requires_not_item', '') || get('requires_item', '');
              const qty = get('requires_not_item_quantity', '') || get('requires_item_quantity', '');
              clearKeys(setProp, ['requires_not_item', 'requires_not_item_quantity']);
              setProp('requires_item', id);
              if (qty) setProp('requires_item_quantity', qty);
            },
            () => {
              const id = get('requires_item', '') || get('requires_not_item', '');
              const qty = get('requires_item_quantity', '') || get('requires_not_item_quantity', '');
              clearKeys(setProp, ['requires_item', 'requires_item_quantity']);
              setProp('requires_not_item', id);
              if (qty) setProp('requires_not_item_quantity', qty);
            },
          )}
          <Input
            className="h-7 text-xs flex-1"
            value={itemHave ? get('requires_item', '') : get('requires_not_item', '')}
            onChange={(e) => setProp(itemHave ? 'requires_item' : 'requires_not_item', e.target.value)}
            placeholder="Item"
          />
          <Input
            type="number"
            className="h-7 text-xs w-14"
            value={itemHave ? get('requires_item_quantity', '') : get('requires_not_item_quantity', '')}
            onChange={(e) => setProp(itemHave ? 'requires_item_quantity' : 'requires_not_item_quantity', e.target.value || null)}
            placeholder="Qty"
            min={1}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted p-0"
            aria-label="Remove item condition"
            onClick={() => clearKeys(setProp, ['requires_item', 'requires_item_quantity', 'requires_not_item', 'requires_not_item_quantity'])}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {activeKinds.includes('class') && (
        <div className="flex items-center gap-1.5">
          <Tooltip content="requires_class / requires_not_class — Player base class that must (or must not) match.">
            <Label className="text-[10px] font-normal text-muted-foreground w-16 shrink-0 flex items-center gap-0.5">
              Class
              <HelpCircle className="w-3 h-3" />
            </Label>
          </Tooltip>
          {polarityToggle(
            classHave,
            () => {
              const v = get('requires_not_class', '') || get('requires_class', '');
              clearKeys(setProp, ['requires_not_class']);
              setProp('requires_class', v);
            },
            () => {
              const v = get('requires_class', '') || get('requires_not_class', '');
              clearKeys(setProp, ['requires_class']);
              setProp('requires_not_class', v);
            },
          )}
          <Input
            className="h-7 text-xs flex-1"
            value={classHave ? get('requires_class', '') : get('requires_not_class', '')}
            onChange={(e) => setProp(classHave ? 'requires_class' : 'requires_not_class', e.target.value)}
            placeholder="e.g. warrior"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted p-0"
            aria-label="Remove class condition"
            onClick={() => clearKeys(setProp, ['requires_class', 'requires_not_class'])}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {available.length > 0 && (
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex items-center gap-1"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Plus className="w-3.5 h-3.5" />
            Add condition
          </Button>
          {menuOpen && (
            <div className="absolute z-20 mt-1 min-w-[8rem] rounded-md border border-border bg-background shadow-md py-1">
              {available.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full px-3 py-1.5 text-left text-xs hover:bg-muted rounded-none"
                  onClick={() => addKind(kind)}
                >
                  {KIND_LABEL[kind]}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NpcSpawnConditions;
