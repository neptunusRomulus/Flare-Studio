import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';
import { useAppContext } from '@/context/AppContext';
import {
  CUTSCENES_DIR,
  cutsceneRelPath,
  emptyCutsceneFile,
  parseCutsceneFile,
  serializeCutsceneFile,
  type CutsceneComponent,
  type CutsceneFile,
  type CutscenePart,
} from '@/editor/cutsceneFile';

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

const SCENE_KEYS = ['caption', 'image', 'pause', 'soundfx'] as const;
const VSCROLL_KEYS = ['text', 'image', 'separator'] as const;

export default function CutsceneEditor() {
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
      const list = await listTxtUnder(root, CUTSCENES_DIR);
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
  const file = selected ? parseCutsceneFile(text) : emptyCutsceneFile();
  const write = (next: CutsceneFile) => {
    if (!selected) return;
    setFiles((current) => ({ ...current, [selected]: serializeCutsceneFile(next, text) }));
    setDirty(true);
  };

  const create = () => {
    const path = cutsceneRelPath(title || 'cutscene');
    let rel = path;
    let n = 2;
    const used = new Set(paths.map((item) => item.toLowerCase()));
    while (used.has(rel.toLowerCase())) {
      rel = cutsceneRelPath(`${title || 'cutscene'}_${n}`);
      n += 1;
    }
    setFiles((current) => ({ ...current, [rel]: serializeCutsceneFile({
      ...emptyCutsceneFile(),
      parts: [{ kind: 'scene', components: [{ key: 'caption', value: '' }], comment: '' }],
    }) }));
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
      toast({ title: 'No project', description: 'Open a project before saving cutscenes.', variant: 'destructive' });
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
        toast({ title: 'Save failed', description: 'Could not write cutscene files.', variant: 'destructive' });
        return;
      }
      for (const path of removed) {
        if (!window.electronAPI?.deleteProjectFile) continue;
        await window.electronAPI.deleteProjectFile(projectFile(root, path));
      }
      setOriginal(paths);
      setRemoved([]);
      setDirty(false);
      toast({ title: 'Saved', description: payload.length ? `Wrote ${payload.length} cutscene file(s).` : 'Removed cutscene files.' });
    } finally {
      setBusy(false);
    }
  };

  const setPart = (index: number, next: CutscenePart) => write({ ...file, parts: file.parts.map((part, partIndex) => partIndex === index ? next : part) });
  const setComponent = (partIndex: number, compIndex: number, patch: Partial<CutsceneComponent>) => {
    const part = file.parts[partIndex];
    if (!part || part.kind === 'include') return;
    setPart(partIndex, { ...part, components: part.components.map((row, index) => index === compIndex ? { ...row, ...patch } : row) });
  };

  return (
    <div className="space-y-2">
      <FieldHint hint="cutscenes/*.txt. Header keys apply to the whole file. Each [scene] is an ordered list of caption, image (file, scale 0-2), pause (ms, s, or -1) and soundfx. Each [vscroll] is an ordered list of text, image and separator lines. INCLUDE inserts another cutscene file at that point. The engine file is the source of truth; Studio no longer writes a content/cutscenes JSON sidecar from this editor.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cutscenes</div>
      </FieldHint>
      <div className="flex flex-wrap items-center gap-1">
        {paths.map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={selected === path} onClick={() => setSelected(path)}>
            {path.replace(/^cutscenes\//, '').replace(/\.txt$/i, '')}
          </Button>
        ))}
        {creating ? (
          <div className="flex items-center gap-1">
            <Input width="id" className="h-7 text-xs" aria-label="New cutscene id" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3 mr-1" />File
          </Button>
        )}
        <div className="flex-1" />
        {selected ? <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label="Remove cutscene" onClick={remove}><Trash2 className="w-3 h-3" /></Button> : null}
        <Button type="button" size="sm" className="h-7 text-xs" onClick={() => { void save(); }} disabled={!root || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
      </div>
      {selected ? (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Caption margins as a percent of the screen, x,y.">caption_margins</HintLabel>
            <Input width="short" className="h-7 text-xs" aria-label="caption_margins" value={file.caption_margins} onChange={(e) => write({ ...file, caption_margins: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Caption background r,g,b,a.">caption_background</HintLabel>
            <Input width="name" className="h-7 text-xs" aria-label="caption_background" value={file.caption_background} onChange={(e) => write({ ...file, caption_background: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Scroll speed for vscroll scenes. Defaults to 0.5.">vscroll_speed</HintLabel>
            <Input width="num" className="h-7 text-xs" aria-label="vscroll_speed" value={file.vscroll_speed} onChange={(e) => write({ ...file, vscroll_speed: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <HintLabel className="text-xs font-normal w-36 shrink-0" hint="If set, this cutscene uses a random fullscreen menu background, like the title screen.">menu_backgrounds</HintLabel>
            <Input width="short" className="h-7 text-xs" aria-label="menu_backgrounds" value={file.menu_backgrounds} onChange={(e) => write({ ...file, menu_backgrounds: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <HintLabel className="text-xs font-normal w-36 shrink-0" hint="Music file played during the cutscene.">music</HintLabel>
            <Input width="path" className="h-7 text-xs" aria-label="music" value={file.music} onChange={(e) => write({ ...file, music: e.target.value })} />
          </div>
          {file.parts.map((part, partIndex) => (
            <div key={partIndex} className="space-y-1 rounded-md border border-border p-2">
              <div className="flex flex-wrap items-center gap-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{part.kind}</div>
                <div className="flex-1" />
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove ${part.kind} ${partIndex + 1}`} onClick={() => write({ ...file, parts: file.parts.filter((_, index) => index !== partIndex) })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              {part.kind === 'include' ? (
                <div className="flex flex-wrap items-center gap-1">
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Path of another cutscene file inserted here.">INCLUDE</HintLabel>
                  <Input width="path" className="h-7 text-xs" aria-label={`include ${partIndex + 1}`} list="cutscene-include-paths" value={part.path} onChange={(e) => setPart(partIndex, { ...part, path: e.target.value })} />
                </div>
              ) : (
                <>
                  {part.components.map((row, compIndex) => (
                    <div key={compIndex} className="flex flex-wrap items-center gap-1">
                      <Input width="id" className="h-7 text-xs" list={part.kind === 'scene' ? 'cutscene-scene-keys' : 'cutscene-vscroll-keys'} aria-label={`${part.kind} ${partIndex + 1} key ${compIndex + 1}`} value={row.key} onChange={(e) => setComponent(partIndex, compIndex, { key: e.target.value })} />
                      <Input width="path" className="h-7 text-xs" aria-label={`${part.kind} ${partIndex + 1} value ${compIndex + 1}`} value={row.value} onChange={(e) => setComponent(partIndex, compIndex, { value: e.target.value })} />
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove ${part.kind} component ${compIndex + 1}`} onClick={() => setPart(partIndex, { ...part, components: part.components.filter((_, index) => index !== compIndex) })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setPart(partIndex, { ...part, components: [...part.components, { key: part.kind === 'scene' ? 'caption' : 'text', value: '' }] })}>
                    <Plus className="w-3 h-3 mr-1" />Component
                  </Button>
                </>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write({ ...file, parts: [...file.parts, { kind: 'scene', components: [], comment: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />Scene
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write({ ...file, parts: [...file.parts, { kind: 'vscroll', components: [], comment: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />Vscroll
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => write({ ...file, parts: [...file.parts, { kind: 'include', path: '', comment: '' }] })}>
              <Plus className="w-3 h-3 mr-1" />Include
            </Button>
          </div>
          <datalist id="cutscene-scene-keys">{SCENE_KEYS.map((key) => <option key={key} value={key} />)}</datalist>
          <datalist id="cutscene-vscroll-keys">{VSCROLL_KEYS.map((key) => <option key={key} value={key} />)}</datalist>
          <datalist id="cutscene-include-paths">{paths.map((path) => <option key={path} value={path} />)}</datalist>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">No cutscene files in cutscenes/ yet.</div>
      )}
    </div>
  );
}
