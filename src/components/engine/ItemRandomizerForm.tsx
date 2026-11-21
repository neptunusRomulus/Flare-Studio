import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';
import {
  ITEM_RANDOM_DIR,
  emptyItemRandomizer,
  emptyRandomizerOption,
  itemRandomizerDisplayName,
  itemRandomizerRelPath,
  parseItemRandomizer,
  serializeItemRandomizer,
  type ItemRandomizerFile,
  type RandomizerBonus,
  type RandomizerOption,
} from '@/editor/itemRandomizer';
import { useRegisterDirty } from '@/context/SaveHealthContext';

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

export default function ItemRandomizerForm({ projectPath }: { projectPath: string | null }) {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [files, setFiles] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) { setFiles({}); setOriginal([]); setSelected(''); setDirty(false); return; }
    let cancelled = false;
    void (async () => {
      const paths = await listTxtUnder(root, ITEM_RANDOM_DIR);
      const next: Record<string, string> = {};
      for (const path of paths) next[path] = await loadConfigDocument(root, path);
      if (cancelled) return;
      setFiles(next);
      setOriginal(paths);
      setSelected(paths[0] || '');
      setDirty(false);
    })();
    return () => { cancelled = true; };
  }, [root]);

  useEffect(() => {
    if (selected && files[selected] != null) return;
    setSelected(Object.keys(files).sort()[0] || '');
  }, [files, selected]);

  const text = selected ? files[selected] ?? '' : '';
  const table = selected ? parseItemRandomizer(text) : emptyItemRandomizer();
  const write = (next: ItemRandomizerFile) => {
    if (!selected) return;
    setFiles((current) => ({ ...current, [selected]: serializeItemRandomizer(next, text) }));
    setDirty(true);
  };

  const create = () => {
    const path = itemRandomizerRelPath(title || 'table');
    let rel = path;
    let n = 2;
    const used = new Set(Object.keys(files).map((item) => item.toLowerCase()));
    while (used.has(rel.toLowerCase())) {
      rel = itemRandomizerRelPath(`${title || 'table'}_${n}`);
      n += 1;
    }
    const starter = serializeItemRandomizer({
      header: '',
      options: [{ ...emptyRandomizerOption(), chance: '100', level_src: 'base', bonus_count: '1,1', level_range: '0,0' }],
      bonuses: [],
    });
    setFiles((current) => ({ ...current, [rel]: starter }));
    setSelected(rel);
    setTitle('');
    setCreating(false);
    setDirty(true);
  };

  const remove = () => {
    if (!selected) return;
    const { [selected]: _drop, ...rest } = files;
    setFiles(rest);
    setDirty(true);
  };

  const save = async () => {
    if (!root) {
      toast({ title: 'No project', description: 'Open a project before saving randomizer tables.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = Object.entries(files).map(([path, content]) => ({
        path,
        content: content.endsWith('\n') ? content : `${content}\n`,
      }));
      const saved = payload.length ? await writeProjectFiles(root, payload) : true;
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not write items/random tables.', variant: 'destructive' });
        return;
      }
      const kept = new Set(Object.keys(files));
      for (const path of original) {
        if (kept.has(path) || !window.electronAPI?.deleteProjectFile) continue;
        await window.electronAPI.deleteProjectFile(projectFile(root, path));
      }
      setOriginal(Object.keys(files));
      setDirty(false);
      toast({ title: 'Saved', description: payload.length ? `Wrote ${payload.length} randomizer table(s).` : 'Removed randomizer tables.' });
    } finally {
      setBusy(false);
    }
  };

  useRegisterDirty('item-randomizer', dirty, save);

  const setOption = (index: number, patch: Partial<RandomizerOption>) => {
    write({ ...table, options: table.options.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  };
  const setBonus = (index: number, patch: Partial<RandomizerBonus>) => {
    write({ ...table, bonuses: table.bonuses.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        {Object.keys(files).sort().map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === path} onClick={() => setSelected(path)}>
            {itemRandomizerDisplayName(path)}
          </Button>
        ))}
        {creating ? (
          <div className="flex items-center gap-1">
            <Input width="id" className="h-7 text-xs" aria-label="New randomizer id" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3 mr-1" />Table
          </Button>
        )}
        <div className="flex-1" />
        {selected ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label="Remove table" onClick={remove}>
            <Trash2 className="w-3 h-3" />
          </Button>
        ) : null}
        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => { void save(); }} disabled={!root || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
      </div>
      <FieldHint hint="items/random/*.txt. An item's randomizer_def points at one of these files. Each [option] is a chance to assign a quality, bonus count and a level offset from base (the source item) or hero (the player). [bonuses] is the pool the chosen option draws from; bonus=stat,scaled value (example: hp,base:50:100:1) and bonus_power_level=power_id,scaled value. Only project tables are listed.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Random item bonuses</div>
      </FieldHint>
      {selected ? (
        <>
          {table.options.map((option, index) => (
            <div key={index} className="space-y-1 rounded-md border border-border p-2">
              <div className="flex flex-wrap items-center gap-1">
                <HintLabel className="text-xs font-normal w-24 shrink-0" hint="Percent chance this option is eligible when the item is generated.">chance</HintLabel>
                <Input width="num" className="h-7 text-xs" aria-label={`option ${index + 1} chance`} value={option.chance} onChange={(e) => setOption(index, { chance: e.target.value })} />
                <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Quality id from items/qualities.txt assigned when this option is picked.">quality</HintLabel>
                <Input width="id" className="h-7 text-xs" aria-label={`option ${index + 1} quality`} value={option.quality} onChange={(e) => setOption(index, { quality: e.target.value })} />
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 ml-auto" aria-label={`Remove option ${index + 1}`} onClick={() => write({ ...table, options: table.options.filter((_, rowIndex) => rowIndex !== index) })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <HintLabel className="text-xs font-normal w-24 shrink-0" hint="Minimum and maximum number of bonuses drawn from the pool, e.g. 1,2.">bonus_count</HintLabel>
                <Input width="short" className="h-7 text-xs" aria-label={`option ${index + 1} bonus_count`} placeholder="min,max" value={option.bonus_count} onChange={(e) => setOption(index, { bonus_count: e.target.value })} />
                <HintLabel className="text-xs font-normal w-20 shrink-0" hint="base uses the source item's level; hero uses the player's current level.">level_src</HintLabel>
                <Input width="short" className="h-7 text-xs" list="item-randomizer-level-src" aria-label={`option ${index + 1} level_src`} value={option.level_src} onChange={(e) => setOption(index, { level_src: e.target.value })} />
                <HintLabel className="text-xs font-normal w-24 shrink-0" hint="Relative min,max added to the level_src level.">level_range</HintLabel>
                <Input width="short" className="h-7 text-xs" aria-label={`option ${index + 1} level_range`} placeholder="min,max" value={option.level_range} onChange={(e) => setOption(index, { level_range: e.target.value })} />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write({ ...table, options: [...table.options, emptyRandomizerOption()] })}>
            <Plus className="w-3 h-3 mr-1" />Option
          </Button>
          <datalist id="item-randomizer-level-src">
            <option value="base" />
            <option value="hero" />
          </datalist>
          <FieldHint hint="bonus=stat_id,value where value can use base, item_level, player_level, min, max, round and a primary stat, each written as type:min:max:step. Append % to make it a multiplier. bonus_power_level=power_id,value grants bonus levels to that power.">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bonus pool</div>
          </FieldHint>
          {table.bonuses.map((bonus, index) => (
            <div key={index} className="flex flex-wrap items-center gap-1">
              <Input width="id" className="h-7 text-xs" list="item-randomizer-bonus-kind" aria-label={`bonus ${index + 1} kind`} value={bonus.kind} onChange={(e) => {
                const kind = e.target.value === 'bonus_power_level' ? 'bonus_power_level' : 'bonus';
                setBonus(index, { kind });
              }} />
              <Input width="path" className="h-7 text-xs" aria-label={`bonus ${index + 1} value`} placeholder="hp,base:50:100:1" value={bonus.value} onChange={(e) => setBonus(index, { value: e.target.value })} />
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove bonus ${index + 1}`} onClick={() => write({ ...table, bonuses: table.bonuses.filter((_, rowIndex) => rowIndex !== index) })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write({ ...table, bonuses: [...table.bonuses, { kind: 'bonus', value: '', comment: '' }] })}>
            <Plus className="w-3 h-3 mr-1" />Bonus
          </Button>
          <datalist id="item-randomizer-bonus-kind">
            <option value="bonus" />
            <option value="bonus_power_level" />
          </datalist>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">No randomizer tables in items/random/ yet. Create one, then set an item's randomizer_def to its path.</div>
      )}
    </div>
  );
}
