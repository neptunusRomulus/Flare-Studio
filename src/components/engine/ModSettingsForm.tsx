import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';
import { dataPathFromFlareSelection } from '@/flare/playLaunch';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import {
  MOD_SETTINGS_PATH,
  emptyModSettings,
  loadOrder,
  parseModSettings,
  serializeModSettings,
  type ModRequire,
  type ModSettingsFile,
} from '@/editor/modSettings';
import { useRegisterDirty } from '@/context/SaveHealthContext';

export default function ModSettingsForm({ projectPath }: { projectPath: string | null }) {
  const root = (projectPath || '').replace(/\\/g, '/');
  const projectName = root.split('/').filter(Boolean).pop() || '';
  const [text, setText] = useState('');
  const [available, setAvailable] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) { setText(''); setDirty(false); return; }
    let cancelled = false;
    void loadConfigDocument(root, MOD_SETTINGS_PATH).then((next) => {
      if (!cancelled) { setText(next); setDirty(false); }
    });
    return () => { cancelled = true; };
  }, [root]);

  useEffect(() => {
    const flarePath = getStoredFlarePath();
    const data = flarePath ? dataPathFromFlareSelection(flarePath) : '';
    if (!data || !window.electronAPI?.readDir) { setAvailable([]); return; }
    let cancelled = false;
    void window.electronAPI.readDir(`${data.replace(/\\/g, '/')}/mods`).then((entries) => {
      if (cancelled) return;
      const names = (entries || [])
        .filter((entry: { isDirectory?: boolean; name: string }) => entry.isDirectory && entry.name && entry.name !== '.' && entry.name !== '..')
        .map((entry: { name: string }) => entry.name)
        .sort();
      setAvailable(names);
    }).catch(() => { if (!cancelled) setAvailable([]); });
    return () => { cancelled = true; };
  }, []);

  const file = parseModSettings(text);
  const write = (next: ModSettingsFile) => {
    setText(serializeModSettings(next, text));
    setDirty(true);
  };
  const setRequire = (index: number, patch: Partial<ModRequire>) => {
    write({ ...file, requires: file.requires.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  };
  const move = (index: number, delta: number) => {
    const next = [...file.requires];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    write({ ...file, requires: next });
  };

  const save = async () => {
    if (!root) {
      toast({ title: 'No project', description: 'Open a project before saving settings.txt.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const content = text.endsWith('\n') ? text : `${text}\n`;
      const saved = await writeProjectFiles(root, [{ path: MOD_SETTINGS_PATH, content }]);
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not write settings.txt.', variant: 'destructive' });
        return;
      }
      setDirty(false);
      toast({ title: 'Saved', description: 'Wrote settings.txt.' });
    } finally {
      setBusy(false);
    }
  };

  const draftFiles = useMemo(() => (dirty ? [{ path: MOD_SETTINGS_PATH, content: text.endsWith('\n') ? text : `${text}\n` }] : []), [dirty, text]);
  useRegisterDirty('mod-settings', dirty, save, draftFiles, (incoming) => {
    if (!incoming[0]) return;
    setText(incoming[0].content);
    setDirty(true);
  });

  const order = loadOrder(file, projectName);

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <FieldHint hint="settings.txt is this project's mod manifest. requires= lists dependency mods (name or name:min:max) in the order they should load. Play uses that list plus this folder name as --mods. The player's global mods.txt is not edited here.">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mod settings</div>
        </FieldHint>
        <div className="flex-1" />
        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => { void save(); }} disabled={!root || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Short description shown in the Flare mod list.">description</HintLabel>
        <Input width="path" className="h-7 text-xs" aria-label="description" value={file.description} onChange={(e) => write({ ...file, description: e.target.value })} />
      </div>
      {file.locales.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1">
          <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Translated description: 2-letter language code, then the text.">description_locale</HintLabel>
          <Input width="short" className="h-7 text-xs" aria-label={`locale ${index + 1} lang`} value={row.lang} onChange={(e) => write({ ...file, locales: file.locales.map((item, rowIndex) => rowIndex === index ? { ...item, lang: e.target.value } : item) })} />
          <Input width="path" className="h-7 text-xs" aria-label={`locale ${index + 1} text`} value={row.text} onChange={(e) => write({ ...file, locales: file.locales.map((item, rowIndex) => rowIndex === index ? { ...item, text: e.target.value } : item) })} />
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove locale ${index + 1}`} onClick={() => write({ ...file, locales: file.locales.filter((_, rowIndex) => rowIndex !== index) })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write({ ...file, locales: [...file.locales, { lang: '', text: '' }] })}>
        <Plus className="w-3 h-3 mr-1" />Locale
      </Button>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="This mod's version number.">version</HintLabel>
        <Input width="name" className="h-7 text-xs" aria-label="version" value={file.version} onChange={(e) => write({ ...file, version: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Game this mod belongs to, e.g. flare-game.">game</HintLabel>
        <Input width="name" className="h-7 text-xs" aria-label="game" value={file.game} onChange={(e) => write({ ...file, game: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Minimum Flare engine version required.">engine_version_min</HintLabel>
        <Input width="name" className="h-7 text-xs" aria-label="engine_version_min" value={file.engine_version_min} onChange={(e) => write({ ...file, engine_version_min: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Maximum Flare engine version. Empty means no upper bound.">engine_version_max</HintLabel>
        <Input width="name" className="h-7 text-xs" aria-label="engine_version_max" value={file.engine_version_max} onChange={(e) => write({ ...file, engine_version_max: e.target.value })} />
      </div>
      <FieldHint hint="Dependency mods, in load order. Each row is a folder name, optionally min and max versions (fantasycore:1.15 or fantasycore:1.15:2.0). default is always loaded first by the engine and is omitted here. Enable/disable is whether a row is present. The last loaded mod is this project.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requires (load order)</div>
      </FieldHint>
      {file.requires.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1">
          <Input width="id" className="h-7 text-xs" list="mod-require-names" aria-label={`require ${index + 1} name`} placeholder="mod" value={row.name} onChange={(e) => setRequire(index, { name: e.target.value })} />
          <Input width="short" className="h-7 text-xs" aria-label={`require ${index + 1} min`} placeholder="min" value={row.min} onChange={(e) => setRequire(index, { min: e.target.value })} />
          <Input width="short" className="h-7 text-xs" aria-label={`require ${index + 1} max`} placeholder="max" value={row.max} onChange={(e) => setRequire(index, { max: e.target.value })} />
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Move require ${index + 1} up`} onClick={() => move(index, -1)}>
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Move require ${index + 1} down`} onClick={() => move(index, 1)}>
            <ChevronDown className="w-3 h-3" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove require ${index + 1}`} onClick={() => write({ ...file, requires: file.requires.filter((_, rowIndex) => rowIndex !== index) })}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write({ ...file, requires: [...file.requires, { name: '', min: '', max: '' }] })}>
        <Plus className="w-3 h-3 mr-1" />Mod
      </Button>
      <datalist id="mod-require-names">
        {available.filter((name) => name !== projectName).map((name) => <option key={name} value={name} />)}
      </datalist>
      <div className="text-xs text-muted-foreground">
        Play load order: {order.length ? order.join(' → ') : '(this project only)'}
      </div>
    </div>
  );
}
