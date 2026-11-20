import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HintLabel } from '@/components/ui/field-hint';
import SearchablePalette from '@/components/ui/searchable-palette';
import type { PrimaryStat } from '@/editor/statsTitles';
import { parsePosition, updateNode, type PowerTreeNode } from '@/editor/powerTree';
import { Plus, Trash2 } from 'lucide-react';

export type PowerOption = { id: string; name: string };

function splitPrimary(value: string): { stat: string; min: string } {
  const at = value.indexOf(',');
  if (at < 0) return { stat: value.trim(), min: '' };
  return { stat: value.slice(0, at).trim(), min: value.slice(at + 1).trim() };
}

/** Shared requirement/visibility fields for a [power] or [upgrade] block. */
export default function PowerTreeNodeFields({
  node,
  primaries,
  powerOptions,
  showPlacement,
  showUpgrades,
  upgradeIds,
  onChange,
  onChangeUpgrades,
}: {
  node: PowerTreeNode;
  primaries: PrimaryStat[];
  powerOptions: PowerOption[];
  showPlacement?: boolean;
  showUpgrades?: boolean;
  upgradeIds?: string[];
  onChange: (next: PowerTreeNode) => void;
  onChangeUpgrades?: (ids: string[]) => void;
}) {
  const patch = (next: Parameters<typeof updateNode>[1]) => onChange(updateNode(node, next));
  const entries = powerOptions.map((p) => ({ id: p.id, label: p.name ? `${p.name} (${p.id})` : p.id, searchText: `${p.name} ${p.id}` }));
  const pos = parsePosition(node.position);
  const usedPowerIds = new Set(node.requires_power);
  const statIds = new Set(primaries.map((s) => s.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <HintLabel className="text-xs font-normal" hint="id — a power id from powers/powers.txt. The same id may appear on more than one tab.">Id</HintLabel>
          <div className="flex items-center gap-1">
            <Input width="id" className="h-7 text-xs font-mono" value={node.id} onChange={(e) => patch({ id: e.target.value })} aria-label="Power id" />
            <SearchablePalette buttonLabel="Pick" placeholder="Search powers…" entries={entries} onSelect={(id) => patch({ id })} />
          </div>
        </div>
        {showPlacement ? (
          <>
            <div>
              <HintLabel className="text-xs font-normal" hint="tab — 0-based tab index this icon is drawn on.">Tab</HintLabel>
              <Input width="num" className="h-7 text-xs" value={node.tab} onChange={(e) => patch({ tab: e.target.value })} aria-label="Tab index" />
            </div>
            <div>
              <HintLabel className="text-xs font-normal" hint="position — pixel x,y of the icon, relative to the Powers menu pos.">Position</HintLabel>
              <div className="flex items-center gap-1">
                <Input width="num" className="h-7 text-xs" value={Number.isFinite(pos.x) ? String(pos.x) : ''} onChange={(e) => patch({ position: `${e.target.value || 0},${pos.y}` })} aria-label="Position x" />
                <Input width="num" className="h-7 text-xs" value={Number.isFinite(pos.y) ? String(pos.y) : ''} onChange={(e) => patch({ position: `${pos.x},${e.target.value || 0}` })} aria-label="Position y" />
              </div>
            </div>
          </>
        ) : null}
        <div>
          <HintLabel className="text-xs font-normal" hint="requires_level — hero must be at least this level.">Level</HintLabel>
          <Input width="num" className="h-7 text-xs" value={node.requires_level} onChange={(e) => patch({ requires_level: e.target.value })} aria-label="Requires level" />
        </div>
        <HintLabel className="flex items-center gap-2 text-xs font-normal" hint="requires_point — if true, unlocking this spends a power point. If omitted or false and requirements are met, Flare unlocks it automatically.">
          <Checkbox checked={node.requires_point === true} onCheckedChange={(value) => patch({ requires_point: value === true ? true : undefined })} />
          Requires point
        </HintLabel>
      </div>

      <div className="space-y-1">
        <HintLabel className="text-xs font-normal" hint="requires_primary — repeatable. The named primary stat must be at least this value.">Primary stats</HintLabel>
        {node.requires_primary.map((line, index) => {
          const { stat, min } = splitPrimary(line);
          const change = (nextStat: string, nextMin: string) => {
            const next = node.requires_primary.map((entry, i) => (i === index ? `${nextStat}${nextMin === '' ? '' : `,${nextMin}`}` : entry));
            patch({ requires_primary: next });
          };
          return (
            <div key={`prim-${index}`} className="flex items-center gap-1">
              <Select value={stat || '_none'} onValueChange={(value) => change(value === '_none' ? '' : value, min)}>
                <SelectTrigger width="id" className="h-7 text-xs"><SelectValue placeholder="Stat" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Stat</SelectItem>
                  {stat && !statIds.has(stat) ? <SelectItem value={stat}>{stat}</SelectItem> : null}
                  {primaries.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name || item.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input width="num" className="h-7 text-xs" value={min} onChange={(e) => change(stat, e.target.value)} aria-label="Minimum primary" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove primary requirement" onClick={() => patch({ requires_primary: node.requires_primary.filter((_, i) => i !== index) })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          );
        })}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => patch({ requires_primary: [...node.requires_primary, primaries[0] ? `${primaries[0].id},1` : 'physical,1'] })}>
          <Plus className="w-3 h-3 mr-1" />Primary
        </Button>
      </div>

      <div className="space-y-1">
        <HintLabel className="text-xs font-normal" hint="requires_power — repeatable. These power ids must already be unlocked.">Requires power</HintLabel>
        {node.requires_power.map((id, index) => (
          <div key={`req-${index}`} className="flex items-center gap-1">
            <Input width="id" className="h-7 text-xs font-mono" value={id} onChange={(e) => patch({ requires_power: node.requires_power.map((entry, i) => (i === index ? e.target.value : entry)) })} aria-label="Required power id" />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove required power" onClick={() => patch({ requires_power: node.requires_power.filter((_, i) => i !== index) })}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <SearchablePalette
          buttonLabel="Add power"
          placeholder="Search powers…"
          entries={entries.filter((entry) => !usedPowerIds.has(entry.id))}
          onSelect={(id) => patch({ requires_power: [...node.requires_power, id] })}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <StatusList label="Requires status" hint="requires_status — campaign status that must be set." values={node.requires_status} onChange={(values) => patch({ requires_status: values })} />
        <StatusList label="Requires not status" hint="requires_not_status — campaign status that must not be set." values={node.requires_not_status} onChange={(values) => patch({ requires_not_status: values })} />
      </div>

      <div className="flex flex-wrap gap-3">
        <HintLabel className="flex items-center gap-2 text-xs font-normal" hint="visible — hide this slot regardless of unlock state. Defaults to true when omitted.">
          <Checkbox checked={node.visible !== false} onCheckedChange={(value) => patch({ visible: value === true ? undefined : false })} />
          Visible
        </HintLabel>
        <HintLabel className="flex items-center gap-2 text-xs font-normal" hint="visible_check_locked — hide the slot while it is locked.">
          <Checkbox checked={node.visible_check_locked === true} onCheckedChange={(value) => patch({ visible_check_locked: value === true ? true : undefined })} />
          Hide if locked
        </HintLabel>
        <HintLabel className="flex items-center gap-2 text-xs font-normal" hint="visible_check_status — hide the slot if its status requirements are not met.">
          <Checkbox checked={node.visible_check_status === true} onCheckedChange={(value) => patch({ visible_check_status: value === true ? true : undefined })} />
          Hide if status fails
        </HintLabel>
      </div>

      {showUpgrades ? (
        <div className="space-y-1">
          <HintLabel className="text-xs font-normal" hint="upgrades — comma-separated power ids this slot can upgrade to. Each id needs a matching [upgrade] section, which is created or removed here.">Upgrades</HintLabel>
          {(upgradeIds || node.upgrades).map((id, index) => {
            const list = upgradeIds || node.upgrades;
            return (
              <div key={`up-${index}`} className="flex items-center gap-1">
                <Input
                  width="id"
                  className="h-7 text-xs font-mono"
                  value={id}
                  onChange={(e) => onChangeUpgrades?.(list.map((entry, i) => (i === index ? e.target.value : entry)))}
                  aria-label="Upgrade power id"
                />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove upgrade" onClick={() => onChangeUpgrades?.(list.filter((_, i) => i !== index))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
          <div className="flex items-center gap-1">
            <SearchablePalette buttonLabel="Add upgrade" placeholder="Search powers…" entries={entries} onSelect={(id) => onChangeUpgrades?.([...(upgradeIds || node.upgrades), id])} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusList({ label, hint, values, onChange }: { label: string; hint: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="space-y-1">
      <HintLabel className="text-xs font-normal" hint={hint}>{label}</HintLabel>
      {values.map((value, index) => (
        <div key={`${label}-${index}`} className="flex items-center gap-1">
          <Input width="id" className="h-7 text-xs" value={value} onChange={(e) => onChange(values.map((entry, i) => (i === index ? e.target.value : entry)))} aria-label={label} />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove ${label}`} onClick={() => onChange(values.filter((_, i) => i !== index))}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([...values, ''])}>
        <Plus className="w-3 h-3 mr-1" />Status
      </Button>
    </div>
  );
}
