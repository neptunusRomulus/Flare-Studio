import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import {
  DEFAULT_XP_SCALING,
  emptyXpScalingTable,
  parseXpScalingTable,
  serializeXpScalingTable,
  xpScalingDisplayName,
  xpScalingRelPath,
  type XpScaleRow,
  type XpScalingTable,
} from '@/editor/xpScaling';

type Props = {
  files: Record<string, string>;
  onChange: (files: Record<string, string>) => void;
};

const RowList = ({
  label,
  hint,
  rows,
  onChange,
}: {
  label: string;
  hint: string;
  rows: XpScaleRow[];
  onChange: (rows: XpScaleRow[]) => void;
}) => (
  <div className="space-y-1">
    <FieldHint hint={hint}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </FieldHint>
    <div className="grid grid-cols-[5rem_1fr_auto] gap-1 text-[11px] text-muted-foreground">
      <span>Level</span><span>Multiplier</span><span />
    </div>
    {rows.map((row, index) => (
      <div key={index} className="grid grid-cols-[5rem_1fr_auto] gap-1">
        <Input width="num" className="h-6 text-xs" aria-label={`${label} level ${index + 1}`} value={row.level} onChange={(e) => onChange(rows.map((item, i) => (i === index ? { ...item, level: e.target.value } : item)))} />
        <Input width="num" className="h-6 text-xs" aria-label={`${label} multiplier ${index + 1}`} value={row.multiplier} onChange={(e) => onChange(rows.map((item, i) => (i === index ? { ...item, multiplier: e.target.value } : item)))} />
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={`Remove ${label} row ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    ))}
    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([...rows, { level: '', multiplier: '' }])}>
      <Plus className="w-3 h-3 mr-1" />{label} row
    </Button>
  </div>
);

/** Editor for enemies/xp_scaling/*.txt tables. */
export default function XpScalingTablesForm({ files, onChange }: Props) {
  const paths = Object.keys(files).sort();
  const [selected, setSelected] = useState(paths[0] || '');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (selected && files[selected] != null) return;
    setSelected(Object.keys(files).sort()[0] || '');
  }, [files, selected]);

  const text = selected ? files[selected] ?? '' : '';
  const table = selected ? parseXpScalingTable(text) : emptyXpScalingTable();
  const write = (next: XpScalingTable) => {
    if (!selected) return;
    onChange({ ...files, [selected]: serializeXpScalingTable(next, text) });
  };

  const create = () => {
    const path = xpScalingRelPath(title || 'table');
    let rel = path;
    let n = 2;
    const used = new Set(Object.keys(files).map((item) => item.toLowerCase()));
    while (used.has(rel.toLowerCase())) {
      rel = xpScalingRelPath(`${title || 'table'}_${n}`);
      n += 1;
    }
    onChange({ ...files, [rel]: DEFAULT_XP_SCALING });
    setSelected(rel);
    setCreating(false);
    setTitle('');
  };

  return (
    <div className="space-y-3">
      <FieldHint hint="enemies/xp_scaling/*.txt. An enemy uses a table with xp_scaling=. [absolute] multiplies XP by the enemy's level. [relative] multiplies by (enemy level − player level). Values outside the table use the nearest end. Empty sections are not written.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">XP scaling</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-1">
        {paths.map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === path} onClick={() => setSelected(path)}>
            {xpScalingDisplayName(path)}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
          <Plus className="w-3 h-3 mr-1" />Table
        </Button>
      </div>
      {creating && (
        <div className="flex flex-wrap items-center gap-1">
          <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Filename under enemies/xp_scaling/.">name</HintLabel>
          <Input width="name" className="h-7 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
          <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
        </div>
      )}
      {selected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground truncate">{selected}</div>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
              const next = { ...files };
              delete next[selected];
              onChange(next);
            }}>
              <Trash2 className="w-3 h-3 mr-1" />Delete table
            </Button>
          </div>
          <RowList
            label="Absolute"
            hint="level,multiplier for the enemy's actual level. If the level is below or above the table, the closest end is used."
            rows={table.absolute}
            onChange={(absolute) => write({ ...table, absolute })}
          />
          <RowList
            label="Relative"
            hint="level,multiplier for (enemy level − player level). Negative means the enemy is weaker than the player."
            rows={table.relative}
            onChange={(relative) => write({ ...table, relative })}
          />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No tables yet. Create one, then set an enemy's xp_scaling to that file.</div>
      )}
    </div>
  );
}
