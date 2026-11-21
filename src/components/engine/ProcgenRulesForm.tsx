import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';
import { useAppContext } from '@/context/AppContext';
import {
  PROCGEN_RULES_DIR,
  PROCGEN_SETTING_HINTS,
  PROCGEN_SETTING_KEYS,
  emptyProcgenFile,
  parseProcgenFile,
  procgenRulesRelPath,
  serializeProcgenFile,
  visibleSettingKeys,
  type ProcgenFile,
  type ProcgenKey,
  type ProcgenPart,
} from '@/editor/procgenRules';
import { useRegisterDirty } from '@/context/SaveHealthContext';

const projectFile = (rootPath: string, rel: string) =>
  `${rootPath.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

export default function ProcgenRulesForm() {
  const ctx = useAppContext();
  const root = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath.replace(/\\/g, '/') : '';
  const [paths, setPaths] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) { setPaths([]); setFiles({}); setOriginal([]); setSelected(''); setRemoved([]); setDirty(false); return; }
    let cancelled = false;
    void (async () => {
      const list = await listTxtUnder(root, PROCGEN_RULES_DIR);
      if (cancelled) return;
      setPaths(list);
      setOriginal(list);
      setRemoved([]);
      setSelected(list[0] || '');
      setDirty(false);
    })();
    return () => { cancelled = true; };
  }, [root]);

  useEffect(() => {
    if (!root || !selected || files[selected] != null) return;
    let cancelled = false;
    void (async () => {
      const text = await loadConfigDocument(root, selected);
      if (!cancelled) setFiles((current) => current[selected] != null ? current : { ...current, [selected]: text });
    })();
    return () => { cancelled = true; };
  }, [root, selected, files]);

  const text = selected ? files[selected] ?? '' : '';
  const file = selected ? parseProcgenFile(text) : emptyProcgenFile();
  const write = (next: ProcgenFile) => {
    if (!selected) return;
    setFiles((current) => ({ ...current, [selected]: serializeProcgenFile(next) }));
    setDirty(true);
  };

  const create = () => {
    const path = procgenRulesRelPath(title || 'rules');
    let rel = path;
    let n = 2;
    const used = new Set(paths.map((item) => item.toLowerCase()));
    while (used.has(rel.toLowerCase())) {
      rel = procgenRulesRelPath(`${title || 'rules'}_${n}`);
      n += 1;
    }
    setFiles((current) => ({ ...current, [rel]: serializeProcgenFile(emptyProcgenFile()) }));
    setPaths((current) => current.includes(rel) ? current : [...current, rel]);
    setSelected(rel);
    setTitle('');
    setCreating(false);
    setDirty(true);
  };

  const remove = () => {
    if (!selected) return;
    const { [selected]: _drop, ...rest } = files;
    setFiles(rest);
    setPaths((current) => current.filter((path) => path !== selected));
    if (original.includes(selected)) setRemoved((current) => current.includes(selected) ? current : [...current, selected]);
    setDirty(true);
  };

  const save = async () => {
    if (!root) {
      toast({ title: 'No project', description: 'Open a project before saving procgen rules.', variant: 'destructive' });
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
        toast({ title: 'Save failed', description: 'Could not write maps/procgen_rules files.', variant: 'destructive' });
        return;
      }
      for (const path of removed) {
        if (!window.electronAPI?.deleteProjectFile) continue;
        await window.electronAPI.deleteProjectFile(projectFile(root, path));
      }
      setOriginal(paths);
      setRemoved([]);
      setDirty(false);
      toast({ title: 'Saved', description: payload.length ? `Wrote ${payload.length} procgen rule file(s).` : 'Removed procgen rule files.' });
    } finally {
      setBusy(false);
    }
  };

    const draftFiles = useMemo(() => Object.entries(files).map(([path, content]) => ({
    path,
    content: content.endsWith('\n') ? content : `${content}\n`,
  })), [files]);
  useRegisterDirty('procgen', dirty, save, draftFiles, (incoming) => {
    setFiles(Object.fromEntries(incoming.map((entry) => [entry.path, entry.content])));
    setDirty(true);
  });


  const setPart = (index: number, next: ProcgenPart) => write({ ...file, parts: file.parts.map((part, partIndex) => partIndex === index ? next : part) });
  const setKeys = (index: number, keys: ProcgenKey[]) => {
    const part = file.parts[index];
    if (!part || part.kind === 'include' || part.kind === 'append') return;
    setPart(index, { ...part, keys });
  };

  return (
    <div className="space-y-2">
      <FieldHint hint="maps/procgen_rules/*.txt. A map event uses this file through procgen_filename and fills the event's location rectangle when the map loads. The engine supports only one such event per map. Chunk maps set procgen_type on their header. INCLUDE pulls in another rules file at that point. The engine file is the source of truth; Studio no longer writes a content/procgen JSON sidecar from this editor. intermap_random is a different feature (a random teleport map list), not a procgen rules file.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procedural rules</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-1">
        {paths.map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === path} onClick={() => setSelected(path)}>
            {path.replace(new RegExp(`^${PROCGEN_RULES_DIR}/`), '').replace(/\.txt$/i, '')}
          </Button>
        ))}
        {creating ? (
          <div className="flex items-center gap-1">
            <Input width="id" className="h-7 text-xs" aria-label="New procgen rules id" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3 mr-1" />File
          </Button>
        )}
        <div className="flex-1" />
        {selected ? <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label="Remove procgen rules" onClick={remove}><Trash2 className="w-3 h-3" /></Button> : null}
        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => { void save(); }} disabled={!root || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
      </div>
      {selected ? (
        <div className="space-y-3">
          {file.parts.map((part, index) => (
            <div key={index} className="space-y-1 rounded-md border border-border/60 p-2">
              <div className="flex items-center gap-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {part.kind === 'include' ? 'INCLUDE' : part.kind === 'append' ? 'APPEND' : part.kind === 'section' ? part.name : part.kind}
                </div>
                <div className="flex-1" />
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2" aria-label={`Remove ${part.kind} block`} onClick={() => write({ ...file, parts: file.parts.filter((_, partIndex) => partIndex !== index) })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              {part.kind === 'include' || part.kind === 'append' ? (
                <div className="flex flex-wrap items-center gap-1">
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Path of another maps/procgen_rules file to insert at this point.">{part.kind.toUpperCase()}</HintLabel>
                  <Input width="path" className="h-7 text-xs" value={part.path} onChange={(event) => setPart(index, { ...part, path: event.target.value })} />
                </div>
              ) : part.kind === 'settings' ? (
                visibleSettingKeys(part).map((row, keyIndex, rows) => (
                  <div key={`${row.key}-${keyIndex}`} className="flex flex-wrap items-center gap-1">
                    {PROCGEN_SETTING_KEYS.includes(row.key as typeof PROCGEN_SETTING_KEYS[number]) ? (
                      <HintLabel className="text-xs font-normal w-48 shrink-0" hint={PROCGEN_SETTING_HINTS[row.key as typeof PROCGEN_SETTING_KEYS[number]]}>{row.key}</HintLabel>
                    ) : (
                      <Input width="id" className="h-7 text-xs" aria-label={`Settings key ${keyIndex + 1}`} value={row.key} onChange={(event) => setKeys(index, rows.map((item, i) => i === keyIndex ? { ...item, key: event.target.value } : item))} />
                    )}
                    <Input width="id" className="h-7 text-xs" aria-label={row.key} value={row.value} onChange={(event) => setKeys(index, rows.map((item, i) => i === keyIndex ? { ...item, value: event.target.value } : item))} />
                    {!PROCGEN_SETTING_KEYS.includes(row.key as typeof PROCGEN_SETTING_KEYS[number]) ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove ${row.key}`} onClick={() => setKeys(index, rows.filter((_, i) => i !== keyIndex))}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    ) : null}
                  </div>
                ))
              ) : (
                <>
                  {(part.keys.length ? part.keys : [{ key: part.kind === 'chunks' ? 'filename' : '', value: '', comment: '' }]).map((row, keyIndex, rows) => (
                    <div key={keyIndex} className="flex flex-wrap items-center gap-1">
                      {part.kind === 'chunks' ? (
                        <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Map chunk file. Chunk maps set procgen_type on their header (links, normal, start, end, key, door_north_south, door_west_east).">filename</HintLabel>
                      ) : (
                        <Input width="id" className="h-7 text-xs" aria-label={`Key ${keyIndex + 1}`} value={row.key} onChange={(event) => setKeys(index, rows.map((item, i) => i === keyIndex ? { ...item, key: event.target.value } : item))} />
                      )}
                      <Input width="path" className="h-7 text-xs" aria-label={part.kind === 'chunks' ? `Chunk file ${keyIndex + 1}` : `Value ${keyIndex + 1}`} value={row.value} onChange={(event) => setKeys(index, rows.map((item, i) => i === keyIndex ? { ...item, value: event.target.value } : item))} />
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove row ${keyIndex + 1}`} onClick={() => setKeys(index, rows.filter((_, i) => i !== keyIndex))}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setKeys(index, [...(part.keys.length ? part.keys : []), { key: part.kind === 'chunks' ? 'filename' : '', value: '', comment: '' }])}
                  >
                    <Plus className="w-3 h-3 mr-1" />{part.kind === 'chunks' ? 'Chunk' : 'Key'}
                  </Button>
                </>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => write({ ...file, parts: [...file.parts, { kind: 'include', path: '', comment: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />INCLUDE
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => write({ ...file, parts: [...file.parts, { kind: 'settings', keys: PROCGEN_SETTING_KEYS.map((key) => ({ key, value: '', comment: '' })), comment: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />Settings
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => write({ ...file, parts: [...file.parts, { kind: 'chunks', keys: [{ key: 'filename', value: '', comment: '' }], comment: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />Chunks
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No procgen rule files in maps/procgen_rules/ yet.</div>
      )}
    </div>
  );
}
