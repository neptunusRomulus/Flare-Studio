import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';
import {
  RANDOM_MAP_LISTS_DIR,
  parseRandomMapList,
  randomMapListRelPath,
  serializeRandomMapList,
  type RandomMapListLine,
} from '@/editor/randomMapList';
import { useAppContext } from '@/context/AppContext';
import { useRegisterDirty } from '@/context/SaveHealthContext';

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

/** maps/random/lists/*.txt editor for intermap_random. */
export default function RandomMapListsForm() {
  const ctx = useAppContext();
  const root = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath.replace(/\\/g, '/') : '';
  const [paths, setPaths] = useState<string[]>([]);
  const [mapOptions, setMapOptions] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) { setPaths([]); setMapOptions([]); setFiles({}); setSelected(''); setDirty(false); return; }
    let cancelled = false;
    void (async () => {
      const [list, maps] = await Promise.all([
        listTxtUnder(root, RANDOM_MAP_LISTS_DIR),
        listTxtUnder(root, 'maps'),
      ]);
      if (cancelled) return;
      setPaths(list);
      setMapOptions(maps);
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
  const lines = useMemo(() => parseRandomMapList(text), [text]);
  const mapCount = lines.filter((line) => line.kind === 'map').length;

  const write = (next: RandomMapListLine[]) => {
    if (!selected) return;
    setFiles((current) => ({ ...current, [selected]: serializeRandomMapList(next) }));
    setDirty(true);
  };

  const updateMap = (index: number, patch: Partial<Extract<RandomMapListLine, { kind: 'map' }>>) => {
    write(lines.map((line, lineIndex) => (
      lineIndex === index && line.kind === 'map' ? { ...line, ...patch } : line
    )));
  };

  const addMap = () => write([...lines, { kind: 'map', map: '', x: '', y: '' }]);
  const removeLine = (index: number) => write(lines.filter((_, lineIndex) => lineIndex !== index));

  const create = () => {
    const rel = randomMapListRelPath(title || 'list');
    const used = new Set(paths.map((path) => path.toLowerCase()));
    let next = rel;
    let suffix = 2;
    while (used.has(next.toLowerCase())) {
      next = randomMapListRelPath(`${title || 'list'}_${suffix}`);
      suffix += 1;
    }
    setFiles((current) => ({ ...current, [next]: '' }));
    setPaths((current) => current.includes(next) ? current : [...current, next]);
    setSelected(next);
    setTitle('');
    setCreating(false);
    setDirty(true);
  };

  const save = async () => {
    if (!root) {
      toast({ title: 'No project', description: 'Open a project before saving random map lists.', variant: 'destructive' });
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
        toast({ title: 'Save failed', description: 'Could not save the map lists.', variant: 'destructive' });
        return;
      }
      setDirty(false);
      toast({ title: 'Saved', description: 'Random map lists saved.' });
    } finally {
      setBusy(false);
    }
  };

  const draftFiles = useMemo(() => Object.entries(files).map(([path, content]) => ({
    path,
    content: content.endsWith('\n') ? content : `${content}\n`,
  })), [files]);
  useRegisterDirty('random-map-lists', dirty, save, draftFiles, (incoming) => {
    setFiles(Object.fromEntries(incoming.map((entry) => [entry.path, entry.content])));
    setDirty(true);
  });

  return (
    <div className="space-y-2 rounded-lg border border-border p-3" aria-label="Random map lists">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Random map lists</div>
        <p className="text-[11px] text-muted-foreground">Send the player to a random map from a list. A map can start at a chosen X and Y.</p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {paths.map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === path} onClick={() => setSelected(path)}>
            {path.replace(new RegExp(`^${RANDOM_MAP_LISTS_DIR}/`), '').replace(/\.txt$/i, '')}
          </Button>
        ))}
        {creating ? (
          <div className="flex items-center gap-1">
            <Input width="id" className="h-7 text-xs" aria-label="New list name" placeholder="List name" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3 mr-1" />New list
          </Button>
        )}
        <div className="flex-1" />
        {selected ? <Button type="button" size="sm" className="h-7" disabled={!dirty || busy} onClick={() => void save()}><Save className="w-3.5 h-3.5 mr-1" />Save</Button> : null}
      </div>

      {!selected ? (
        <p className="text-xs text-muted-foreground">No random map lists yet. Create a list, then add maps to it.</p>
      ) : (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">{mapCount} map{mapCount === 1 ? '' : 's'}</div>
          <div className="grid grid-cols-[1fr_4rem_4rem_1.5rem] items-center gap-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Map</span><span>Start X</span><span>Start Y</span><span />
          </div>
          {lines.map((line, index) => line.kind === 'raw' ? null : (
            <div key={index} className="grid grid-cols-[1fr_4rem_4rem_1.5rem] items-center gap-1">
              <Input aria-label={`Map ${lines.slice(0, index + 1).filter((item) => item.kind === 'map').length}`} width="path" className="h-7 text-xs" list="random-map-list-maps" value={line.map} onChange={(event) => updateMap(index, { map: event.target.value })} placeholder="Choose a map" />
              <Input aria-label={`Map ${lines.slice(0, index + 1).filter((item) => item.kind === 'map').length} x`} width="num" className="h-7 text-xs" value={line.x} onChange={(event) => updateMap(index, { x: event.target.value })} placeholder="X" />
              <Input aria-label={`Map ${lines.slice(0, index + 1).filter((item) => item.kind === 'map').length} y`} width="num" className="h-7 text-xs" value={line.y} onChange={(event) => updateMap(index, { y: event.target.value })} placeholder="Y" />
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" aria-label={`Remove map ${lines.slice(0, index + 1).filter((item) => item.kind === 'map').length}`} onClick={() => removeLine(index)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          {lines.some((line) => line.kind === 'raw') ? (
            <details className="pt-1">
              <summary className="cursor-pointer text-[10px] text-muted-foreground">Comments and other lines</summary>
              <div className="space-y-1 pt-1">
                {lines.map((line, index) => line.kind === 'raw' ? (
                  <div key={index} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="flex-1 truncate">{line.raw?.trim() || 'Empty line'}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" aria-label={`Remove line ${index + 1}`} onClick={() => removeLine(index)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ) : null)}
              </div>
            </details>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addMap}><Plus className="w-3 h-3 mr-1" />Add map</Button>
          <datalist id="random-map-list-maps">
            {mapOptions.map((map) => <option key={map} value={map} />)}
          </datalist>
        </div>
      )}
    </div>
  );
}
