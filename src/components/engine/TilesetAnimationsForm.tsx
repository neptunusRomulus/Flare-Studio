import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';
import {
  parseTilesetAnimations,
  serializeTilesetAnimations,
  type TilesetAnimationFrame,
  type TilesetAnimationLine,
} from '@/editor/tilesetAnimation';
import { useAppContext } from '@/context/AppContext';
import { useRegisterDirty } from '@/context/SaveHealthContext';

const DIR = 'tilesetdefs';

const slug = (value: string) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'tileset';

/** tilesetdefs/*.txt animation= rows (animated tiles). */
export default function TilesetAnimationsForm() {
  const ctx = useAppContext();
  const root = typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath.replace(/\\/g, '/') : '';
  const [paths, setPaths] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) { setPaths([]); setFiles({}); setSelected(''); setDirty(false); return; }
    let cancelled = false;
    void (async () => {
      const list = await listTxtUnder(root, DIR);
      if (cancelled) return;
      setPaths(list);
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
  const lines = useMemo(() => parseTilesetAnimations(text), [text]);
  const animationRows = lines.map((line, index) => ({ line, index })).filter((row) => row.line.kind === 'animation');

  const write = (next: TilesetAnimationLine[]) => {
    if (!selected) return;
    setFiles((current) => ({ ...current, [selected]: serializeTilesetAnimations(next) }));
    setDirty(true);
  };

  const update = (index: number, next: TilesetAnimationLine) => write(lines.map((line, lineIndex) => lineIndex === index ? next : line));
  const remove = (index: number) => write(lines.filter((_, lineIndex) => lineIndex !== index));
  const add = () => write([...lines, { kind: 'animation', id: '', frames: [] }]);
  const updateFrame = (index: number, frameIndex: number, patch: Partial<TilesetAnimationFrame>) => {
    const line = lines[index];
    if (!line || line.kind !== 'animation') return;
    update(index, { ...line, frames: line.frames.map((frame, i) => i === frameIndex ? { ...frame, ...patch } : frame) });
  };
  const addFrame = (index: number) => {
    const line = lines[index];
    if (!line || line.kind !== 'animation') return;
    update(index, { ...line, frames: [...line.frames, { x: '', y: '', duration: '' }] });
  };
  const removeFrame = (index: number, frameIndex: number) => {
    const line = lines[index];
    if (!line || line.kind !== 'animation') return;
    update(index, { ...line, frames: line.frames.filter((_, i) => i !== frameIndex) });
  };

  const create = () => {
    const rel = `${DIR}/${slug(title || 'tileset')}.txt`;
    let next = rel;
    let suffix = 2;
    const used = new Set(paths.map((path) => path.toLowerCase()));
    while (used.has(next.toLowerCase())) { next = `${DIR}/${slug(title || 'tileset')}_${suffix}.txt`; suffix += 1; }
    setFiles((current) => ({ ...current, [next]: `[tileset]\nimg=images/tilesets/${slug(title || 'tileset')}.png\n` }));
    setPaths((current) => current.includes(next) ? current : [...current, next]);
    setSelected(next);
    setTitle('');
    setCreating(false);
    setDirty(true);
  };

  const save = async () => {
    if (!root) {
      toast({ title: 'No project', description: 'Open a project before saving tileset animations.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = Object.entries(files).map(([path, content]) => ({ path, content: content.endsWith('\n') ? content : `${content}\n` }));
      const saved = payload.length ? await writeProjectFiles(root, payload) : true;
      if (!saved) {
        toast({ title: 'Save failed', description: 'Could not save the tileset animations.', variant: 'destructive' });
        return;
      }
      setDirty(false);
      toast({ title: 'Saved', description: 'Tileset animations saved.' });
    } finally {
      setBusy(false);
    }
  };

  const draftFiles = useMemo(() => Object.entries(files).map(([path, content]) => ({ path, content: content.endsWith('\n') ? content : `${content}\n` })), [files]);
  useRegisterDirty('tileset-animations', dirty, save, draftFiles, (incoming) => {
    setFiles(Object.fromEntries(incoming.map((entry) => [entry.path, entry.content])));
    setDirty(true);
  });

  return (
    <div className="space-y-2" aria-label="Tileset animations">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tileset animations</div>
        <p className="text-[11px] text-muted-foreground">Make a tile animate by showing a sequence of frames.</p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {paths.map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === path} onClick={() => setSelected(path)}>
            {path.replace(new RegExp(`^${DIR}/`), '').replace(/\.txt$/i, '')}
          </Button>
        ))}
        {creating ? (
          <div className="flex items-center gap-1">
            <Input width="id" className="h-7 text-xs" aria-label="New tileset name" placeholder="Tileset name" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3 mr-1" />New tileset
          </Button>
        )}
        <div className="flex-1" />
        {selected ? <Button type="button" size="sm" className="h-7" disabled={!dirty || busy} onClick={() => void save()}><Save className="w-3.5 h-3.5 mr-1" />Save</Button> : null}
      </div>

      {!selected ? (
        <p className="text-xs text-muted-foreground">No tilesets yet. Create one to add animated tiles.</p>
      ) : (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">{animationRows.length} animation{animationRows.length === 1 ? '' : 's'}</div>
          {animationRows.map(({ line, index }, row) => line.kind === 'animation' ? (
            <div key={index} className="space-y-1.5 rounded-md border border-border/70 p-2">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium">Animation {row + 1}</span>
                <div className="flex-1" />
                <Input aria-label={`Animation ${row + 1} tile`} width="num" className="h-7 w-24 text-xs" value={line.id} onChange={(event) => update(index, { ...line, id: event.target.value })} placeholder="Tile ID" />
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" aria-label={`Remove animation ${row + 1}`} onClick={() => remove(index)}><Trash2 className="w-3 h-3" /></Button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_1fr_1.5rem] items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>X</span><span>Y</span><span>Duration</span><span />
              </div>
              {line.frames.map((frame, frameIndex) => (
                <div key={frameIndex} className="grid grid-cols-[1fr_1fr_1fr_1.5rem] items-center gap-1">
                  <Input aria-label={`Animation ${row + 1} frame ${frameIndex + 1} x`} width="num" className="h-7 text-xs" value={frame.x} onChange={(event) => updateFrame(index, frameIndex, { x: event.target.value })} placeholder="0" />
                  <Input aria-label={`Animation ${row + 1} frame ${frameIndex + 1} y`} width="num" className="h-7 text-xs" value={frame.y} onChange={(event) => updateFrame(index, frameIndex, { y: event.target.value })} placeholder="0" />
                  <Input aria-label={`Animation ${row + 1} frame ${frameIndex + 1} duration`} width="num" className="h-7 text-xs" value={frame.duration} onChange={(event) => updateFrame(index, frameIndex, { duration: event.target.value })} placeholder="250ms" />
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" aria-label={`Remove animation ${row + 1} frame ${frameIndex + 1}`} onClick={() => removeFrame(index, frameIndex)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              {line.frames.length === 0 ? <p className="text-[10px] text-muted-foreground">Add frames to make this tile animate.</p> : null}
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addFrame(index)}><Plus className="w-3 h-3 mr-1" />Add frame</Button>
            </div>
          ) : null)}
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={add}><Plus className="w-3 h-3 mr-1" />Animation</Button>
        </div>
      )}
    </div>
  );
}
