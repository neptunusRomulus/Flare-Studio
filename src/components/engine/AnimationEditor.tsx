import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { toast } from '@/hooks/use-toast';
import { listTxtUnder } from '@/hooks/useEventScripts';
import { loadConfigDocument, writeProjectFiles } from '@/editor/projectFiles';
import {
  ANIMATION_DIRECTIONS,
  ANIMATIONS_DIR,
  animationRelPath,
  emptyAnimationFile,
  emptyAnimationSection,
  parseAnimationFile,
  parseColorMod,
  parseDurationMs,
  previewLayout,
  previewRect,
  serializeAnimationFile,
  type AnimationFile,
  type AnimationSection,
  type PackedFrame,
} from '@/editor/animationFile';
import { useRegisterDirty } from '@/context/SaveHealthContext';

const projectFile = (root: string, rel: string) =>
  `${root.replace(/\\/g, '/')}/${rel.replace(/\\/g, '/').replace(/^\//, '')}`;

function AnimationFramePreview({
  projectPath, file, section, direction,
}: {
  projectPath: string;
  file: AnimationFile;
  section: AnimationSection;
  direction: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState('');
  const [ready, setReady] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const frameCount = Math.max(1, section.packed.length
    ? 1 + Math.max(0, ...section.packed.map((row) => parseInt(row.index, 10) || 0))
    : parseInt(section.frames, 10) || 1);
  const duration = parseDurationMs(section.duration);
  const imagePath = previewRect(file, section, 0, direction)?.image || file.headerKeys.images[0]?.file || '';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!projectPath || !imagePath || !window.electronAPI?.readFileAsDataURL) { setSrc(''); return; }
      const url = await window.electronAPI.readFileAsDataURL(projectFile(projectPath, imagePath));
      if (!cancelled) setSrc(url || '');
    };
    void load();
    return () => { cancelled = true; };
  }, [projectPath, imagePath]);

  useEffect(() => {
    if (!src) { imgRef.current = null; return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; setReady((n) => n + 1); };
    img.onerror = () => { imgRef.current = null; setReady((n) => n + 1); };
    img.src = src;
    return () => { imgRef.current = null; };
  }, [src]);

  useEffect(() => { setFrame(0); }, [section.name, direction, imagePath]);

  useEffect(() => {
    if (!playing) return;
    const per = duration / frameCount;
    const id = window.setInterval(() => {
      setFrame((current) => {
        if (section.type === 'play_once') return Math.min(current + 1, frameCount - 1);
        if (section.type === 'back_forth') {
          const cycle = frameCount * 2 - 2 || 1;
          const next = (current + 1) % cycle;
          return next < frameCount ? next : cycle - next;
        }
        return (current + 1) % frameCount;
      });
    }, Math.max(30, per || 100));
    return () => window.clearInterval(id);
  }, [playing, duration, frameCount, section.type]);

  const rect = previewRect(file, section, frame, direction);
  const blendMode = (file.headerKeys.blend_mode || 'normal').trim().toLowerCase();
  const colorMod = parseColorMod(file.headerKeys.color_mod);
  const alphaMod = parseInt(file.headerKeys.alpha_mod || '255', 10);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const layout = rect
      ? previewLayout(rect)
      : { canvasW: 64, canvasH: 64, originX: 0, originY: 0, destX: 0, destY: 0 };
    const scale = Math.min(160 / layout.canvasW, 160 / layout.canvasH, 4);
    canvas.width = Math.max(1, Math.round(layout.canvasW * scale));
    canvas.height = Math.max(1, Math.round(layout.canvasH * scale));
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#252540';
    for (let y = 0; y < canvas.height; y += 8) {
      for (let x = 0; x < canvas.width; x += 8) {
        if (((x / 8) + (y / 8)) % 2 === 0) ctx.fillRect(x, y, 8, 8);
      }
    }
    const img = imgRef.current;
    if (img && rect) {
      const destW = Math.max(1, Math.round(rect.w * scale));
      const destH = Math.max(1, Math.round(rect.h * scale));
      const destX = Math.round(layout.destX * scale);
      const destY = Math.round(layout.destY * scale);
      const needsTint = colorMod.r !== 255 || colorMod.g !== 255 || colorMod.b !== 255;
      let source: CanvasImageSource = img;
      let sx = rect.x;
      let sy = rect.y;
      let sw = rect.w;
      let sh = rect.h;
      if (needsTint) {
        const tint = document.createElement('canvas');
        tint.width = rect.w;
        tint.height = rect.h;
        const tctx = tint.getContext('2d');
        if (tctx) {
          tctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
          const imageData = tctx.getImageData(0, 0, rect.w, rect.h);
          const d = imageData.data;
          const r = colorMod.r / 255;
          const g = colorMod.g / 255;
          const b = colorMod.b / 255;
          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.round(d[i] * r);
            d[i + 1] = Math.round(d[i + 1] * g);
            d[i + 2] = Math.round(d[i + 2] * b);
          }
          tctx.putImageData(imageData, 0, 0);
          source = tint;
          sx = 0;
          sy = 0;
        }
      }
      ctx.save();
      const alpha = Number.isFinite(alphaMod) ? Math.max(0, Math.min(255, alphaMod)) / 255 : 1;
      ctx.globalAlpha = alpha;
      if (blendMode === 'add') ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(source, sx, sy, sw, sh, destX, destY, destW, destH);
      ctx.restore();
    }
    // Crosshair at the render origin (feet / hotspot), matching Flare's dest = position - offset.
    const originX = Math.round((rect ? layout.originX : 0) * scale) + 0.5;
    const originY = Math.round((rect ? layout.originY : 0) * scale) + 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 160, 40, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX - 4, originY);
    ctx.lineTo(originX + 4, originY);
    ctx.moveTo(originX, originY - 4);
    ctx.lineTo(originX, originY + 4);
    ctx.stroke();
    ctx.restore();
  }, [rect, src, frame, ready, blendMode, colorMod.r, colorMod.g, colorMod.b, alphaMod]);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <canvas ref={canvasRef} className="rounded-md border border-border bg-muted/40" aria-label="Animation frame preview" />
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="outline" className="h-7 px-2" aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={() => setPlaying((value) => !value)}>
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>
        <HintLabel className="text-xs font-normal" hint="Current frame in the selected section and direction.">frame {frame + 1}/{frameCount}</HintLabel>
      </div>
      {!src ? <div className="text-xs text-muted-foreground">No image in the project for this animation, so the preview is empty.</div> : null}
    </div>
  );
}

export default function AnimationEditor({ projectPath, initialFile }: { projectPath: string | null; initialFile?: string }) {
  const root = (projectPath || '').replace(/\\/g, '/');
  const [paths, setPaths] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<string[]>([]);
  const [selected, setSelected] = useState(initialFile || '');
  const [removed, setRemoved] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!root) { setPaths([]); setFiles({}); setOriginal([]); setSelected(''); setRemoved([]); setDirty(false); return; }
    let cancelled = false;
    void (async () => {
      const list = await listTxtUnder(root, ANIMATIONS_DIR);
      if (cancelled) return;
      setPaths(list);
      setOriginal(list);
      setRemoved([]);
      const start = initialFile && list.includes(initialFile) ? initialFile : list[0] || '';
      setSelected(start);
      setDirty(false);
    })();
    return () => { cancelled = true; };
  }, [root, initialFile]);

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
  const file = selected ? parseAnimationFile(text) : emptyAnimationFile();
  const write = (next: AnimationFile) => {
    if (!selected) return;
    setFiles((current) => ({ ...current, [selected]: serializeAnimationFile(next, text) }));
    setDirty(true);
  };

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return paths.filter((path) => !needle || path.toLowerCase().includes(needle));
  }, [paths, filter]);

  const section = file.sections[sectionIndex] || file.sections[0];
  useEffect(() => {
    if (sectionIndex >= file.sections.length) setSectionIndex(0);
  }, [file.sections.length, sectionIndex]);

  const create = () => {
    const rel = animationRelPath(title || 'new');
    let path = rel;
    let n = 2;
    const used = new Set(Object.keys(files).map((item) => item.toLowerCase()));
    while (used.has(path.toLowerCase())) {
      path = animationRelPath(`${title || 'new'}_${n}`);
      n += 1;
    }
    setFiles((current) => ({ ...current, [path]: serializeAnimationFile({
      header: '',
      headerKeys: { ...emptyAnimationFile().headerKeys, images: [{ file: '', id: '' }], render_size: '128,128', render_offset: '64,96' },
      sections: [emptyAnimationSection('stance')],
    }) }));
    setPaths((current) => current.includes(path) ? current : [...current, path]);
    setSelected(path);
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
      toast({ title: 'No project', description: 'Open a project before saving animations.', variant: 'destructive' });
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
        toast({ title: 'Save failed', description: 'Could not write animation files.', variant: 'destructive' });
        return;
      }
      for (const path of removed) {
        if (!window.electronAPI?.deleteProjectFile) continue;
        await window.electronAPI.deleteProjectFile(projectFile(root, path));
      }
      setOriginal(paths);
      setRemoved([]);
      setDirty(false);
      toast({ title: 'Saved', description: payload.length ? `Wrote ${payload.length} animation file(s).` : 'Removed animation files.' });
    } finally {
      setBusy(false);
    }
  };

    const draftFiles = useMemo(() => Object.entries(files).map(([path, content]) => ({
    path,
    content: content.endsWith('\n') ? content : `${content}\n`,
  })), [files]);
  useRegisterDirty('animations', dirty, save, draftFiles, (incoming) => {
    setFiles(Object.fromEntries(incoming.map((entry) => [entry.path, entry.content])));
    setDirty(true);
  });


  const setHeader = (patch: Partial<AnimationFile['headerKeys']>) => write({ ...file, headerKeys: { ...file.headerKeys, ...patch } });
  const setSection = (patch: Partial<AnimationSection>) => {
    if (!section) return;
    write({ ...file, sections: file.sections.map((row, index) => index === sectionIndex ? { ...row, ...patch } : row) });
  };

  return (
    <div className="flex h-full min-h-[28rem] gap-3 p-3">
      <div className="w-56 shrink-0 space-y-2 overflow-y-auto">
        <FieldHint hint="Animation definition files under animations/. An entity, item or power points at one of these paths. Packed files list frame= rows; unpacked files use render_size and position on an 8-direction grid.">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Animations</div>
        </FieldHint>
        <Input width="path" className="h-7 text-xs" aria-label="Filter animation files" placeholder="filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {visible.map((path) => (
          <Button key={path} type="button" size="sm" variant={selected === path ? 'default' : 'outline'} className="h-7 w-full justify-start text-xs font-mono" aria-pressed={selected === path} onClick={() => { setSelected(path); setSectionIndex(0); }}>
            {path.replace(/^animations\//, '')}
          </Button>
        ))}
        {creating ? (
          <div className="space-y-1">
            <Input width="path" className="h-7 text-xs" aria-label="New animation path" placeholder="enemies/goblin" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex gap-1">
              <Button type="button" size="sm" className="h-7 text-xs" onClick={create}>Create</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3 mr-1" />File
          </Button>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-1">
          <div className="text-xs font-mono text-muted-foreground">{selected || 'No animation selected'}</div>
          <div className="flex-1" />
          {selected ? <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label="Remove animation file" onClick={remove}><Trash2 className="w-3 h-3" /></Button> : null}
          <Button type="button" size="sm" className="h-7 text-xs" onClick={() => { void save(); }} disabled={!root || busy || !dirty}>{dirty ? 'Save' : 'Saved'}</Button>
        </div>
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Sprite sheet path, optional image id after a comma. Repeat for multiple images.">image</HintLabel>
              {file.headerKeys.images.map((image, index) => (
                <div key={index} className="flex items-center gap-1">
                  <Input width="path" className="h-7 text-xs" aria-label={`image ${index + 1} file`} value={image.file} onChange={(e) => setHeader({ images: file.headerKeys.images.map((row, rowIndex) => rowIndex === index ? { ...row, file: e.target.value } : row) })} />
                  <Input width="id" className="h-7 text-xs" aria-label={`image ${index + 1} id`} placeholder="id" value={image.id} onChange={(e) => setHeader({ images: file.headerKeys.images.map((row, rowIndex) => rowIndex === index ? { ...row, id: e.target.value } : row) })} />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove image ${index + 1}`} onClick={() => setHeader({ images: file.headerKeys.images.filter((_, rowIndex) => rowIndex !== index) })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHeader({ images: [...file.headerKeys.images, { file: '', id: '' }] })}>
                <Plus className="w-3 h-3 mr-1" />Image
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Unpacked frame width,height. Packed animations ignore this and use each frame= size.">render_size</HintLabel>
              <Input width="short" className="h-7 text-xs" placeholder="w,h" aria-label="render_size" value={file.headerKeys.render_size} onChange={(e) => setHeader({ render_size: e.target.value })} />
              <HintLabel className="text-xs font-normal w-24 shrink-0" hint="Unpacked render offset x,y.">render_offset</HintLabel>
              <Input width="short" className="h-7 text-xs" placeholder="x,y" aria-label="render_offset" value={file.headerKeys.render_offset} onChange={(e) => setHeader({ render_offset: e.target.value })} />
              <HintLabel className="text-xs font-normal w-20 shrink-0" hint="normal or add.">blend_mode</HintLabel>
              <Input width="short" className="h-7 text-xs" list="animation-blend-mode" aria-label="blend_mode" value={file.headerKeys.blend_mode} onChange={(e) => setHeader({ blend_mode: e.target.value })} />
              <HintLabel className="text-xs font-normal w-16 shrink-0" hint="0-255. 255 is fully opaque.">alpha_mod</HintLabel>
              <Input width="num" className="h-7 text-xs" aria-label="alpha_mod" value={file.headerKeys.alpha_mod} onChange={(e) => setHeader({ alpha_mod: e.target.value })} />
              <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Color mod r,g,b. 255,255,255 is none.">color_mod</HintLabel>
              <Input width="name" className="h-7 text-xs" aria-label="color_mod" value={file.headerKeys.color_mod} onChange={(e) => setHeader({ color_mod: e.target.value })} />
              <datalist id="animation-blend-mode"><option value="normal" /><option value="add" /></datalist>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {file.sections.map((row, index) => (
                <Button key={`${row.name}-${index}`} type="button" size="sm" variant={sectionIndex === index ? 'default' : 'outline'} className="h-7 text-xs" aria-pressed={sectionIndex === index} onClick={() => setSectionIndex(index)}>
                  {row.name || `section ${index + 1}`}
                </Button>
              ))}
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => { write({ ...file, sections: [...file.sections, emptyAnimationSection('new')] }); setSectionIndex(file.sections.length); }}>
                <Plus className="w-3 h-3 mr-1" />Section
              </Button>
            </div>
            {section ? (
              <>
                <div className="flex flex-wrap items-center gap-1">
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Section name used by the engine (stance, run, swing, die, …).">id</HintLabel>
                  <Input width="id" className="h-7 text-xs" aria-label="section name" value={section.name} onChange={(e) => setSection({ name: e.target.value })} />
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Unpacked only: first frame index to the right on the sheet.">position</HintLabel>
                  <Input width="num" className="h-7 text-xs" aria-label="position" value={section.position} onChange={(e) => setSection({ position: e.target.value })} />
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Number of frames in this section.">frames</HintLabel>
                  <Input width="num" className="h-7 text-xs" aria-label="frames" value={section.frames} onChange={(e) => setSection({ frames: e.target.value })} />
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Duration of the whole section, as 800ms, 1s, or a tick count.">duration</HintLabel>
                  <Input width="short" className="h-7 text-xs" aria-label="duration" value={section.duration} onChange={(e) => setSection({ duration: e.target.value })} />
                  <HintLabel className="text-xs font-normal w-12 shrink-0" hint="play_once, back_forth, or looped.">type</HintLabel>
                  <Input width="name" className="h-7 text-xs" list="animation-type" aria-label="type" value={section.type} onChange={(e) => setSection({ type: e.target.value })} />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label="Remove section" onClick={() => { write({ ...file, sections: file.sections.filter((_, index) => index !== sectionIndex) }); setSectionIndex(0); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <datalist id="animation-type">
                    <option value="play_once" />
                    <option value="back_forth" />
                    <option value="looped" />
                  </datalist>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <HintLabel className="text-xs font-normal w-20 shrink-0" hint="Frames that count as 'active' (comma list or all).">active_frame</HintLabel>
                  <Input width="short" className="h-7 text-xs" aria-label="active_frame" value={section.active_frame} onChange={(e) => setSection({ active_frame: e.target.value })} />
                  <HintLabel className="text-xs font-normal w-28 shrink-0" hint="Which sub-frame triggers active frames: start, end, or all.">active_sub_frame</HintLabel>
                  <Input width="short" className="h-7 text-xs" list="animation-sub-frame" aria-label="active_sub_frame" value={section.active_sub_frame} onChange={(e) => setSection({ active_sub_frame: e.target.value })} />
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Unpacked only: image id from the header.">image id</HintLabel>
                  <Input width="id" className="h-7 text-xs" aria-label="section image id" value={section.image} onChange={(e) => setSection({ image: e.target.value })} />
                  <datalist id="animation-sub-frame"><option value="start" /><option value="end" /><option value="all" /></datalist>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <HintLabel className="text-xs font-normal w-16 shrink-0" hint="Direction row 0-7. Unpacked sheets put one direction per row.">direction</HintLabel>
                  {Array.from({ length: ANIMATION_DIRECTIONS }, (_, index) => (
                    <Button key={index} type="button" size="sm" variant={direction === index ? 'default' : 'outline'} className="h-7 px-2 text-xs" aria-pressed={direction === index} onClick={() => setDirection(index)}>
                      {index}
                    </Button>
                  ))}
                </div>
                {root ? <AnimationFramePreview projectPath={root} file={file} section={section} direction={direction} /> : null}
                <FieldHint hint="Packed animations list one frame= row per index and direction: index, direction, x, y, w, h, offset_x, offset_y, optional image id. Leave this empty for unpacked sheets.">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Packed frames</div>
                </FieldHint>
                {section.packed.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-1">
                    {(['index', 'direction', 'x', 'y', 'w', 'h', 'ox', 'oy', 'image'] as const).map((field) => (
                      <Input key={field} width={field === 'image' ? 'id' : 'num'} className="h-7 text-xs" aria-label={`frame ${index + 1} ${field}`} placeholder={field} value={row[field]} onChange={(e) => {
                        const packed = section.packed.map((item, rowIndex) => rowIndex === index ? { ...item, [field]: e.target.value } : item);
                        setSection({ packed });
                      }} />
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove packed frame ${index + 1}`} onClick={() => setSection({ packed: section.packed.filter((_, rowIndex) => rowIndex !== index) })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setSection({ packed: [...section.packed, { index: '0', direction: String(direction), x: '0', y: '0', w: '', h: '', ox: '', oy: '', image: '' } satisfies PackedFrame] })}>
                  <Plus className="w-3 h-3 mr-1" />Frame
                </Button>
              </>
            ) : null}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">No animation files in animations/ yet.</div>
        )}
      </div>
    </div>
  );
}
