import React, { useMemo, useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import SearchablePalette from '@/components/ui/searchable-palette';
import WhenDoneRow, { type WhenDoneRewards } from '@/components/WhenDoneRow';
import useListReorder from '@/hooks/useListReorder';
import {
  addQuestStep,
  applyChipsToStep,
  chipLabel,
  chipTooltip,
  chipsFromStep,
  filterConditionCatalog,
  reorderQuestSteps,
  stepCardTitle,
  type QuestConditionChip,
  type QuestConditionKind,
  type QuestStep,
  type QuestStepContext,
} from '@/editor/questSteps';

type ItemOption = { id: string | number; name?: string };

type Props = {
  steps: QuestStep[];
  onChange: (steps: QuestStep[]) => void;
  ctx: QuestStepContext;
  items?: ItemOption[];
  completeStatus?: string;
  onCompleteStatusChange?: (value: string) => void;
  rewards?: WhenDoneRewards;
  onRewardsChange?: (rewards: WhenDoneRewards) => void;
};

const chipClass = 'inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] leading-tight';

const ConditionChip = ({
  chip,
  ctx,
  items,
  onChange,
  onRemove,
}: {
  chip: QuestConditionChip;
  ctx: QuestStepContext;
  items: ItemOption[];
  onChange: (chip: QuestConditionChip) => void;
  onRemove: () => void;
}) => {
  const [editing, setEditing] = useState(!chip.value);
  const isItem = chip.kind === 'requires_item' || chip.kind === 'requires_not_item';
  const isNumber = chip.kind.includes('level') || chip.kind.includes('currency');

  return (
    <Tooltip content={chipTooltip(chip)}>
      <span className={chipClass}>
        {editing ? (
          <>
            {isItem && items.length > 0 ? (
              <select
                autoFocus
                className="h-5 max-w-[9rem] bg-transparent text-[11px] outline-none"
                value={chip.value}
                onChange={(e) => onChange({ ...chip, value: e.target.value })}
                onBlur={() => setEditing(false)}
              >
                <option value="">Item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name || item.id}</option>
                ))}
              </select>
            ) : (
              <input
                autoFocus
                className="h-5 w-20 bg-transparent text-[11px] outline-none"
                type={isNumber ? 'number' : 'text'}
                value={chip.value}
                onChange={(e) => onChange({ ...chip, value: e.target.value })}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditing(false);
                }}
              />
            )}
            {isItem && (
              <input
                className="h-5 w-8 bg-transparent text-[11px] outline-none"
                type="number"
                min={1}
                value={chip.quantity || 1}
                onChange={(e) => onChange({ ...chip, quantity: Math.max(1, Number(e.target.value) || 1) })}
              />
            )}
          </>
        ) : (
          <button type="button" className="text-left" onClick={() => setEditing(true)}>
            {chipLabel(chip, ctx)}
          </button>
        )}
        <button type="button" aria-label="Remove" className="text-muted-foreground hover:text-foreground" onClick={onRemove}>
          <X className="w-3 h-3" />
        </button>
      </span>
    </Tooltip>
  );
};

const QuestStepCards = ({ steps, onChange, ctx, items = [], completeStatus = '', onCompleteStatusChange, rewards = {}, onRewardsChange }: Props) => {
  const itemName = useMemo(() => {
    const map = new Map(items.map((item) => [String(item.id), item.name || String(item.id)]));
    return (id: string) => map.get(id) || id;
  }, [items]);
  const labeledCtx = { ...ctx, itemName };
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const reorder = useListReorder(steps, (step) => step.id, (from, to) => onChange(reorderQuestSteps(steps, from, to)));

  const updateStep = (index: number, next: QuestStep) => {
    onChange(steps.map((step, i) => (i === index ? next : step)));
  };

  const addCondition = (index: number, kind: QuestConditionKind) => {
    const step = steps[index];
    const chips = chipsFromStep(step);
    chips.push({ id: `${step.id}-${kind}-${chips.length}`, kind, value: '', quantity: kind.includes('item') ? 1 : undefined });
    updateStep(index, applyChipsToStep(step, chips));
  };

  const catalogEntries = useMemo(
    () =>
      filterConditionCatalog('').map((entry) => ({
        id: entry.kind,
        label: entry.label,
        tooltip: `${entry.flareKey} — ${entry.description}`,
        searchText: [entry.label, entry.flareKey, entry.description, ...entry.synonyms].join(' '),
      })),
    [],
  );

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const chips = chipsFromStep(step);
        return (
          <div
            key={step.id}
            className={`rounded-lg border border-border bg-muted/20 p-3 space-y-2 ${reorder.reorderClass(index)}`}
            {...reorder.getItemDropProps(index)}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="mt-0.5 text-muted-foreground cursor-grab active:cursor-grabbing"
                aria-label="Reorder step"
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  reorder.startReorder(e, index);
                }}
                onDragEnd={reorder.endReorder}
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold truncate">{stepCardTitle(step.quest_text, index)}</h5>
                  <InlineConfirm
                    open={confirmIndex === index}
                    onCancel={() => setConfirmIndex(null)}
                    onConfirm={() => {
                      onChange(steps.filter((_, i) => i !== index));
                      setConfirmIndex(null);
                    }}
                    message="Remove this step?"
                  >
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                      aria-label="Remove step"
                      onClick={() => setConfirmIndex(index)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </InlineConfirm>
                </div>
                <textarea
                  value={step.quest_text}
                  onChange={(e) => updateStep(index, { ...step, quest_text: e.target.value })}
                  placeholder="Journal text"
                  className="w-full min-h-[72px] rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {chips.map((chip) => (
                    <ConditionChip
                      key={chip.id}
                      chip={chip}
                      ctx={labeledCtx}
                      items={items}
                      onChange={(nextChip) => {
                        const next = chips.map((entry) => (entry.id === chip.id ? nextChip : entry));
                        updateStep(index, applyChipsToStep(step, next));
                      }}
                      onRemove={() => {
                        updateStep(index, applyChipsToStep(step, chips.filter((entry) => entry.id !== chip.id)));
                      }}
                    />
                  ))}
                  <SearchablePalette
                    buttonLabel="Add property"
                    entries={catalogEntries}
                    onSelect={(id) => addCondition(index, id as QuestConditionKind)}
                  />
                </div>
                <WhenDoneRow
                  completeStatus={completeStatus}
                  onCompleteStatusChange={onCompleteStatusChange || (() => {})}
                  rewards={rewards}
                  onRewardsChange={onRewardsChange || (() => {})}
                  items={items}
                />
              </div>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1"
        onClick={() => onChange(addQuestStep(steps, ctx))}
      >
        <Plus className="w-3.5 h-3.5" />
        Step
      </Button>
    </div>
  );
};

export default QuestStepCards;
